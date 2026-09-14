"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import {
    FiAlertCircle,
    FiArrowLeft,
    FiCheck,
    FiPrinter,
    FiRotateCcw,
    FiCheckCircle,
    FiClock,
    FiCopy,
    FiCreditCard,
    FiHome,
    FiMapPin,
    FiMessageCircle,
    FiPackage,
    FiPhone,
    FiTruck,
    FiX,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import Header from "@/app/components/header/header"
import Footer from "@/app/components/footer/footer"
import { useLoja } from "@/app/loja/loja-context"
import { useCarrinho } from "@/app/cart/cart-context"
import { caminhoDaLoja } from "@/lib/caminhos"
import type { Produto } from "@/app/type/type"
import { linkWhatsapp } from "@/lib/contato"
import AvaliarPedido from "@/app/components/avaliacao/avaliar-pedido"
import PedirDevolucao from "@/app/components/pedido/devolucao"
import ComprovantePedido from "@/app/components/pedido/comprovante"
import type { PedidoStatus, StatusPedido } from "@/app/type/type"

/**
 * Acompanhar pedido.
 *
 * A tela responde, nesta ordem, às três perguntas de quem a abre: **em que pé
 * está**, **o que eu comprei** e **para onde vai** — e, antes de todas elas
 * quando o dinheiro ainda não entrou, **o meu pagamento caiu?**
 *
 * O pagamento tem cartão próprio porque é a única parte desta página em que a
 * pessoa pode PRECISAR fazer alguma coisa: enquanto o provedor não confirma, o
 * pedido está parado, e a loja não começa a preparar. Confirmado o pagamento,
 * o mesmo cartão vira o comprovante — quando entrou e quanto foi —, que é o
 * que ela procura quando desconfia da cobrança no extrato.
 *
 * A linha do tempo começa nesse mesmo fato: a primeira etapa é "Pagamento"
 * enquanto o dinheiro não chega e vira "Recebido" quando chega. As outras três
 * são o trabalho da loja daí para a frente.
 */

/* ==========================================================================
   Formatação
   ========================================================================== */

function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatarData(iso: string): string {
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

/**
 * O meio de pagamento em português.
 *
 * Cada provedor tem o próprio vocabulário ("pix", "credit_card",
 * "bank_transfer"). O que não estiver mapeado sai como veio, e não some: um
 * meio novo apareceria como "boleto_flex" na tela — feio, mas verdadeiro, e
 * melhor do que o comprovante esconder como ele pagou.
 */
function nomeDoMetodo(bruto: string): string {

    const nomes: Record<string, string> = {
        pix: "Pix",
        bank_transfer: "Pix",
        credit_card: "Cartão de crédito",
        card: "Cartão",
        debit_card: "Cartão de débito",
        ticket: "Boleto",
        boleto: "Boleto",
        account_money: "Saldo da carteira",
    }

    return nomes[bruto] ?? bruto
}

/** "06/09" — para caber embaixo de uma bolinha da linha do tempo. */
function formatarDiaMes(iso: string): string {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

/** "6 de setembro" — para as frases, onde o número puro fica seco. */
function formatarDiaPorExtenso(iso: string): string {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
}

/* ==========================================================================
   O estado do pedido, em uma palavra e em uma frase
   ========================================================================== */

/**
 * O que a faixa do cabeçalho diz.
 *
 * Uma palavra para bater o olho e uma frase para entender — a palavra sozinha
 * ("Confirmado") não diz o que está acontecendo agora, que é o que a pessoa
 * abriu a tela para saber.
 */
function resumoDoEstado(pedido: PedidoStatus, temEntrega: boolean): {
    rotulo: string
    frase: string
    estilo: string
} {

    if (pedido.status === "cancelado") {
        return {
            rotulo: "Cancelado",
            frase: "Este pedido foi cancelado.",
            estilo: "border-[var(--linha)] text-[var(--ink-3)]",
        }
    }

    if (pedido.pagamento_status === "aguardando") {
        return {
            rotulo: "Aguardando pagamento",
            frase: "A loja começa a preparar assim que o pagamento for confirmado.",
            estilo: "border-[var(--linha)] text-[var(--ink-2)]",
        }
    }

    if (pedido.pagamento_status === "recusado") {
        return {
            rotulo: "Pagamento não aprovado",
            frase: "O pagamento não foi autorizado, e o pedido não seguiu.",
            estilo: "border-[var(--vermelho)] text-[var(--vermelho)]",
        }
    }

    if (pedido.pagamento_status === "estornado") {
        return {
            rotulo: "Pagamento estornado",
            frase: "O valor foi devolvido e o pedido não vai ser entregue.",
            estilo: "border-[var(--vermelho)] text-[var(--vermelho)]",
        }
    }

    switch (pedido.status) {
        case "entregue":
            return {
                rotulo: temEntrega ? "Entregue" : "Retirado",
                frase: "Pedido concluído. Obrigado pela compra!",
                estilo: "border-[var(--verde)] bg-[var(--verde)] text-white",
            }
        case "enviado":
            return {
                rotulo: temEntrega ? "A caminho" : "Pronto para retirar",
                frase: temEntrega
                    ? "Seu pedido saiu da loja e está a caminho do endereço."
                    : "Seu pedido está separado e esperando você na loja.",
                estilo: "border-[var(--destaque)] bg-[var(--destaque)] text-[var(--sobre-destaque)]",
            }
        case "confirmado":
            return {
                rotulo: "Em preparo",
                frase: "A loja recebeu o pagamento e está preparando seu pedido.",
                estilo: "border-[var(--destaque)] text-[var(--destaque)]",
            }
        default:
            return {
                rotulo: "Recebido",
                frase: "Seu pedido chegou à loja e entrou na fila.",
                estilo: "border-[var(--destaque)] text-[var(--destaque)]",
            }
    }
}

/* ==========================================================================
   A linha do tempo
   ========================================================================== */

interface Etapa {
    chave: string
    rotulo: string
    Icone: IconType
    /** A data em que esta etapa aconteceu, quando o servidor a conhece. */
    data?: string
}

/**
 * As quatro etapas, já com os rótulos que valem para ESTE pedido.
 *
 * A primeira muda com o dinheiro: é "Pagamento" enquanto ele não entra e
 * "Recebido" depois que entra — a mesma casa, porque é o mesmo passo visto
 * antes e depois de acontecer. As duas últimas mudam com a forma de entrega:
 * quem vem buscar não recebe "Enviado" nem "Entregue", recebe "Pronto" e
 * "Retirado".
 */
function etapasDoPedido(pedido: PedidoStatus, temEntrega: boolean, semPagamento: boolean): Etapa[] {
    return [
        {
            chave: "recebido",
            rotulo: semPagamento ? "Pagamento" : "Recebido",
            Icone: semPagamento ? FiCreditCard : FiCheck,
            data: pedido.pago_em ?? (semPagamento ? undefined : pedido.created_at),
        },
        {
            chave: "confirmado",
            rotulo: "Em preparo",
            Icone: FiPackage,
        },
        {
            chave: "enviado",
            rotulo: temEntrega ? "Enviado" : "Pronto",
            Icone: FiTruck,
            data: pedido.enviado_em,
        },
        {
            chave: "entregue",
            rotulo: temEntrega ? "Entregue" : "Retirado",
            Icone: FiHome,
            data: pedido.status === "entregue" ? pedido.updated_at : undefined,
        },
    ]
}

const ORDEM: Record<StatusPedido, number> = {
    pendente: 0,
    confirmado: 1,
    enviado: 2,
    entregue: 3,
    cancelado: -1,
}

/* ==========================================================================
   A tela
   ========================================================================== */

export default function PedidoPage() {
    const params = useParams<{ codigo: string }>()
    const codigo = params.codigo
    const loja = useLoja()

    const [contato, setContato] = useState("")
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState("")
    const [pedido, setPedido] = useState<PedidoStatus | null>(null)
    const [verificandoSessao, setVerificandoSessao] = useState(true)
    const [conferindoPagamento, setConferindoPagamento] = useState(false)
    const [copiado, setCopiado] = useState(false)

    // Cancelar é em dois toques: o primeiro troca o botão pela pergunta. Não é
    // ceremônia — é que o botão fica ao lado do "comprar de novo", e desfazer
    // um pedido por engano de dedo não tem volta pela tela.
    const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
    const [cancelando, setCancelando] = useState(false)

    const [repetindo, setRepetindo] = useState("")

    const { adicionar, abrir } = useCarrinho()

    // Evita conferir duas vezes o mesmo pedido: o efeito roda duas vezes em
    // desenvolvimento (StrictMode), e a consulta ao provedor não é de graça.
    const jaConferiu = useRef("")

    // O que o provedor devolveu na URL de retorno.
    //
    // A InfinitePay volta com ?transaction_nsu=…&slug=…&order_nsu=… e exige os
    // três para responder qualquer consulta. Este é o ÚNICO momento em que
    // este sistema os enxerga quando o aviso automático dela não chega — o que
    // acontece sempre que a loja roda num endereço que a internet não alcança.
    // Guardá-los agora é o que faz o pagamento ser confirmado mesmo assim.
    //
    // Nada aqui afirma que algo foi pago: os dois valores viajam até o
    // servidor, que pergunta ao provedor e confere o valor contra os itens
    // gravados. É o endereço da pergunta, não a resposta.
    const parametros = useSearchParams()
    const daVolta = useRef({
        transacao: parametros.get("transaction_nsu") ?? "",
        fatura: parametros.get("slug") ?? "",
    })

    async function buscarPedido(contatoDigitado?: string): Promise<boolean> {
        const response = await fetch("/api/pedido", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // A loja vai junto: um código só é encontrado na vitrine em que
            // a compra foi feita.
            body: JSON.stringify({ loja: loja.slug, codigo, contato: contatoDigitado ?? "" }),
        })

        const dados = await response.json().catch(() => null)

        if (!response.ok) return false

        setPedido((dados as { pedido: PedidoStatus }).pedido)
        return true
    }

    /**
     * Pergunta ao servidor se o pagamento entrou.
     *
     * O provedor deveria avisar sozinho, mas esse aviso se perde — e quando se
     * perde, é aqui que a pessoa percebe: acabou de pagar, voltou para a loja
     * e a tela diz "aguardando". Então a página pergunta uma vez, em vez de
     * deixá-la olhando para um estado errado.
     *
     * A página não afirma nada: quem consulta o provedor e confere o valor é o
     * servidor. Daqui só sai o pedido de conferência.
     */
    async function conferirPagamento() {
        setConferindoPagamento(true)

        try {
            const resposta = await fetch("/api/pedido/verificar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    loja: loja.slug,
                    codigo,
                    transacao: daVolta.current.transacao,
                    fatura: daVolta.current.fatura,
                }),
            })

            if (resposta.ok) await buscarPedido()

        } catch {
            // Silêncio de propósito: o pedido continua na tela com o estado
            // que já tinha, e o botão fica disponível para tentar de novo.
        } finally {
            setConferindoPagamento(false)
        }
    }

    useEffect(() => {
        // Se o navegador já provou esse pedido antes, o cookie httpOnly
        // salvo na última consulta libera o acesso sem pedir contato de
        // novo — o servidor decide isso sozinho a partir do cookie. Depende
        // de `codigo` (não só roda no mount) porque navegar de um pedido
        // pro outro sem recarregar a página reaproveita este componente.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset ao trocar de código, não é resultado do fetch
        setVerificandoSessao(true)
        setPedido(null)
        setErro("")

        buscarPedido()
            .catch(() => false)
            .finally(() => setVerificandoSessao(false))

        jaConferiu.current = ""
        // eslint-disable-next-line react-hooks/exhaustive-deps -- buscarPedido é recriada a cada render mas só precisa rodar quando o código muda
    }, [codigo])

    // Chegou na tela aguardando pagamento? Confere uma vez, sozinho.
    //
    // É o caso de quem acabou de voltar do provedor: o aviso automático dele
    // pode não ter chegado ainda (ou nunca chegar), e mostrar "aguardando" a
    // quem acabou de pagar é o pior desfecho possível.
    useEffect(() => {
        if (!pedido) return
        if (pedido.pagamento_status !== "aguardando") return
        if (jaConferiu.current === pedido.codigo) return

        jaConferiu.current = pedido.codigo
        void conferirPagamento()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- conferirPagamento é recriada a cada render; o gatilho é o pedido mudar
    }, [pedido])

    /**
     * Desiste do pedido que ainda não foi pago.
     *
     * Só faz sentido antes do pagamento: depois dele, cancelar é devolução de
     * dinheiro, e o servidor recusa com a mensagem que manda falar com a loja.
     */
    async function cancelar() {

        setCancelando(true)
        setErro("")

        try {
            const resposta = await fetch("/api/pedido/cancelar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ loja: loja.slug, codigo }),
            })

            const dados = await resposta.json().catch(() => null)

            if (!resposta.ok) {
                setErro(
                    dados && typeof dados === "object" && "erro" in dados
                        ? String((dados as { erro: unknown }).erro)
                        : "Não foi possível cancelar o pedido.",
                )
                return
            }

            await buscarPedido()
            setConfirmandoCancelamento(false)

        } catch {
            setErro("Não foi possível cancelar o pedido.")
        } finally {
            setCancelando(false)
        }
    }

    /**
     * Põe de volta na sacola o que este pedido tinha.
     *
     * Os produtos são relidos do catálogo de agora, e não copiados do pedido:
     * preço muda, peça acaba, item sai de linha. Comprar de novo é comprar o
     * que existe hoje pelo preço de hoje — o pedido antigo é histórico, não
     * tabela de preços.
     */
    async function comprarDeNovo() {

        if (!pedido) return

        setRepetindo("carregando")
        setErro("")

        try {
            const resposta = await fetch(`/api/produtos?loja=${encodeURIComponent(loja.slug)}`, {
                cache: "no-store",
            })

            const dados = await resposta.json().catch(() => null)

            const catalogo = (dados as { produtos?: Produto[] } | null)?.produtos ?? []
            const porID = new Map(catalogo.map((produto) => [produto.id, produto]))

            let faltaram = 0

            for (const item of pedido.itens) {

                const produto = porID.get(item.produto_id)

                if (!produto || produto.estoque <= 0) {
                    faltaram += 1
                    continue
                }

                // Uma chamada por peça: quem decide o teto do estoque é o
                // carrinho, e chamá-lo repetido é o mesmo caminho do botão
                // de somar da vitrine.
                for (let i = 0; i < item.quantidade; i += 1) adicionar(produto)
            }

            if (faltaram === pedido.itens.length) {
                setRepetindo("nada")
                return
            }

            setRepetindo(faltaram > 0 ? "parcial" : "")
            abrir()

        } catch {
            setErro("Não foi possível montar a sacola de novo.")
            setRepetindo("")
        }
    }

    async function copiarRastreio(codigoRastreio: string) {
        try {
            await navigator.clipboard.writeText(codigoRastreio)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            // Navegador sem permissão de área de transferência: o código
            // continua na tela para ser copiado à mão.
        }
    }

    async function consultar(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        if (!contato.trim()) {
            setErro("Digite o telefone ou e-mail que você usou no pedido.")
            return
        }

        setEnviando(true)
        setErro("")

        try {
            const encontrou = await buscarPedido(contato.trim())

            if (!encontrou) {
                setErro("Pedido não encontrado. Confira o código e o contato usados na compra.")
            }

        } catch {
            setErro("Não foi possível consultar o pedido. Tente novamente.")
        } finally {
            setEnviando(false)
        }
    }

    if (verificandoSessao) {
        return (
            <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
                <Header />

                <div className="largura flex flex-1 items-center justify-center py-24">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--linha)] border-t-black" />
                </div>

                <Footer />
            </div>
        )
    }

    if (!pedido) {
        return (
            <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
                <Header />

                <main className="largura flex max-w-md flex-col py-12 sm:py-16">

                    <p className="rotulo text-[var(--ink-2)]">Pedido {codigo}</p>

                    <h1 className="mt-2 text-[1.45rem] font-light leading-tight text-[var(--ink)] sm:text-[1.75rem]">
                        <strong className="font-bold">Confirme</strong> seu contato
                    </h1>

                    <p className="mt-2 text-[0.88rem] text-[var(--ink-2)]">
                        Para ver este pedido, digite o telefone ou e-mail que você usou na
                        hora da compra.
                    </p>

                    <form onSubmit={consultar} className="mt-8">
                        <label htmlFor="contato" className="rotulo-campo">Telefone ou e-mail</label>

                        <input
                            id="contato"
                            type="text"
                            value={contato}
                            onChange={(e) => setContato(e.target.value)}
                            placeholder="Telefone ou e-mail do pedido"
                            maxLength={120}
                            className="campo"
                        />

                        {erro ? (
                            <p className="mt-3 border-l-2 border-[var(--vermelho)] bg-[var(--erro-fundo)] px-3 py-2 text-xs text-[var(--vermelho)]">
                                {erro}
                            </p>
                        ) : null}

                        <button type="submit" disabled={enviando} className="btn mt-5 w-full py-3.5">
                            {enviando ? "consultando..." : "ver pedido"}
                        </button>
                    </form>

                </main>

                <Footer />
            </div>
        )
    }

    const subtotal = pedido.itens.reduce((soma, item) => soma + item.quantidade * item.preco_unitario, 0)

    // O frete cobrado, congelado no fechamento do pedido. Zero nos pedidos
    // anteriores à entrega existir, e nos que são retirada no balcão.
    const frete = pedido.frete ?? 0
    const total = subtotal + frete

    const pecas = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)

    const temEntrega = pedido.entrega_tipo === "entrega"
    const cancelado = pedido.status === "cancelado"

    // Pedido antigo (de antes de existir pagamento no sistema) e pedido que o
    // lojista lançou à mão vêm com o campo vazio: eles nunca esperaram
    // pagamento nenhum, e não devem mostrar cartão de pagamento.
    const temPagamento = Boolean(pedido.pagamento_status)
    const aguardandoPagamento = pedido.pagamento_status === "aguardando"
    const pagamentoAprovado = pedido.pagamento_status === "aprovado"
    const pagamentoNegado = pedido.pagamento_status === "recusado" || pedido.pagamento_status === "estornado"

    // O link já leva a mensagem escrita: o cliente que precisa de ajuda não
    // deve ter de explicar de qual pedido está falando, e a loja não deve ter
    // de perguntar.
    const conversa = linkWhatsapp(
        loja.whatsapp,
        `Olá! Preciso de ajuda com o meu pedido ${pedido.codigo}.`,
    )

    const estado = resumoDoEstado(pedido, temEntrega)

    // Pagamento pendente e pagamento negado param a linha do tempo no mesmo
    // lugar: nos dois casos o dinheiro não está com a loja, e marcar
    // "Recebido" como concluída diria o contrário do cartão de pagamento logo
    // ao lado.
    const semPagamento = aguardandoPagamento || pagamentoNegado

    const etapas = etapasDoPedido(pedido, temEntrega, semPagamento)

    // Enquanto o dinheiro não entra, nenhuma etapa está concluída: o pedido
    // existe, mas ainda não começou a andar. Com o pagamento resolvido, o
    // andamento é o status que a loja gravou.
    const etapaAtual = semPagamento ? -1 : ORDEM[pedido.status]

    return (
        <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
            <Header />

            <main className="pagina-pedido largura py-6 sm:py-10">

                {/* O documento que sai na impressora. Não aparece na tela: é
                    outro desenho, para outra pergunta — o papel vai parar
                    dentro da caixa ou no arquivo de quem comprou, e precisa
                    dizer sozinho de que loja é e de quem é. */}
                <ComprovantePedido pedido={pedido} />

                <Link
                    href={caminhoDaLoja(loja.slug)}
                    className="nao-imprime inline-flex items-center gap-1.5 text-[0.8rem] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
                >
                    <FiArrowLeft className="w-3.5" aria-hidden />
                    voltar à vitrine
                </Link>

                {/* ==========================================================
                    CABEÇALHO — quem é o pedido e em que pé ele está
                   ========================================================== */}
                <header className="mt-3 border border-[var(--linha)]">

                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-5 sm:px-7 sm:py-6">

                        <div>
                            <p className="rotulo text-[var(--ink-3)]">Acompanhar pedido</p>

                            <p className="num mt-1.5 text-2xl font-bold leading-none tracking-[0.14em] text-[var(--ink)] sm:text-[1.85rem]">
                                {pedido.codigo}
                            </p>

                            <p className="mt-2 text-[0.78rem] text-[var(--ink-3)]">
                                Feito em {formatarData(pedido.created_at)} · {pecas}{" "}
                                {pecas === 1 ? "peça" : "peças"}
                            </p>
                        </div>

                        <div className="max-w-[19rem] sm:text-right">
                            <span
                                className={`inline-block border px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] ${estado.estilo}`}
                            >
                                {estado.rotulo}
                            </span>

                            <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                                {estado.frase}
                            </p>
                        </div>

                    </div>

                    {/* A LINHA DO TEMPO */}
                    <div className="px-4 py-6 sm:px-7 sm:py-7">

                        {cancelado ? (
                            <div className="flex items-center gap-3 border-l-2 border-[var(--vermelho)] bg-[var(--erro-fundo)] px-4 py-3.5">
                                <FiX className="w-5 shrink-0 text-[var(--vermelho)]" aria-hidden />
                                <div>
                                    <p className="text-[0.88rem] font-semibold text-[var(--vermelho)]">
                                        Pedido cancelado
                                    </p>
                                    <p className="text-[0.75rem] text-[var(--vermelho)]/80">
                                        Atualizado em {formatarData(pedido.updated_at)}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <ol className="grid grid-cols-4 gap-1 sm:gap-2">
                                {etapas.map((etapa, indice) => {

                                    const concluida = indice <= etapaAtual

                                    // A etapa que está para acontecer ganha um
                                    // contorno em vez de preenchimento: é o
                                    // que separa "já foi" de "é o próximo
                                    // passo" sem inventar uma terceira cor.
                                    const atual = indice === etapaAtual + 1

                                    return (
                                        <li key={etapa.chave} className="relative flex flex-col items-center text-center">

                                            {indice < etapas.length - 1 ? (
                                                <span
                                                    aria-hidden
                                                    className={`absolute left-1/2 top-[1.125rem] h-px w-full sm:top-5 ${
                                                        indice < etapaAtual ? "bg-[var(--destaque)]" : "bg-[var(--linha)]"
                                                    }`}
                                                />
                                            ) : null}

                                            <span
                                                className={`relative z-10 flex h-9 w-9 items-center justify-center border sm:h-10 sm:w-10 ${
                                                    concluida
                                                        ? "border-[var(--destaque)] bg-[var(--destaque)] text-[var(--sobre-destaque)]"
                                                        : atual
                                                            ? "border-[var(--destaque)] bg-[var(--fundo)] text-[var(--destaque)]"
                                                            : "border-[var(--linha)] bg-[var(--placa)] text-[var(--ink-3)]"
                                                }`}
                                            >
                                                <etapa.Icone className="w-4" aria-hidden />
                                            </span>

                                            <p
                                                className={`mt-2 text-[0.68rem] leading-tight sm:text-[0.74rem] ${
                                                    concluida || atual
                                                        ? "font-semibold text-[var(--ink)]"
                                                        : "text-[var(--ink-3)]"
                                                }`}
                                            >
                                                {etapa.rotulo}
                                            </p>

                                            {/* A data só aparece no que já
                                                aconteceu: data em etapa futura
                                                seria promessa, e esta tela não
                                                promete nada que a loja não
                                                tenha gravado. */}
                                            {concluida && etapa.data ? (
                                                <p className="num mt-0.5 text-[0.66rem] text-[var(--ink-3)]">
                                                    {formatarDiaMes(etapa.data)}
                                                </p>
                                            ) : null}

                                        </li>
                                    )
                                })}
                            </ol>
                        )}

                    </div>

                </header>

                {/* ==========================================================
                    O CORPO — itens e entrega de um lado, dinheiro do outro.

                    No celular vira uma coluna só, e o pagamento sobe para o
                    topo dela: quando ele está pendente, é a única coisa desta
                    tela que depende de alguém.
                   ========================================================== */}
                <div className="imprime-em-coluna mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">

                    <div className="order-2 flex flex-col gap-4 lg:order-1">

                        {/* ITENS */}
                        <section className="border border-[var(--linha)]">

                            <h2 className="rotulo border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-3 text-[var(--ink-2)] sm:px-6">
                                Itens do pedido
                            </h2>

                            <ul className="divide-y divide-[var(--linha-suave)] px-5 sm:px-6">
                                {pedido.itens.map((item) => (
                                    <li key={item.id} className="flex items-start justify-between gap-4 py-4">

                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="num mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center border border-[var(--linha)] px-1 text-[0.72rem] font-bold text-[var(--ink-2)]">
                                                {item.quantidade}
                                            </span>

                                            <div className="min-w-0">
                                                <p className="text-[0.88rem] leading-snug text-[var(--ink)]">
                                                    {item.produto_nome || `Produto #${item.produto_id}`}
                                                </p>

                                                {item.quantidade > 1 ? (
                                                    <p className="num mt-1 text-[0.75rem] text-[var(--ink-3)]">
                                                        {formatarMoeda(item.preco_unitario)} cada
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <span className="num shrink-0 text-[0.88rem] font-semibold text-[var(--ink)]">
                                            {formatarMoeda(item.quantidade * item.preco_unitario)}
                                        </span>

                                    </li>
                                ))}
                            </ul>

                        </section>

                        {/* AVALIAÇÃO

                            Só no pedido entregue: antes disso a pessoa não
                            viu a mercadoria, e o que ela tem a dizer é sobre
                            o atendimento — para isso existe o chat. */}
                        {pedido.status === "entregue" ? (
                            <AvaliarPedido
                                loja={loja.slug}
                                codigo={pedido.codigo}
                                itens={pedido.itens}
                            />
                        ) : null}

                        {/* ALGUM PROBLEMA COM ESTE PEDIDO?

                            Logo depois do que foi comprado, porque é sobre
                            isso que ela fala. Só abre pedido de devolução em
                            dois casos — o pacote que não chegou no prazo e o
                            que chegou danificado —, e manda falar com a loja
                            para todo o resto. O componente se esconde sozinho
                            no pedido que ainda não foi pago: lá a saída é o
                            cancelamento, que fica no rodapé desta página. */}
                        <PedirDevolucao
                            loja={loja.slug}
                            codigo={pedido.codigo}
                            pedido={pedido}
                            conversa={conversa}
                            whatsapp={loja.whatsapp}
                            aoAtualizar={async () => { await buscarPedido() }}
                        />

                        {/* ENTREGA E RASTREIO */}
                        {temEntrega || pedido.codigo_rastreio || pedido.entrega_tipo ? (
                            <section className="border border-[var(--linha)]">

                                <h2 className="rotulo border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-3 text-[var(--ink-2)] sm:px-6">
                                    {temEntrega ? "Entrega" : "Retirada"}
                                </h2>

                                <div className="px-5 py-5 sm:px-6">

                                    {temEntrega ? (
                                        <address className="not-italic text-[0.88rem] leading-relaxed text-[var(--ink)]">
                                            {pedido.logradouro}, {pedido.numero}
                                            {pedido.complemento ? ` — ${pedido.complemento}` : ""}
                                            <br />
                                            {pedido.bairro} · {pedido.cidade}
                                            {pedido.uf ? `/${pedido.uf}` : ""}
                                            {pedido.cep ? (
                                                <>
                                                    <br />
                                                    <span className="num text-[var(--ink-2)]">CEP {pedido.cep}</span>
                                                </>
                                            ) : null}
                                        </address>
                                    ) : (
                                        <div className="text-[0.88rem] text-[var(--ink)]">
                                            <p>Você retira este pedido na loja.</p>

                                            {/* Onde e até que horas. Sem isto,
                                                a tela mandava a pessoa buscar
                                                sem dizer onde — e ela ia
                                                procurar a loja no Instagram. */}
                                            {loja.endereco ? (
                                                <p className="mt-3 flex items-start gap-2 leading-relaxed text-[var(--ink-2)]">
                                                    <FiMapPin className="mt-1 w-3.5 shrink-0" aria-hidden />
                                                    {loja.endereco}
                                                </p>
                                            ) : null}

                                            {loja.horario ? (
                                                <p className="mt-1.5 flex items-start gap-2 leading-relaxed text-[var(--ink-2)]">
                                                    <FiClock className="mt-1 w-3.5 shrink-0" aria-hidden />
                                                    {loja.horario}
                                                </p>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* Quando chega. A previsão vem calculada
                                        do servidor: enquanto o pedido não sai,
                                        ela conta do pagamento e é estimativa;
                                        depois do despacho, conta do dia em que
                                        ele saiu. Refazer essa conta aqui seria
                                        ter duas versões dela para divergirem. */}
                                    {temEntrega && pedido.status !== "entregue" ? (
                                        <div className="mt-4 border-t border-[var(--linha-suave)] pt-4">
                                            {pedido.previsao_entrega ? (
                                                <p className="text-[0.85rem] text-[var(--ink)]">
                                                    Previsão de chegada:{" "}
                                                    <strong className="font-semibold">
                                                        {formatarDiaPorExtenso(pedido.previsao_entrega)}
                                                    </strong>
                                                </p>
                                            ) : pedido.prazo_dias ? (
                                                <p className="text-[0.85rem] text-[var(--ink)]">
                                                    Prazo combinado: até {pedido.prazo_dias} dia(s) depois do envio.
                                                </p>
                                            ) : null}

                                            {pedido.envio_previsto_em && !pedido.enviado_em ? (
                                                <p className="mt-1 text-[0.78rem] text-[var(--ink-3)]">
                                                    A loja separou o dia {formatarDiaPorExtenso(pedido.envio_previsto_em)} para despachar.
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {pedido.codigo_rastreio ? (
                                        <div className="mt-4 border-l-2 border-[var(--destaque)] bg-[var(--placa)] px-4 py-3.5">
                                            <p className="text-[0.75rem] text-[var(--ink-2)]">
                                                {pedido.transportadora
                                                    ? `Enviado por ${pedido.transportadora}`
                                                    : "Enviado"}
                                                {pedido.enviado_em ? ` em ${formatarData(pedido.enviado_em)}` : ""}
                                            </p>

                                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                <p className="num text-[1rem] font-bold tracking-[0.1em] text-[var(--ink)]">
                                                    {pedido.codigo_rastreio}
                                                </p>

                                                <button
                                                    type="button"
                                                    onClick={() => copiarRastreio(pedido.codigo_rastreio ?? "")}
                                                    className="inline-flex items-center gap-1 text-[0.72rem] text-[var(--ink-2)] underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
                                                >
                                                    {copiado ? (
                                                        <>
                                                            <FiCheck className="w-3" aria-hidden /> copiado
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FiCopy className="w-3" aria-hidden /> copiar
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <p className="mt-1 text-[0.72rem] text-[var(--ink-3)]">
                                                Use este código no site da transportadora para acompanhar.
                                            </p>
                                        </div>
                                    ) : temEntrega && !cancelado ? (
                                        <p className="mt-4 text-[0.78rem] text-[var(--ink-3)]">
                                            O código de rastreio aparece aqui assim que a loja despachar.
                                        </p>
                                    ) : null}

                                </div>

                            </section>
                        ) : null}

                    </div>

                    {/* ------------------------------------------------------
                        A COLUNA DO DINHEIRO
                       ------------------------------------------------------ */}
                    <aside className="order-1 flex flex-col gap-4 lg:order-2 lg:sticky lg:top-6">

                        {/* PAGAMENTO */}
                        {temPagamento ? (
                            <section
                                className={`border ${
                                    aguardandoPagamento
                                        ? "border-[var(--destaque)]"
                                        : pagamentoNegado
                                            ? "border-[var(--vermelho)]"
                                            : "border-[var(--linha)]"
                                }`}
                            >

                                <h2 className="rotulo border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-3 text-[var(--ink-2)]">
                                    Pagamento
                                </h2>

                                <div className="px-5 py-5">

                                    {aguardandoPagamento ? (
                                        <>
                                            <div className="flex items-center gap-2.5">
                                                <FiClock className="w-5 shrink-0 text-[var(--ink-2)]" aria-hidden />
                                                <p className="text-[0.95rem] font-semibold text-[var(--ink)]">
                                                    {conferindoPagamento
                                                        ? "Conferindo seu pagamento..."
                                                        : "Aguardando confirmação"}
                                                </p>
                                            </div>

                                            <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                                                Se você já pagou, a confirmação costuma levar alguns
                                                segundos. A loja só começa a preparar o pedido depois
                                                que o pagamento entra no sistema.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={conferirPagamento}
                                                disabled={conferindoPagamento}
                                                className="btn mt-4 w-full"
                                            >
                                                {conferindoPagamento ? "conferindo..." : "já paguei, conferir agora"}
                                            </button>
                                        </>
                                    ) : pagamentoAprovado ? (
                                        <>
                                            <div className="flex items-center gap-2.5">
                                                <FiCheckCircle className="w-5 shrink-0 text-[var(--verde)]" aria-hidden />
                                                <p className="text-[0.95rem] font-semibold text-[var(--ink)]">
                                                    Pagamento confirmado
                                                </p>
                                            </div>

                                            <dl className="mt-4 space-y-2 border-t border-[var(--linha-suave)] pt-4 text-[0.82rem]">
                                                {pedido.pago_em ? (
                                                    <div className="flex items-baseline justify-between gap-3">
                                                        <dt className="text-[var(--ink-3)]">Confirmado em</dt>
                                                        <dd className="num text-right text-[var(--ink)]">
                                                            {formatarData(pedido.pago_em)}
                                                        </dd>
                                                    </div>
                                                ) : null}

                                                {/* Como pagou. O provedor informa, e o
                                                    comprovante fica completo: quem paga por
                                                    Pix procura por isso quando confere o
                                                    extrato. */}
                                                {pedido.pagamento_metodo ? (
                                                    <div className="flex items-baseline justify-between gap-3">
                                                        <dt className="text-[var(--ink-3)]">Forma</dt>
                                                        <dd className="text-right text-[var(--ink)]">
                                                            {nomeDoMetodo(pedido.pagamento_metodo)}
                                                        </dd>
                                                    </div>
                                                ) : null}

                                                <div className="flex items-baseline justify-between gap-3">
                                                    <dt className="text-[var(--ink-3)]">Valor pago</dt>
                                                    <dd className="num text-right font-semibold text-[var(--ink)]">
                                                        {formatarMoeda(total)}
                                                    </dd>
                                                </div>

                                                <div className="flex items-baseline justify-between gap-3">
                                                    <dt className="text-[var(--ink-3)]">Referência</dt>
                                                    <dd className="num text-right tracking-[0.08em] text-[var(--ink)]">
                                                        {pedido.codigo}
                                                    </dd>
                                                </div>
                                            </dl>

                                            <p className="mt-4 text-[0.78rem] leading-relaxed text-[var(--ink-3)]">
                                                Seu pedido foi recebido pela loja. Guarde o código
                                                acima para qualquer conversa sobre esta compra.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2.5">
                                                <FiAlertCircle className="w-5 shrink-0 text-[var(--vermelho)]" aria-hidden />
                                                <p className="text-[0.95rem] font-semibold text-[var(--vermelho)]">
                                                    {pedido.pagamento_status === "estornado"
                                                        ? "Pagamento estornado"
                                                        : "Pagamento não aprovado"}
                                                </p>
                                            </div>

                                            <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                                                {pedido.pagamento_status === "estornado"
                                                    ? "O valor desta compra foi devolvido. Se você não pediu o estorno, fale com a loja."
                                                    : "O cartão foi negado ou o prazo do Pix venceu, e o pedido não seguiu. Você pode fazer a compra de novo pela vitrine."}
                                            </p>

                                            <Link href={caminhoDaLoja(loja.slug)} className="btn btn-claro mt-4 w-full">
                                                voltar à vitrine
                                            </Link>
                                        </>
                                    )}

                                </div>

                            </section>
                        ) : null}

                        {/* RESUMO DE VALORES */}
                        <section className="border border-[var(--linha)]">

                            <h2 className="rotulo border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-3 text-[var(--ink-2)]">
                                Resumo
                            </h2>

                            <div className="px-5 py-5">

                                <div className="flex items-baseline justify-between gap-3 text-[0.85rem] text-[var(--ink-2)]">
                                    <span>
                                        Produtos ({pecas} {pecas === 1 ? "peça" : "peças"})
                                    </span>
                                    <span className="num">{formatarMoeda(subtotal)}</span>
                                </div>

                                <div className="mt-2 flex items-baseline justify-between gap-3 text-[0.85rem] text-[var(--ink-2)]">
                                    <span>Frete</span>
                                    <span className="num">
                                        {frete > 0 ? formatarMoeda(frete) : temEntrega ? "grátis" : "—"}
                                    </span>
                                </div>

                                <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-[var(--linha)] pt-4">
                                    <span className="text-[0.85rem] font-semibold text-[var(--ink)]">Total</span>
                                    <span className="preco text-xl">{formatarMoeda(total)}</span>
                                </div>

                            </div>

                        </section>

                        {/* FALAR COM A LOJA

                            A tela não tinha saída nenhuma: quem tinha um
                            problema com o pedido não tinha para onde ir. O
                            código já vai escrito na mensagem — é a primeira
                            coisa que a loja pergunta. */}
                        {conversa || loja.telefone ? (
                            <section className="border border-[var(--linha)]">

                                <h2 className="rotulo border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-3 text-[var(--ink-2)]">
                                    Precisa de ajuda?
                                </h2>

                                <div className="px-5 py-5">

                                    <p className="text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                                        Fale com a loja sobre este pedido. Tenha o código{" "}
                                        <span className="num font-semibold text-[var(--ink)]">
                                            {pedido.codigo}
                                        </span>{" "}
                                        à mão.
                                    </p>

                                    {conversa ? (
                                        <a
                                            href={conversa}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-claro mt-4 w-full"
                                        >
                                            <FiMessageCircle className="w-4" aria-hidden />
                                            falar no WhatsApp
                                        </a>
                                    ) : null}

                                    {loja.telefone ? (
                                        <p className="mt-3 flex items-center gap-2 text-[0.82rem] text-[var(--ink-2)]">
                                            <FiPhone className="w-3.5 shrink-0" aria-hidden />
                                            {loja.telefone}
                                        </p>
                                    ) : null}

                                </div>

                            </section>
                        ) : null}

                    </aside>

                </div>

                {/* ==========================================================
                    O QUE DÁ PARA FAZER COM ESTE PEDIDO

                    Fica no fim porque é ação, não informação: quem abre a
                    tela quer primeiro saber em que pé está. Nada aqui é
                    decorativo — cada botão existe porque a falta dele
                    mandava a pessoa ligar para a loja.
                   ========================================================== */}
                <div className="nao-imprime mt-6 flex flex-wrap items-center gap-3">

                    {!cancelado ? (
                        <button
                            type="button"
                            onClick={comprarDeNovo}
                            disabled={repetindo === "carregando"}
                            className="btn btn-claro"
                        >
                            <FiRotateCcw className="w-4" aria-hidden />
                            {repetindo === "carregando" ? "montando a sacola..." : "comprar de novo"}
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn btn-claro"
                    >
                        <FiPrinter className="w-4" aria-hidden />
                        imprimir ou salvar em PDF
                    </button>

                    <Link
                        href={caminhoDaLoja(loja.slug, "acompanhar")}
                        className="link text-[0.85rem]"
                    >
                        ver todos os meus pedidos
                    </Link>

                    {/* Cancelar fica por último e sem destaque: é a saída, e
                        saída não se oferece antes da porta. Só aparece
                        enquanto o pagamento não entrou — depois disso é
                        estorno, e estorno é conversa com a loja. */}
                    {aguardandoPagamento ? (
                        <div className="ml-auto flex items-center gap-2">
                            {confirmandoCancelamento ? (
                                <>
                                    <span className="text-[0.8rem] text-[var(--ink-2)]">
                                        Cancelar este pedido?
                                    </span>

                                    <button
                                        type="button"
                                        onClick={cancelar}
                                        disabled={cancelando}
                                        className="border border-[var(--vermelho)] px-3 py-2 text-[0.8rem] font-semibold text-[var(--vermelho)] transition-colors hover:bg-[var(--erro-fundo)] disabled:opacity-50"
                                    >
                                        {cancelando ? "cancelando..." : "sim, cancelar"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConfirmandoCancelamento(false)}
                                        className="text-[0.8rem] text-[var(--ink-3)] underline underline-offset-2"
                                    >
                                        não
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmandoCancelamento(true)}
                                    className="text-[0.8rem] text-[var(--ink-3)] underline underline-offset-2 transition-colors hover:text-[var(--vermelho)]"
                                >
                                    desistir deste pedido
                                </button>
                            )}
                        </div>
                    ) : null}

                </div>

                {repetindo === "parcial" ? (
                    <p className="nao-imprime mt-3 text-[0.8rem] text-[var(--ink-2)]">
                        Alguns itens deste pedido não estão mais disponíveis e ficaram de
                        fora da sacola.
                    </p>
                ) : null}

                {repetindo === "nada" ? (
                    <p className="nao-imprime mt-3 text-[0.8rem] text-[var(--ink-2)]">
                        Nenhum item deste pedido está disponível agora.
                    </p>
                ) : null}

                {erro ? (
                    <p className="nao-imprime mt-3 border-l-2 border-[var(--vermelho)] bg-[var(--erro-fundo)] px-3 py-2 text-[0.8rem] text-[var(--vermelho)]">
                        {erro}
                    </p>
                ) : null}

            </main>

            <Footer />
        </div>
    )
}
