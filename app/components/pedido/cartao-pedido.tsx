import Link from "next/link"
import { FiCamera, FiChevronRight } from "react-icons/fi"
import type { MeuPedido } from "@/lib/conta"
import { caminhoDaLoja } from "@/lib/caminhos"

/**
 * Um pedido na lista "meus pedidos".
 *
 * O desenho responde à pergunta que a pessoa de fato faz ao abrir essa tela —
 * "cadê o meu e em que pé está?" —, nesta ordem: a foto do que ela comprou
 * (que é como se reconhece um pedido de relance, muito antes do número), o
 * estado, e só depois o código e os valores.
 */

const MINIATURAS = 4

/**
 * Cada estado ganha uma cor com significado, em vez de todos saírem no mesmo
 * cinza. "Entregue" é o único verde: é o desfecho bom e o que a pessoa procura
 * na lista. "Cancelado" é apagado de propósito — continua legível, mas para de
 * disputar atenção com os pedidos vivos.
 *
 * As cores de estado NÃO vêm do tema do lojista: verde é conclusão e vermelho
 * é problema em qualquer loja, e deixar isso no gosto de cada um faria o mesmo
 * rótulo significar coisas diferentes de vitrine para vitrine.
 */
/**
 * O estado em palavra de gente.
 *
 * O status cru do banco ("confirmado") não é o que a pessoa entende: o que ela
 * quer saber é o que está acontecendo com o pedido dela agora. E o pagamento
 * vem antes de tudo — enquanto ele não entra, o pedido não anda, e é o único
 * caso da lista que depende de alguém.
 */
function rotuloDoPedido(pedido: MeuPedido): string {

    if (pedido.status === "cancelado") return "Cancelado"

    if (pedido.pagamento_status === "aguardando") return "Aguardando pagamento"
    if (pedido.pagamento_status === "recusado") return "Não aprovado"
    if (pedido.pagamento_status === "estornado") return "Estornado"

    switch (pedido.status) {
        case "entregue":
            return "Entregue"
        case "enviado":
            return "A caminho"
        case "confirmado":
            return "Em preparo"
        default:
            return "Recebido"
    }
}

function estiloDoStatus(status: string): string {
    switch (status) {
        case "entregue":
            return "border-[var(--verde)] bg-[var(--verde)] text-white"
        case "enviado":
            return "border-[var(--destaque)] bg-[var(--destaque)] text-[var(--sobre-destaque)]"
        case "confirmado":
            return "border-[var(--destaque)] text-[var(--destaque)]"
        case "cancelado":
            return "border-[var(--linha)] text-[var(--ink-3)]"
        default:
            return "border-[var(--linha)] text-[var(--ink-2)]"
    }
}

function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatarData(iso: string): string {
    const data = new Date(iso)
    return Number.isNaN(data.getTime())
        ? ""
        : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

export default function CartaoPedido({ pedido, slug }: { pedido: MeuPedido; slug: string }) {

    const pecas = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)
    const mostradas = pedido.itens.slice(0, MINIATURAS)
    const restantes = pedido.itens.length - mostradas.length

    return (
        <li>
            {/* O card inteiro é o link. Numa lista, alvo pequeno ("ver
                detalhes") é o que faz errar o toque no celular. */}
            <Link
                href={caminhoDaLoja(slug, `pedido/${pedido.codigo}`)}
                className="card card-hover group block"
            >

                {/* Faixa de cabeçalho: identificação à esquerda, estado à
                    direita. Fundo levemente destacado para separar do corpo
                    sem precisar de mais uma borda. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--linha)] bg-[var(--placa)] px-3 py-2.5 sm:px-4">

                    <div className="flex items-baseline gap-2">
                        <span className="rotulo text-[var(--ink-3)]">Pedido</span>
                        <span className="num text-[0.95rem] font-bold tracking-[0.12em] text-[var(--ink)]">
                            {pedido.codigo}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[0.75rem] text-[var(--ink-3)]">
                            {formatarData(pedido.created_at)}
                        </span>
                        <span
                            className={`border px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide ${
                                pedido.pagamento_status === "aguardando"
                                    ? "border-[var(--linha)] text-[var(--ink-2)]"
                                    : estiloDoStatus(pedido.status)
                            }`}
                        >
                            {rotuloDoPedido(pedido)}
                        </span>
                    </div>

                </div>

                {/* Enrola no celular: miniaturas e nome ficam na primeira
                    linha (é assim que se reconhece o pedido), e o total desce
                    para uma linha só dele. Numa tela de 360px os três lado a
                    lado espremiam o nome do produto até sobrar uma sílaba. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-3 py-3.5 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-4">

                    {/* As miniaturas. É por elas que a pessoa reconhece o
                        pedido — o número de seis dígitos ninguém decora. */}
                    <div className="flex shrink-0 -space-x-2">
                        {mostradas.map((item, indice) => (
                            <span
                                key={`${item.produto_id}-${indice}`}
                                className="flex h-12 w-12 items-center justify-center overflow-hidden border border-[var(--linha)] bg-[var(--placa)] sm:h-14 sm:w-14"
                                style={{ zIndex: MINIATURAS - indice }}
                            >
                                {item.produto_imagem_url ? (
                                    <img
                                        src={item.produto_imagem_url}
                                        alt={item.produto_nome}
                                        loading="lazy"
                                        className="h-full w-full object-contain p-1"
                                    />
                                ) : (
                                    <FiCamera className="w-4 text-[var(--ink-3)]" aria-hidden />
                                )}
                            </span>
                        ))}

                        {restantes > 0 ? (
                            <span className="num flex h-12 w-12 items-center justify-center border border-[var(--linha)] bg-[var(--placa-forte)] text-[0.8rem] font-semibold text-[var(--ink-2)] sm:h-14 sm:w-14">
                                +{restantes}
                            </span>
                        ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.85rem] text-[var(--ink)]">
                            {mostradas[0]?.produto_nome ?? "—"}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-[var(--ink-3)]">
                            {pecas} {pecas === 1 ? "peça" : "peças"}
                            {pedido.itens.length > 1 ? ` · ${pedido.itens.length} produtos` : ""}
                        </p>
                    </div>

                    <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-[var(--linha-suave)] pt-3 sm:w-auto sm:justify-end sm:border-0 sm:pt-0 sm:text-right">
                        <div className="flex items-baseline gap-2 sm:block">
                            <p className="rotulo text-[var(--ink-3)]">Total</p>
                            <p className="preco leading-tight">{formatarMoeda(pedido.total)}</p>
                        </div>

                        <FiChevronRight
                            className="w-5 shrink-0 text-[var(--ink-3)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--destaque)]"
                            aria-hidden
                        />
                    </div>

                </div>

            </Link>
        </li>
    )
}
