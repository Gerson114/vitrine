import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend, TEMPO_LIMITE_PAGAMENTO } from "@/lib/backend"

/**
 * Texto cru do navegador, virado string e cortado no limite.
 *
 * É uma `function` de módulo, e não um `const` dentro do handler, por um
 * motivo que já custou um erro em produção: declarada com `const` no meio da
 * função, ela não existe nas linhas ACIMA dela — e usá-la lá lança
 * "Cannot access before initialization", que o `catch` do fim transforma num
 * "Erro interno do servidor" sem pista nenhuma. `function` é içada, então
 * vale no arquivo todo e não depende de quem foi escrito primeiro.
 */
function texto(valor: unknown, limite: number): string {
    return String(valor ?? "").slice(0, limite)
}

interface ItemEntrada {
    produto_id: number
    quantidade: number

    /** O recado do cliente sobre este item: "sem cebola", "bem passado". */
    observacao: string

    /**
     * O que ele escolheu junto — só os ids.
     *
     * Nome e preço NÃO passam por aqui, e é de propósito: quem os lê é o
     * backend, do próprio banco. Deixá-los viajar seria deixar o comprador
     * escrever quanto a borda custa.
     */
    adicionais: { opcao_id: number }[]
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

                // Os adicionais: só ids, com teto de quantos cabem num item.
                // Vinte já é mais escolha do que qualquer cardápio oferece, e
                // o teto existe pelo mesmo motivo do teto da lista — o que é
                // absurdo não chega ao backend.
                const escolhas = Array.isArray(registro.adicionais)
                    ? (registro.adicionais as unknown[]).slice(0, 20)
                    : []

                return {
                    produto_id: Number(registro.produto_id),
                    quantidade: Number(registro.quantidade),
                    observacao: texto(registro.observacao, 200),
                    adicionais: escolhas
                        .map((escolha) => ({
                            opcao_id: Number((escolha as Record<string, unknown>).opcao_id),
                        }))
                        .filter((escolha) => Number.isInteger(escolha.opcao_id) && escolha.opcao_id > 0),
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


        const entrega = {
            tipo: texto(entregaBruta.tipo, 16),
            cep: texto(entregaBruta.cep, 9),
            logradouro: texto(entregaBruta.logradouro, 160),
            numero: texto(entregaBruta.numero, 20),
            complemento: texto(entregaBruta.complemento, 80),
            bairro: texto(entregaBruta.bairro, 80),
            cidade: texto(entregaBruta.cidade, 80),
        }

        const response = await chamarBackend(new URL(`/public/loja/${loja}/pedidos`, API_BASE), {
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
            // A forma só pode ser uma das que este sistema conhece. Quem
            // confere se a LOJA a oferece é o backend — mandar "whatsapp"
            // para uma loja que cobra por gateway é recusado lá, não aqui.
            /* Esta lista é escrita à mão DE PROPÓSITO, ao contrário da que
               monta a loja em lib/loja.ts: aqui o corpo vem do navegador do
               comprador, e repassá-lo inteiro deixaria ele mandar campo que o
               backend não espera — inclusive o valor do frete, que é
               justamente o que não pode vir de fora.
            
               O preço a pagar por essa escolha é este: campo novo precisa ser
               acrescentado aqui, senão some no caminho sem erro nenhum. Foi o
               que aconteceu com a hora do agendamento, com a entrada e com os
               adicionais — as três chegavam da tela e morriam nesta função. */
            body: JSON.stringify({
                itens,
                entrega,
                telefone: texto(entrada.telefone, 24),
                forma: entrada.forma === "whatsapp" ? "whatsapp" : "",

                // A hora marcada pelo cliente. Quem confere se ela cabe na
                // antecedência e na janela da loja é o backend.
                agendado_para: texto(entrada.agendado_para, 40),

                // Pagar só uma parte agora. Quem confere se a loja oferece
                // isso — e quanto é a parte — também é o backend.
                entrada: entrada.entrada === true,
            }),
        },
        // Fechar pedido não para no backend: ele cria a cobrança na
        // InfinitePay, que é um serviço na internet aberta. O teto de dez
        // segundos das outras chamadas cortaria uma cobrança legítima no meio.
        TEMPO_LIMITE_PAGAMENTO)

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
