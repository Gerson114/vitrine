import type { MetadataRoute } from "next"

/**
 * O robots.txt da vitrine.
 *
 * Existe por dois motivos, e nenhum deles é SEO. O primeiro é que sem arquivo
 * nenhum o buscador rastreia TUDO — inclusive /api, que não tem página
 * nenhuma para indexar e onde cada visita do robô consome o freio de
 * requisições que existe para proteger o backend (ver security/limite.ts).
 *
 * O segundo pesa mais: as telas de conta e de pedido mostram nome, endereço e
 * o que a pessoa comprou. Elas exigem sessão, então o robô não vê o conteúdo —
 * mas o ENDEREÇO de um pedido é `/loja/pedido/905014`, e um código de seis
 * dígitos indexado é meio caminho para quem estiver varrendo códigos. Endereço
 * de pedido não entra em índice de busca.
 *
 * O que fica liberado é o que é para ser achado: a home de cada loja e as
 * páginas de produto.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/api/",

                    // Um asterisco no começo do caminho porque cada loja tem o
                    // próprio prefixo: o que se quer barrar é /qualquer-loja/conta,
                    // e não um /conta que não existe.
                    "/*/conta",
                    "/*/acompanhar",
                    "/*/pedido/",
                ],
            },
        ],
    }
}
