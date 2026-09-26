// Confere, na subida do servidor, se a configuração da vitrine é segura para
// o ambiente em que ela está rodando.
//
// É o espelho de security/ambiente.ts do painel e de lib/security/ambiente no
// backend Go, e existe pelo mesmo motivo: erro de configuração perigoso tem de
// aparecer no boot, para quem faz o deploy, e não meses depois num vazamento.
// Em desenvolvimento vira aviso; em produção derruba a subida, porque ali não
// existe "depois eu arrumo".
//
// A variável que motiva este arquivo é API_URL. Ela tem um valor padrão
// (http://localhost:8080) que está certo na máquina de quem desenvolve e é
// duas coisas ruins em produção: a vitrine não acha o backend — e, se alguém
// subir um serviço em 8080 na mesma máquina, ela passa a falar com ele.
//
// A segunda é TRUSTED_PROXY_COUNT, e o estrago dela é mais silencioso: sem
// ela o limitador não sabe de quem é cada requisição e joga TODO MUNDO no
// mesmo balde (ver origemDaRequisicao em security/limite.ts). O teto de oito
// logins por dez minutos, que é por pessoa, passa a valer para a soma de
// todos os visitantes de todas as lojas — e o nono cliente do dia recebe
// "muitas tentativas" sem nunca ter errado uma senha.

export interface Problema {
    variavel: string
    mensagem: string
    correcao: string
}

/** Se este processo está servindo produção. */
export function ehProducao(): boolean {
    return process.env.NODE_ENV === "production"
}

/** Tudo o que está inseguro na configuração atual. Lista vazia é tudo certo. */
export function conferir(): Problema[] {
    return [...conferirBackend(), ...conferirProxy()]
}

/**
 * Quantos proxies existem na frente deste servidor.
 *
 * Em produção a vitrine nunca está exposta direto: o TLS termina no Caddy, e
 * é ele quem escreve o endereço real de quem chamou. O processo do Next só vê
 * a conexão do proxy, então sem saber quantos saltos contar ele não tem como
 * dizer quem pediu — e é justamente o endereço de quem pediu que é a chave do
 * limite por origem.
 *
 * Por isso a variável é obrigatória em produção, e zero não serve: zero
 * significa "ninguém na frente", que num deploy com Caddy é falso e faz o
 * limitador contar o mundo inteiro como um visitante só.
 *
 * Um é só o Caddy. Dois é Cloudflare + Caddy — e aí o firewall da VPS tem de
 * aceitar apenas as faixas da Cloudflare, senão qualquer um bate direto na
 * origem com o cabeçalho que quiser (ver deploy/PRODUCAO.md).
 */
function conferirProxy(): Problema[] {

    if (!ehProducao()) return []

    const bruto = (process.env.TRUSTED_PROXY_COUNT ?? "").trim()

    if (!bruto) {
        return [{
            variavel: "TRUSTED_PROXY_COUNT",
            mensagem: "não definida: o limite por origem cai num balde único e o nono cliente do dia recebe \"muitas tentativas\" sem ter errado nada",
            correcao: "declare quantos proxies existem na frente da vitrine — 1 com Caddy, 2 com Cloudflare + Caddy",
        }]
    }

    const saltos = Number(bruto)

    if (!Number.isInteger(saltos) || saltos < 1 || saltos > 4) {
        return [{
            variavel: "TRUSTED_PROXY_COUNT",
            mensagem: `${JSON.stringify(bruto)} não é um número de saltos utilizável`,
            correcao: "use um inteiro de 1 a 4 — 1 com Caddy, 2 com Cloudflare + Caddy",
        }]
    }

    return []
}

function conferirBackend(): Problema[] {

    const bruto = (process.env.API_URL ?? "").trim()

    if (!bruto) {
        return [{
            variavel: "API_URL",
            mensagem: "não definida: a vitrine cairia no padrão http://localhost:8080, que em produção não é o backend",
            correcao: "aponte para o endereço interno do servidor, como http://app:8080 dentro do Docker",
        }]
    }

    let url: URL

    try {
        url = new URL(bruto)
    } catch {
        return [{
            variavel: "API_URL",
            mensagem: `${JSON.stringify(bruto)} não é um endereço válido`,
            correcao: "use a forma http://servidor:porta, sem barra no final",
        }]
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return [{
            variavel: "API_URL",
            mensagem: `esquema ${JSON.stringify(url.protocol)} não serve para falar com o backend`,
            correcao: "use http:// na rede interna do Docker ou https:// fora dela",
        }]
    }

    const local = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname)

    // Localhost em produção só é legítimo quando o backend roda no MESMO
    // container, o que não é o desenho deste sistema (ver
    // deploy/docker-compose.prod.yml: a vitrine fala com "app" pela rede
    // interna). É quase sempre o .env de desenvolvimento que veio junto.
    if (ehProducao() && local) {
        return [{
            variavel: "API_URL",
            mensagem: `aponta para ${url.hostname}, que dentro do container é o próprio container — o backend não está aí`,
            correcao: "use o nome do serviço na rede do Docker, como http://app:8080",
        }]
    }

    // HTTP fora da rede interna significa catálogo, pedido e sessão do
    // comprador trafegando em texto puro entre a vitrine e o backend.
    if (ehProducao() && url.protocol === "http:" && url.hostname.includes(".")) {
        return [{
            variavel: "API_URL",
            mensagem: "usa http:// para um endereço fora da rede interna: os dados dos compradores trafegam em texto puro",
            correcao: "use https://, ou mantenha o backend na rede interna do Docker (http://app:8080)",
        }]
    }

    return []
}
