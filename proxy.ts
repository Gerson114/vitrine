import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { limitar, origemDaRequisicao, regraDaRota } from "@/security/limite"
import { cabecalhosDeSeguranca } from "@/security/cabecalhos"

// Loja pública: nenhuma rota exige sessão. O proxy faz duas coisas — aplica
// os headers de segurança (CSP com nonce, anti-clickjacking etc.) em toda
// resposta e freia quem pede demais (ver security/limite.ts).
//
// Passou a valer para /api também, e não só para as páginas. Antes as rotas
// internas ficavam de fora do matcher: saíam sem nosniff, sem Referrer-Policy
// e — o que pesa mais — sem freio nenhum, justamente onde ficam o login e a
// consulta de pedido por código, que são as portas que se arrombam por
// tentativa e erro.
//
// A lista de cabeçalhos em si mora em security/cabecalhos.ts, e não aqui: ela
// é escrita também pelo `headers()` do next.config, para os caminhos que o
// matcher abaixo não alcança, e duas listas escritas à mão divergiram uma vez
// (ver o comentário daquele arquivo).
export function proxy(request: NextRequest) {

    // O freio vem antes de qualquer trabalho: uma requisição barrada não deve
    // custar nem uma renderização nem uma ida ao backend.
    const { pathname } = request.nextUrl
    const regra = regraDaRota(pathname, request.method)
    const veredito = limitar(
        `${regra.balde}:${origemDaRequisicao(request.headers)}`,
        regra.max,
        regra.janelaMs,
    )

    const isDev = process.env.NODE_ENV === "development"

    if (!veredito.ok) {
        const ehApi = pathname.startsWith("/api/")

        // A resposta barrada sai com os mesmos cabeçalhos de segurança das
        // outras: ela é conteúdo servido por esta origem como qualquer outro, e
        // um 429 sem política nenhuma é uma página da loja sem política
        // nenhuma. Sem nonce porque não há script nela.
        const cabecalhos = new Headers(cabecalhosDeSeguranca("", isDev))

        cabecalhos.set("Content-Type", ehApi ? "application/json" : "text/plain; charset=utf-8")
        cabecalhos.set("Retry-After", String(veredito.esperar))
        cabecalhos.set("Cache-Control", "no-store")

        return new NextResponse(
            ehApi
                ? JSON.stringify({ erro: "Muitas tentativas. Espere um pouco e tente de novo." })
                : "Muitas requisições. Espere um pouco e recarregue a página.",
            { status: 429, headers: cabecalhos },
        )
    }

    // O nonce é aleatório por requisição: é ele que autoriza o script de
    // inicialização do Next e, por 'strict-dynamic', o que aquele script
    // carregar. Base64 porque a diretiva CSP o espera nessa forma.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64")

    const cabecalhos = cabecalhosDeSeguranca(nonce, isDev)
    const politica = cabecalhos["Content-Security-Policy"]

    // O Next lê o nonce da política NO CABEÇALHO DA REQUISIÇÃO e o repassa a
    // cada <script> que ele mesmo injeta. Sem isto, a página sai com a
    // política certa e nenhum script autorizado — tela branca.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-nonce", nonce)
    requestHeaders.set("Content-Security-Policy", politica)

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    for (const [chave, valor] of Object.entries(cabecalhos)) {
        response.headers.set(chave, valor)
    }

    return response
}

export const config = {
    matcher: [
        {
            source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },

        // As rotas internas entram por uma regra própria, sem a exceção de
        // prefetch: prefetch não chama /api, e deixar a exceção aqui seria
        // abrir um caminho para escapar do freio mandando o cabeçalho.
        "/api/:path*",
    ],
}
