import type { Bloco, LojaAtual, TemaLoja } from "@/app/loja/loja-context"

// Só roda no servidor (Server Components e rotas /api) — fala direto com o
// backend, sem passar pelo navegador.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

/**
 * Traduz o endereço da URL na loja dona dele. Devolve null quando o endereço
 * não existe, quando a loja ainda não escolheu endereço ou quando ela não
 * assinou o plano com site — de fora, os três casos são o mesmo: essa loja
 * não está no ar.
 */
export async function buscarLojaServidor(slug: string): Promise<LojaAtual | null> {

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40) {
        return null
    }

    try {
        const response = await fetch(new URL(`/public/loja/${encodeURIComponent(slug)}`, API_BASE), {
            headers: { Accept: "application/json" },
            cache: "no-store",
        })

        if (!response.ok) return null

        const dados = (await response.json()) as {
            loja?: {
                slug?: string
                nome?: string
                tema?: TemaLoja
                cnpj?: string
                aceita_pagamento?: boolean
                metodos_pagamento?: string[]
                whatsapp?: string
                telefone?: string
                endereco?: string
                horario?: string
                pagina?: Bloco[]
                textos?: Record<string, string>
            }
        }

        if (!dados.loja?.slug) return null

        return {
            slug: dados.loja.slug,
            nome: dados.loja.nome || dados.loja.slug,
            tema: dados.loja.tema,
            cnpj: dados.loja.cnpj,
            aceita_pagamento: dados.loja.aceita_pagamento,
            metodos_pagamento: Array.isArray(dados.loja.metodos_pagamento)
                ? dados.loja.metodos_pagamento
                : undefined,

            whatsapp: dados.loja.whatsapp,
            telefone: dados.loja.telefone,
            endereco: dados.loja.endereco,
            horario: dados.loja.horario,

            // A lista vem validada do servidor (ver services/paginas): tipo
            // fora do catálogo e propriedade que não pertence ao bloco não
            // chegam até aqui. Só se confere que é uma lista.
            pagina: Array.isArray(dados.loja.pagina) ? dados.loja.pagina : undefined,

            // As palavras desta loja, já resolvidas pelo servidor: cada chave
            // traz o texto final, o que o lojista escreveu ou o padrão (ver
            // services/paginas/textos.go). A vitrine só lê.
            textos:
                dados.loja.textos && typeof dados.loja.textos === "object"
                    ? dados.loja.textos
                    : undefined,
        }

    } catch {
        return null
    }
}
