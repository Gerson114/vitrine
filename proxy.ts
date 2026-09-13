import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { limitar, origemDaRequisicao, regraDaRota } from "@/security/limite"

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
// Sobre o 'unsafe-inline' em style-src, que parece um furo e não é:
//
// As cores do lojista chegam à página num ATRIBUTO style, no <div> que
// embrulha a vitrine (ver app/[loja]/layout.tsx). Atributo não aceita nonce —
// nonce vale para elementos (<style>, <script>), nunca para atributo —, então
// a única forma de o navegador aplicar aquelas quatro variáveis é permitindo
// estilo inline. Com `style-src 'self'` puro, o navegador descartava o
// atributo em silêncio e toda loja aparecia no preto-e-branco de fábrica do
// globals.css, com o tema escolhido pelo lojista simplesmente ignorado.
//
// E não adianta pôr o nonce aqui junto: pela especificação, a presença de um
// nonce (ou hash) em style-src faz o navegador IGNORAR o 'unsafe-inline'. Ou
// um, ou outro.
//
// O que se perde é pouco e o que se ganha é a função: script continua preso
// ao nonce (é ali que mora o risco de verdade), o CSS externo continua preso
// a 'self', não existe nenhum sink de HTML nesta aplicação (nada de
// dangerouslySetInnerHTML) e as cores já são validadas contra #RRGGBB antes
// de virar atributo (ver lib/tema.ts). O diretivo cirúrgico seria
// style-src-attr, que permitiria só o atributo e continuaria barrando
// <style> — mas o suporte a ele é irregular entre navegadores, e onde não é
// suportado a regra volta a cair em style-src e a vitrine despinta de novo.
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

    if (!veredito.ok) {
        const ehApi = pathname.startsWith("/api/")

        return new NextResponse(
            ehApi
                ? JSON.stringify({ erro: "Muitas tentativas. Espere um pouco e tente de novo." })
                : "Muitas requisições. Espere um pouco e recarregue a página.",
            {
                status: 429,
                headers: {
                    "Content-Type": ehApi ? "application/json" : "text/plain; charset=utf-8",
                    "Retry-After": String(veredito.esperar),
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                },
            },
        )
    }

    const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
    const isDev = process.env.NODE_ENV === "development"

    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
        style-src 'self' 'unsafe-inline';
        img-src 'self' https: data:;
        font-src 'self';
        connect-src 'self';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
        ${isDev ? "" : "upgrade-insecure-requests;"}
    `
    const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim()

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-nonce", nonce)
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue)

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue)
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    // Isola a janela desta loja de qualquer coisa que ela abra — o retorno do
    // provedor de pagamento abre numa aba nova, e sem isso a página do
    // provedor mantém uma referência à vitrine (window.opener).
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin")

    if (!isDev) {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload"
        )
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
