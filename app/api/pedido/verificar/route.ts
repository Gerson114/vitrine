import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"

/**
 * Confere o pagamento do próprio pedido, ao voltar do provedor.
 *
 * O caminho normal é o provedor avisar o servidor sozinho (webhook). Isso
 * falha mais do que parece — e falha justamente no pior momento: a pessoa
 * acabou de pagar, volta para a loja e vê "aguardando pagamento".
 *
 * Aqui quem pergunta é a página, mas quem responde é o provedor: o backend
 * consulta com a chave da loja e confere o valor contra os itens gravados. A
 * página não tem como afirmar que algo foi pago.
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
            return Response.json({ erro: "Entre na sua conta para acompanhar o pedido" }, { status: 401 })
        }

        // O que o provedor devolveu na URL de retorno.
        //
        // A InfinitePay manda a transação e a fatura na volta do checkout, e
        // ela exige as duas — mais o código do pedido — para responder
        // qualquer consulta. É por aqui que elas chegam ao servidor quando o
        // aviso automático não vem, que é o caso de toda loja rodando num
        // endereço que a internet não alcança.
        //
        // Nada disso prova pagamento: é só o endereço da pergunta que o
        // backend vai fazer ao provedor, que continua sendo quem responde.
        const identificador = (bruto: unknown) => {
            const texto = String(bruto ?? "").trim().slice(0, 128)
            return /^[A-Za-z0-9_-]*$/.test(texto) ? texto : ""
        }

        const resposta = await fetch(
            new URL(`/public/loja/${loja}/pedidos/${codigo}/verificar`, API_BASE),
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    transacao: identificador(entrada.transacao),
                    fatura: identificador(entrada.fatura),
                }),
                cache: "no-store",
            },
        )

        const dados = safeParse(await resposta.text())

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível conferir o pagamento") },
                { status: resposta.status },
            )
        }

        return Response.json(dados ?? {}, { status: 200, headers: { "Cache-Control": "no-store" } })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
