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
    return conferirBackend()
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
