import type { Produto } from "@/app/type/type"

// Só roda no servidor (Server Components) — fala direto com o backend, sem
// passar pela rota /api/produtos (essa é pra chamadas do navegador).
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

/**
 * Catálogo de uma loja só. O endereço é obrigatório: não existe listagem
 * geral, cada vitrine enxerga apenas os próprios produtos.
 */
export async function listarProdutosServidor(slug: string): Promise<Produto[]> {

    if (!slug) return []

    const url = new URL("/public/produtos", API_BASE)
    url.searchParams.set("loja", slug)

    const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    })

    if (!response.ok) return []

    const dados = (await response.json()) as { produtos?: Produto[] }
    return Array.isArray(dados.produtos) ? dados.produtos : []
}
