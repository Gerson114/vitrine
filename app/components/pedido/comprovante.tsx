"use client"

import { useLoja } from "@/app/loja/loja-context"
import { useConta } from "@/app/conta/conta-context"
import { telefoneLegivel } from "@/lib/contato"
import type { PedidoStatus } from "@/app/type/type"

/**
 * O comprovante do pedido — o documento que sai na impressora.
 *
 * É um documento próprio, e não a tela com o menu escondido. A diferença não
 * é estética: o papel responde a outra pergunta. Na tela, quem lê já sabe de
 * quem é o pedido e o que está esperando; no papel, o documento vai parar
 * dentro da caixa, no arquivo de quem comprou ou na mão de um terceiro — e aí
 * ele precisa dizer sozinho de que loja é, de quem é, o que foi comprado, por
 * quanto e quando. Nada disso é óbvio fora do navegador.
 *
 * O que ele NÃO é está escrito nele: não é nota fiscal. Um comprovante que se
 * parece com documento fiscal sem ser é o tipo de coisa que cria problema
 * para a loja — e para quem guardou achando que tinha nota.
 *
 * O CÓDIGO DE RETIRADA NÃO ENTRA AQUI, e a ausência é a decisão. Este papel
 * vai parar dentro da caixa, no arquivo de quem comprou ou na mão de um
 * terceiro — é justamente o que está escrito acima —, e um código de retirada
 * impresso num papel que circula deixa de provar que quem está no balcão é
 * quem comprou. Ele mora na tela do pedido, que pede sessão para abrir.
 *
 * Fora da impressão, este bloco não existe na tela (ver `.so-impressao` em
 * globals.css).
 */

const ROTULO_STATUS: Record<string, string> = {
    pendente: "Recebido",
    confirmado: "Em preparo",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
}

const ROTULO_PAGAMENTO: Record<string, string> = {
    aguardando: "Aguardando confirmação",
    aprovado: "Confirmado",
    recusado: "Não aprovado",
    estornado: "Estornado",
}

/** O meio de pagamento em português, para o papel. */
const METODOS: Record<string, string> = {
    pix: "Pix",
    bank_transfer: "Pix",
    credit_card: "Cartão de crédito",
    card: "Cartão",
    debit_card: "Cartão de débito",
    ticket: "Boleto",
    boleto: "Boleto",
    account_money: "Saldo da carteira",
}

function moeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function dataHora(iso?: string): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function data(iso?: string): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("pt-BR")
}

/** Uma linha "rótulo: valor" do quadro de dados. */
function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-2 py-[0.15rem] text-[0.78rem] leading-snug">
            <span className="w-[7.5rem] shrink-0 text-[#555]">{rotulo}</span>
            <span className="min-w-0 flex-1 text-black">{children}</span>
        </div>
    )
}

export default function ComprovantePedido({ pedido }: { pedido: PedidoStatus }) {

    const loja = useLoja()
    const cliente = useConta()

    const temEntrega = pedido.entrega_tipo === "entrega"

    const subtotal = pedido.itens.reduce(
        (soma, item) => soma + item.quantidade * item.preco_unitario,
        0,
    )

    const frete = pedido.frete ?? 0
    const pecas = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)

    return (
        <div className="so-impressao text-black">

            {/* ==========================================================
                CABEÇALHO — de que loja é este papel
               ========================================================== */}
            <div className="flex items-start justify-between gap-8 border-b-2 border-black pb-3">

                <div className="min-w-0">
                    <p className="text-[1.05rem] font-bold uppercase tracking-[0.06em]">
                        {loja.nome}
                    </p>

                    <div className="mt-1 space-y-[0.1rem] text-[0.72rem] leading-snug text-[#333]">
                        {loja.cnpj ? <p>CNPJ {loja.cnpj}</p> : null}
                        {loja.endereco ? <p>{loja.endereco}</p> : null}

                        {loja.whatsapp || loja.telefone ? (
                            <p>
                                {loja.whatsapp ? `WhatsApp ${telefoneLegivel(loja.whatsapp)}` : ""}
                                {loja.whatsapp && loja.telefone ? " · " : ""}
                                {loja.telefone ? `Tel. ${loja.telefone}` : ""}
                            </p>
                        ) : null}

                        {loja.horario ? <p>{loja.horario}</p> : null}
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#555]">
                        Comprovante de pedido
                    </p>

                    <p className="mt-0.5 text-[1.35rem] font-bold leading-none tracking-[0.1em]">
                        {pedido.codigo}
                    </p>

                    {/* A hora da impressão, e não a do pedido: é o que
                        diferencia duas vias do mesmo comprovante. Vem do
                        relógio de quem imprime, então o texto do servidor e o
                        do navegador podem cair em minutos diferentes — daí o
                        suppressHydrationWarning, que é exatamente o caso de
                        uso dele. */}
                    <p className="mt-1 text-[0.68rem] text-[#555]" suppressHydrationWarning>
                        Emitido em {dataHora(new Date().toISOString())}
                    </p>
                </div>

            </div>

            {/* ==========================================================
                QUADROS — o pedido e quem comprou, lado a lado
               ========================================================== */}
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">

                <div>
                    <p className="mb-1 border-b border-[#999] pb-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#555]">
                        O pedido
                    </p>

                    <Linha rotulo="Feito em">{dataHora(pedido.created_at)}</Linha>
                    <Linha rotulo="Situação">{ROTULO_STATUS[pedido.status] ?? pedido.status}</Linha>

                    {pedido.pagamento_status ? (
                        <Linha rotulo="Pagamento">
                            {ROTULO_PAGAMENTO[pedido.pagamento_status] ?? pedido.pagamento_status}
                            {pedido.pagamento_metodo ? ` · ${METODOS[pedido.pagamento_metodo] ?? pedido.pagamento_metodo}` : ""}
                            {pedido.pago_em ? ` em ${dataHora(pedido.pago_em)}` : ""}
                        </Linha>
                    ) : null}

                    <Linha rotulo="Modalidade">
                        {temEntrega ? "Entrega no endereço" : "Retirada na loja"}
                    </Linha>

                    {temEntrega && pedido.previsao_entrega && pedido.status !== "entregue" ? (
                        <Linha rotulo="Previsão">{data(pedido.previsao_entrega)}</Linha>
                    ) : null}

                    {pedido.enviado_em ? (
                        <Linha rotulo="Despachado em">{data(pedido.enviado_em)}</Linha>
                    ) : null}
                </div>

                <div>
                    <p className="mb-1 border-b border-[#999] pb-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#555]">
                        {temEntrega ? "Entregar a" : "Retirada por"}
                    </p>

                    {cliente?.nome ? <Linha rotulo="Nome">{cliente.nome}</Linha> : null}
                    {cliente?.email ? <Linha rotulo="E-mail">{cliente.email}</Linha> : null}

                    {pedido.telefone ? (
                        <Linha rotulo="Telefone">{telefoneLegivel(pedido.telefone)}</Linha>
                    ) : null}

                    {temEntrega ? (
                        <>
                            <Linha rotulo="Endereço">
                                {pedido.logradouro}, {pedido.numero}
                                {pedido.complemento ? ` — ${pedido.complemento}` : ""}
                            </Linha>

                            <Linha rotulo="Bairro">
                                {pedido.bairro} · {pedido.cidade}
                                {pedido.uf ? `/${pedido.uf}` : ""}
                            </Linha>

                            {pedido.cep ? <Linha rotulo="CEP">{pedido.cep}</Linha> : null}
                        </>
                    ) : (
                        <Linha rotulo="Local">
                            {loja.endereco || "Na loja"}
                        </Linha>
                    )}
                </div>

            </div>

            {/* ==========================================================
                ITENS
               ========================================================== */}
            <table className="mt-5 w-full border-collapse text-[0.78rem]">

                <thead>
                    <tr className="border-y border-[#999] text-left text-[0.68rem] uppercase tracking-[0.08em] text-[#555]">
                        <th className="py-1.5 pr-2 font-bold">Cód.</th>
                        <th className="py-1.5 pr-2 font-bold">Produto</th>
                        <th className="py-1.5 pr-2 text-right font-bold">Qtd.</th>
                        <th className="py-1.5 pr-2 text-right font-bold">Preço un.</th>
                        <th className="py-1.5 text-right font-bold">Total</th>
                    </tr>
                </thead>

                <tbody>
                    {pedido.itens.map((item) => (
                        <tr key={item.id} className="border-b border-[#DDD] align-top">

                            <td className="py-1.5 pr-2 whitespace-nowrap text-[#555]">
                                {item.produto_codigo || "—"}
                            </td>

                            <td className="py-1.5 pr-2">
                                {item.produto_nome || `Produto #${item.produto_id}`}

                                {item.produto_variacao ? (
                                    <span className="text-[#555]">
                                        {" — "}
                                        {item.produto_variacao_rotulo
                                            ? `${item.produto_variacao_rotulo}: `
                                            : ""}
                                        {item.produto_variacao}
                                    </span>
                                ) : null}
                            </td>

                            <td className="py-1.5 pr-2 text-right">{item.quantidade}</td>

                            <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                                {moeda(item.preco_unitario)}
                            </td>

                            <td className="py-1.5 text-right whitespace-nowrap">
                                {moeda(item.quantidade * item.preco_unitario)}
                            </td>

                        </tr>
                    ))}
                </tbody>

            </table>

            {/* ==========================================================
                TOTAIS — encostados à direita, como em qualquer nota
               ========================================================== */}
            <div className="mt-3 flex justify-end">
                <div className="w-[15rem]">

                    <div className="flex justify-between py-0.5 text-[0.78rem]">
                        <span className="text-[#555]">
                            Produtos ({pecas} {pecas === 1 ? "peça" : "peças"})
                        </span>
                        <span>{moeda(subtotal)}</span>
                    </div>

                    <div className="flex justify-between py-0.5 text-[0.78rem]">
                        <span className="text-[#555]">Frete</span>
                        <span>{frete > 0 ? moeda(frete) : temEntrega ? "Grátis" : "—"}</span>
                    </div>

                    <div className="mt-1 flex justify-between border-t-2 border-black pt-1.5 text-[0.95rem] font-bold">
                        <span>Total</span>
                        <span>{moeda(subtotal + frete)}</span>
                    </div>

                </div>
            </div>

            {/* ==========================================================
                ENVIO
               ========================================================== */}
            {pedido.codigo_rastreio ? (
                <div className="mt-5 border border-[#999] px-3 py-2">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#555]">
                        Envio
                    </p>

                    <p className="mt-1 text-[0.78rem]">
                        {pedido.transportadora ? `${pedido.transportadora} · ` : ""}
                        Rastreio <span className="font-bold tracking-[0.06em]">{pedido.codigo_rastreio}</span>
                        {pedido.enviado_em ? ` · despachado em ${data(pedido.enviado_em)}` : ""}
                    </p>
                </div>
            ) : null}

            {/* ==========================================================
                RODAPÉ — o que este papel é, e o que ele não é
               ========================================================== */}
            <div className="mt-6 border-t border-[#999] pt-2 text-[0.68rem] leading-relaxed text-[#555]">
                <p>
                    Este documento é um comprovante do pedido emitido pela loja e{" "}
                    <strong className="font-bold">não substitui a nota fiscal</strong>.
                </p>

                {/* Sem endereço de site escrito aqui: a vitrine é servida
                    em domínio próprio de cada loja, e um endereço montado a
                    partir do navegador de quem imprime sairia errado no papel
                    de quem lê. O número do pedido é o que abre a página, e é
                    ele que precisa estar legível. */}
                <p className="mt-0.5">
                    Guarde o número {pedido.codigo}: é por ele que você acompanha este
                    pedido no site da loja e fala sobre esta compra.
                </p>
            </div>

        </div>
    )
}
