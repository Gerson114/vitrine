import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { cabecalhosDeSeguranca } from "./security/cabecalhos";

/**
 * Os endereços IPv4 desta máquina na rede local.
 *
 * O servidor de desenvolvimento do Next bloqueia requisições a recursos
 * internos vindas de qualquer origem que não seja aquela em que ele subiu
 * (localhost). O sintoma é enganoso: a página carrega, o HTML vem certo, a
 * API responde 200 se aberta direto — mas o React não hidrata, e a vitrine
 * fica parada no esqueleto de carregamento, sem erro no console. Foi o que
 * aconteceu ao abrir a loja pelo IP, para testar no celular.
 *
 * O IP já esteve escrito à mão aqui dentro, e por isso a loja quebrava toda
 * vez que o DHCP trocava o endereço da máquina — o mesmo IP obsoleto que
 * derrubava a volta do pagamento. Perguntar ao sistema operacional resolve os
 * dois de uma vez e não precisa ser mantido.
 *
 * `internal` são as interfaces de loopback (127.0.0.1), que o Next já libera
 * sozinho. O que interessa é o endereço pelo qual o celular chega aqui.
 */
function iPsDaRedeLocal(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter((endereco) => endereco.family === "IPv4" && !endereco.internal)
    .map((endereco) => endereco.address);
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  /* Os cabeçalhos de segurança dos caminhos que o PROXY não alcança.

     O matcher de proxy.ts deixa de fora /_next/static, /_next/image e
     favicon.ico — e o que sai por aqui vale só para eles, porque em tudo o
     mais o proxy escreve por cima. Não são páginas: não há script inline nem
     nonce a distribuir, então a política sai na variante sem nonce (ver
     security/cabecalhos.ts, que é onde a lista mora — escrever uma segunda
     lista aqui foi o que uma vez deixou a política das páginas proibindo a
     localização que esta permitia). */
  async headers() {

    const isDev = process.env.NODE_ENV === "development";

    return [
      {
        source: "/:caminho*",
        headers: Object.entries(cabecalhosDeSeguranca("", isDev)).map(
          ([key, value]) => ({ key, value }),
        ),
      },
    ];
  },

  // Empacota em .next/standalone só o que o servidor precisa em produção,
  // com um server.js próprio. É o que permite a imagem final não levar o
  // node_modules inteiro nem o código-fonte — menos coisa para baixar a cada
  // deploy e menos coisa que possa ser explorada lá dentro, do mesmo jeito
  // que o painel e o binário Go já fazem.
  output: "standalone",

  // Abrir a loja pelo IP da rede, para testar no celular. Vale só em
  // desenvolvimento; em produção o Next ignora esta opção.
  //
  // DEV_ORIGIN cobre o que não é IP desta máquina — o host de um túnel
  // (ngrok, cloudflared), por exemplo. Ele precisa vir do ambiente do
  // processo (`DEV_ORIGIN=... npm run dev`), e NÃO do .env.local: este
  // arquivo é lido antes do runtime do Next, então os .env ainda não foram
  // carregados quando ele roda.
  //
  // Lembrete que vale a pena guardar junto: o endereço pelo qual você navega
  // tem de ser o mesmo do VITRINE_URL do backend. Se divergirem, o provedor
  // devolve o comprador para outra origem, o cookie da sessão não acompanha e
  // ele reaparece na loja deslogado.
  allowedDevOrigins: [
    ...(process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : []),
    ...iPsDaRedeLocal(),
  ],

  experimental: {
    // Teto do corpo que o proxy guarda em memória para poder ser lido duas
    // vezes (uma nele, outra na rota). O padrão do Next é 10 MB — e desde que
    // /api entrou no matcher do proxy, esse padrão passou a valer para toda
    // requisição às rotas internas. Como nenhuma delas recebe mais que alguns
    // kilobytes de JSON (ver security/corpo.ts), 64 KB é folga suficiente e
    // fecha o caminho de encher a memória do servidor mandando corpos enormes
    // que seriam bufferizados antes de qualquer validação.
    proxyClientMaxBodySize: "64kb",
  },
};

export default nextConfig;
