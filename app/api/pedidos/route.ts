import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"

interface ItemEntrada {
    produto_id: number
    quantidade: number
}

/**
 * Fechar pedido. Agora exige conta.
 *
 * Nome e contato não são mais enviados: o backend os tira da conta logada.
 * Mandá-los daqui deixaria o comprador escrever qualquer nome no pedido,
 * inclusive o de outra pessoa.
 *
 * Sem sessão, responde 401 antes de gastar uma chamada ao backend — a tela
 * usa isso para mandar a pessoa criar conta e voltar ao carrinho.
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

        const token = await tokenDaLoja(loja)

        if (!token) {
            return Response.json({ erro: "Crie uma conta para finalizar o pedido" }, { status: 401 })
        }

        // Teto na lista antes de percorrê-la: um pedido com cinquenta mil
        // linhas cabe folgado no limite do corpo, e sem este corte viraria
        // cinquenta mil registros para o backend conferir estoque um a um.
        // Nenhuma sacola de verdade passa de algumas dezenas de produtos.
        const itensBrutos = Array.isArray(entrada.itens) ? entrada.itens.slice(0, 100) : []

        const itens: ItemEntrada[] = itensBrutos
            .map((item) => {
                const registro = item as Record<string, unknown>
                return {
                    produto_id: Number(registro.produto_id),
                    quantidade: Number(registro.quantidade),
                }
            })
            .filter((item) =>
                Number.isInteger(item.produto_id) && item.produto_id > 0 &&
                // O teto por item fecha o outro lado da mesma porta: sem ele
                // a lista curta continuaria podendo pedir dois bilhões de
                // unidades de um produto só. O estoque real é conferido no
                // backend; isto aqui só impede que o número absurdo chegue lá.
                Number.isInteger(item.quantidade) && item.quantidade > 0 && item.quantidade <= 1000)

        if (itens.length === 0) {
            return Response.json({ erro: "O pedido precisa ter ao menos um item" }, { status: 400 })
        }

        const entregaBruta = (entrada.entrega ?? {}) as Record<string, unknown>

        const texto = (valor: unknown, limite: number) => String(valor ?? "").slice(0, limite)

        const entrega = {
            tipo: texto(entregaBruta.tipo, 16),
            cep: texto(entregaBruta.cep, 9),
            logradouro: texto(entregaBruta.logradouro, 160),
            numero: texto(entregaBruta.numero, 20),
            complemento: texto(entregaBruta.complemento, 80),
            bairro: texto(entregaBruta.bairro, 80),
            cidade: texto(entregaBruta.cidade, 80),
        }

        const response = await fetch(new URL(`/public/loja/${loja}/pedidos`, API_BASE), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
            // A entrega vai como o cliente a preencheu; o VALOR do frete
            // não vai, e não vai de propósito: quem o calcula é o backend, a
            // partir do CEP e da tabela da loja. Aceitá-lo daqui seria deixar
            // o comprador escolher quanto paga de entrega.
            body: JSON.stringify({ itens, entrega, telefone: texto(entrada.telefone, 24) }),
            cache: "no-store",
        })

        const dados = safeParse(await response.text())

        if (!response.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível concluir o pedido") },
                { status: response.status },
            )
        }

        if (!dados) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        return Response.json(dados, { status: 201, headers: { "Cache-Control": "no-store" } })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
