import { API_BASE, erroDoBackend, safeParse, slugValido } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

/**
 * Quanto custa entregar neste CEP.
 *
 * Não exige sessão de propósito: o cliente quer saber o frete antes de
 * decidir se cria cadastro, e obrigá-lo a se cadastrar para descobrir o preço
 * da entrega é o jeito mais fácil de perder a venda antes de ela começar.
 *
 * O carrinho vai junto, e não o total: a isenção por valor tem de ser
 * calculada sobre o preço que o SERVIDOR conhece. Mandar o total daqui
 * deixaria qualquer um dizer "meu carrinho custa mil" e ganhar frete grátis.
 */
export async function POST(request: Request) {
    try {
        const entrada = await lerCorpo(request)

        if (!entrada) {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const loja = String(entrada.loja ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const cep = String(entrada.cep ?? "").replace(/\D/g, "").slice(0, 8)

        const itensBrutos = Array.isArray(entrada.itens) ? entrada.itens.slice(0, 100) : []

        const itens = itensBrutos
            .map((item) => {
                const registro = item as Record<string, unknown>
                return {
                    produto_id: Number(registro.produto_id),
                    quantidade: Number(registro.quantidade),
                }
            })
            .filter((item) =>
                Number.isInteger(item.produto_id) && item.produto_id > 0 &&
                Number.isInteger(item.quantidade) && item.quantidade > 0 && item.quantidade <= 1000)

        const response = await chamarBackend(new URL(`/public/loja/${loja}/frete`, API_BASE), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ cep, itens }),
            cache: "no-store",
        })

        const dados = safeParse(await response.text())

        if (!response.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível calcular o frete") },
                { status: response.status },
            )
        }

        return Response.json(dados ?? {}, { status: 200, headers: { "Cache-Control": "no-store" } })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
