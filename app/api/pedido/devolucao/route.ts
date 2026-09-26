import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

/**
 * POST /api/pedido/devolucao — o comprador pedindo o dinheiro de volta.
 *
 * É a irmã de /api/pedido/cancelar, para depois do pagamento. Cancelar
 * desfaz um pedido que ainda não custou nada a ninguém; devolver mexe em
 * dinheiro que já entrou, e por isso não é um botão que resolve sozinho: o
 * que sai daqui é um pedido à loja, que ela aceita ou recusa.
 *
 * Exige a sessão da conta pelo mesmo motivo do cancelamento — o código de
 * seis dígitos serve para ACOMPANHAR um pedido, nunca para mexer nele.
 *
 * Só duas causas passam por aqui: "atraso" (o pedido não chegou no prazo) e
 * "danificado". Não existe devolução de motivo livre pela vitrine — ela
 * automatizaria o caminho de quem recebe a mercadoria inteira e pede o
 * dinheiro de volta assim mesmo. Qualquer outro motivo é conversa com a loja.
 *
 * O que este arquivo NÃO faz: conferir se o prazo venceu, se o pedido foi
 * entregue ou quanto vale a devolução. Quem sabe disso é o backend, que tem
 * as datas e os preços do dia da compra — e é lá que a causa é conferida
 * contra o estado do pedido. Aqui só se recusa o que nem vale uma ida à
 * rede.
 */
export async function POST(request: Request) {
    try {
        const entrada = await lerCorpo(request)

        if (!entrada) {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const loja = String(entrada.loja ?? "").slice(0, 40)
        const codigo = String(entrada.codigo ?? "")

        if (!slugValido(loja) || !/^\d{6}$/.test(codigo)) {
            return Response.json({ erro: "Pedido não encontrado" }, { status: 404 })
        }

        const causa = String(entrada.causa ?? "")

        if (causa !== "atraso" && causa !== "danificado") {
            return Response.json(
                { erro: "A devolução pela loja online vale para pedido que não chegou ou que chegou danificado" },
                { status: 400 },
            )
        }

        const motivo = String(entrada.motivo ?? "").trim().slice(0, 500)

        // As peças vão como vieram, só filtradas: item e quantidade, ambos
        // números positivos. Quantidade demais é recusada no backend, contra
        // o que a pessoa realmente comprou — número nenhum daqui tem valor
        // de verdade.
        const itens = Array.isArray(entrada.itens)
            ? entrada.itens
                .map((item) => {
                    const linha = item as Record<string, unknown>

                    return {
                        item_pedido_id: Number(linha?.item_pedido_id ?? 0),
                        quantidade: Number(linha?.quantidade ?? 0),
                    }
                })
                .filter((item) => item.item_pedido_id > 0 && item.quantidade > 0)
                .slice(0, 50)
            : []

        // No atraso não se escolhe peça: não chegou nada, e é o servidor que
        // monta a lista com o pedido inteiro. A avaria precisa das duas coisas
        // — quais peças vieram danificadas e o que aconteceu com elas.
        if (causa === "danificado") {

            if (itens.length === 0) {
                return Response.json({ erro: "Marque quais peças vieram danificadas" }, { status: 400 })
            }

            if (!motivo) {
                return Response.json({ erro: "Conte o que veio danificado" }, { status: 400 })
            }
        }

        const token = await tokenDaLoja(loja)

        if (!token) {
            return Response.json({ erro: "Entre na sua conta para pedir a devolução" }, { status: 401 })
        }

        const resposta = await chamarBackend(
            new URL(`/public/loja/${loja}/pedidos/${codigo}/devolucao`, API_BASE),
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ causa, motivo, itens }),
                cache: "no-store",
            },
        )

        const dados = safeParse(await resposta.text())

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível pedir a devolução") },
                { status: resposta.status },
            )
        }

        return Response.json(dados ?? {}, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
