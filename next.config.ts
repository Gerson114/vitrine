import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

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

/**
 * O que o navegador pode fazer nas páginas da VITRINE.
 *
 * Ela é a parte exposta na internet aberta: qualquer pessoa carrega, e é onde
 * um XSS custaria mais caro — é aqui que o comprador digita endereço e é
 * levado ao provedor de pagamento.
 *
 * A regra de leitura: tudo o que não está aqui é proibido. `'unsafe-inline'`
 * em script e style é dívida conhecida do Next, que injeta o script de
 * inicialização e os estilos na própria página; mesmo com ele, a política
 * barra script vindo de outro domínio, que é o vetor de uma dependência
 * comprometida.
 */
function politicaDeConteudo(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",

    // A foto do produto costuma estar hospedada fora — o lojista cola a URL.
    // Imagem não executa código, e por isso é a permissão larga mais barata.
    "img-src 'self' data: blob: https:",

    "connect-src 'self'",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",

    // O formulário desta página só posta para ela mesma. É o que impede um
    // formulário injetado de mandar o endereço e o telefone do comprador
    // para outro servidor.
    "form-action 'self'",

    // Ninguém põe a vitrine dentro de um iframe: é assim que se monta uma
    // página falsa que parece a loja e captura o clique de comprar.
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Os cabeçalhos de segurança da vitrine.
  //
  // O backend manda os dele nas respostas da API; quem o navegador carrega e
  // executa é este servidor. Sem estes, a loja ia sem política nenhuma.
  //
  // HSTS fica de fora de propósito: quem o emite é quem termina o TLS. Daqui,
  // em desenvolvimento, ele prenderia localhost em https no navegador.
  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          { key: "Content-Security-Policy", value: politicaDeConteudo() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },

          // O endereço da página não vaza para terceiros: ele carrega o nome
          // da loja e, nas telas de pedido, o código dele.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // A localização fica liberada para a PRÓPRIA página: é o que faz o
          // seletor de lojas oferecer a unidade mais perto do cliente. Câmera
          // e microfone a vitrine não usa.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
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
