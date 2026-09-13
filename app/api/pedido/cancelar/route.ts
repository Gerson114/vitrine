import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"

/**
 * POST /api/pedido/cancelar — o comprador desistindo antes de pagar.
 *
 * Exige a sessão da conta, e não o código do pedido mais o contato: cancelar
 * é escrever, e escrever num pedido pede uma prova de identidade mais forte
 * do que ler. Quem consulta pelo código de seis dígitos continua podendo ver
 * o pedido; para cancelar, entra na conta.
 *
 * Quem decide se ainda dá tempo é o backend: pedido já pago é recusado lá,
 * com a mensagem que a tela mostra.
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

        const token = await tokenDaLoja(loja)

        if (!token) {
            return Response.json({ erro: "Entre na sua conta para cancelar o pedido" }, { status: 401 })
        }

        const resposta = await fetch(
            new URL(`/public/loja/${loja}/pedidos/${codigo}/cancelar`, API_BASE),
            {
                method: "POST",
                headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
                cache: "no-store",
            },
        )

        const dados = safeParse(await resposta.text())

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível cancelar o pedido") },
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
