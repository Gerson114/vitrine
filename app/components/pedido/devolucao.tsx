"use client"

import { useState } from "react"
import { FiAlertCircle, FiCheckCircle, FiClock, FiMessageCircle, FiTruck, FiX } from "react-icons/fi"
import type { CausaDevolucao, DevolucaoDoPedido, PedidoStatus } from "@/app/type/type"
import { linkWhatsapp } from "@/lib/contato"

/**
 * "Quero meu dinheiro de volta" — pela vitrine, e só por dois motivos.
 *
 * A porta é estreita de propósito. Devolução de motivo livre — "não serviu",
 * "mudei de ideia" — automatiza o caminho de quem recebe a mercadoria inteira
 * e pede o dinheiro de volta assim mesmo, e é a loja que fica sem a peça e
 * sem o valor. Então esta tela só oferece o pedido quando o próprio sistema
 * já sabe que alguma coisa deu errado:
 *
 *   O PEDIDO NÃO CHEGOU — passou do prazo que a loja prometeu e ele continua
 *                         sem ser entregue. É um fato que a loja também vê no
 *                         painel dela, não uma alegação.
 *
 *   CHEGOU DANIFICADO   — foi entregue há poucos dias e veio quebrado ou
 *                         rasgado. Janela curta: avaria de transporte se vê
 *                         ao abrir o pacote.
 *
 * Quem quiser devolver por qualquer outro motivo continua podendo — só não
 * por um botão. A tela manda falar com a loja, que é onde essa conversa
 * resolve: dá para mandar foto, combinar troca, negociar. Um formulário não
 * faz nada disso.
 *
 * Quem decide é sempre a loja, inclusive nas duas causas acima: o que sai
 * daqui é um pedido, não um estorno.
 */

function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatarDia(iso?: string): string {
    if (!iso) return ""

    const data = new Date(iso)

    return Number.isNaN(data.getTime())
        ? ""
        : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const NOME_DA_CAUSA: Record<CausaDevolucao, string> = {
    atraso: "o pedido não chegou",
    danificado: "chegou danificado",
}

export default function PedirDevolucao({
    loja,
    codigo,
    pedido,
    conversa,
    whatsapp,
    aoAtualizar,
}: {
    loja: string
    codigo: string
    pedido: PedidoStatus

    /** O link que abre a conversa com a loja. Vazio quando ela não tem número. */
    conversa?: string

    /** O número da loja, cru. É dele que sai a mensagem já escrita do aviso. */
    whatsapp?: string

    aoAtualizar: () => void | Promise<void>
}) {

    // Qual causa está com o formulário aberto. Nulo é nenhuma.
    const [abrindo, setAbrindo] = useState<CausaDevolucao | null>(null)

    const [quantidades, setQuantidades] = useState<Record<number, number>>({})
    const [motivo, setMotivo] = useState("")
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState("")

    const devolucoes = pedido.devolucoes ?? []

    // A que ainda espera resposta. Só existe uma por vez — o servidor recusa a
    // segunda, e a tela nem a oferece.
    const emAberto = devolucoes.find((devolucao) => devolucao.situacao === "pedida")

    // Este pedido foi aberto POR QUEM TEM CONTA?
    //
    // A consulta pelo código de seis dígitos mais o contato devolve uma versão
    // enxuta do pedido, sem os campos de devolução — e é por isso que a
    // presença de `causas_devolucao` (mesmo vazia) serve de sinal aqui. Mexer
    // em dinheiro exige a sessão da conta; oferecer o formulário a quem não a
    // tem seria montar uma tela inteira para receber "entre na sua conta" no
    // fim.
    const comConta = pedido.causas_devolucao !== undefined

    // O que o SERVIDOR diz que cabe agora. A tela não recalcula prazo nenhum:
    // duas cópias da mesma regra é ter duas para divergirem, e a que
    // divergisse aqui abriria justamente a porta que esta regra fecha.
    const causas = emAberto ? [] : (pedido.causas_devolucao ?? [])

    // Quanto de cada peça já saiu em devolução que não foi recusada. Recusada
    // não conta: a peça continua com quem comprou.
    const jaPedido: Record<number, number> = {}

    for (const devolucao of devolucoes) {
        if (devolucao.situacao === "recusada") continue

        for (const item of devolucao.itens) {
            jaPedido[item.item_pedido_id] = (jaPedido[item.item_pedido_id] ?? 0) + item.quantidade
        }
    }

    const disponiveis = pedido.itens
        .map((item) => ({ item, resta: item.quantidade - (jaPedido[item.id] ?? 0) }))
        .filter(({ resta }) => resta > 0)

    const escolhidas = Object.values(quantidades).reduce((soma, valor) => soma + valor, 0)

    // No atraso não se escolhe peça: não chegou nada, e o que volta é o pedido
    // inteiro com o frete. Na avaria, vale o que foi marcado.
    const valorDoAtraso =
        disponiveis.reduce((soma, { item, resta }) => soma + item.preco_unitario * resta, 0) +
        (pedido.frete ?? 0)

    const valorDaAvaria = disponiveis.reduce(
        (soma, { item }) => soma + item.preco_unitario * (quantidades[item.id] ?? 0),
        0,
    )

    /**
     * O aviso que o cliente manda para a loja, já escrito.
     *
     * O servidor também avisa a loja pelo WhatsApp dela assim que o pedido é
     * registrado, e mesmo assim este botão existe: são coisas diferentes. O
     * aviso do servidor é um recado da loja para ela mesma, e morre ali. Este
     * abre uma CONVERSA, com o cliente do outro lado — é por onde vai a foto
     * do dano, que é o que resolve uma avaria mais rápido do que qualquer
     * descrição.
     *
     * Vazio quando a loja não declarou telefone: botão que não leva a lugar
     * nenhum é pior do que botão nenhum.
     */
    function avisoPronto(devolucao: DevolucaoDoPedido): string {

        if (!whatsapp) return ""

        const pecas = devolucao.itens
            .map((item) => {
                const comprado = pedido.itens.find((umItem) => umItem.id === item.item_pedido_id)

                return `${item.quantidade}x ${comprado?.produto_nome ?? "peça"}`
            })
            .join(", ")

        const causa = devolucao.causa === "atraso" ? "o pedido não chegou" : "chegou danificado"

        const texto =
            `Olá! Pedi a devolução do pedido ${codigo} pelo site — ${causa}.` +
            (pecas ? ` ${pecas}.` : "") +
            (devolucao.motivo ? ` ${devolucao.motivo}` : "")

        return linkWhatsapp(whatsapp, texto)
    }

    function fechar() {
        setAbrindo(null)
        setQuantidades({})
        setMotivo("")
        setErro("")
    }

    async function enviar(causa: CausaDevolucao) {

        const itens = Object.entries(quantidades)
            .map(([id, quantidade]) => ({ item_pedido_id: Number(id), quantidade }))
            .filter((item) => item.quantidade > 0)

        if (causa === "danificado") {

            if (itens.length === 0) {
                setErro("Marque quais peças vieram danificadas.")
                return
            }

            if (!motivo.trim()) {
                setErro("Conte o que veio danificado — é o que a loja precisa para resolver.")
                return
            }
        }

        setEnviando(true)
        setErro("")

        try {
            const resposta = await fetch("/api/pedido/devolucao", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ loja, codigo, causa, motivo: motivo.trim(), itens }),
            })

            const dados = await resposta.json().catch(() => null)

            if (!resposta.ok) {
                setErro(
                    dados && typeof dados === "object" && "erro" in dados
                        ? String((dados as { erro: unknown }).erro)
                        : "Não foi possível pedir a devolução.",
                )
                return
            }

            // O pedido é relido inteiro: a devolução recém-criada volta de lá
            // com o valor que o SERVIDOR apurou, que é o que vale — e não o
            // que esta tela somou enquanto a pessoa escolhia.
            await aoAtualizar()

            fechar()

        } catch {
            setErro("Não foi possível pedir a devolução.")
        } finally {
            setEnviando(false)
        }
    }

    const pago = pedido.pagamento_status === "aprovado"

    // Consulta sem conta, ou pedido que nunca foi pago: nada a mostrar.
    if (!comConta || (!pago && devolucoes.length === 0)) return null

    return (
        <section className="border border-[var(--linha)]">

            <h2 className="rotulo border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-3 text-[var(--ink-2)] sm:px-6">
                Algum problema com este pedido?
            </h2>

            <div className="px-5 py-5 sm:px-6">

                {devolucoes.length > 0 ? (
                    <ul className="mb-5 space-y-3">
                        {devolucoes.map((devolucao) => (
                            <li key={devolucao.id}>
                                <CartaoDevolucao devolucao={devolucao} aviso={avisoPronto(devolucao)} />
                            </li>
                        ))}
                    </ul>
                ) : null}

                {/* AS DUAS PORTAS, quando o pedido as abre. */}
                {causas.length > 0 && abrindo === null ? (
                    <div className="space-y-3">

                        {causas.includes("atraso") ? (
                            <button
                                type="button"
                                onClick={() => setAbrindo("atraso")}
                                className="flex w-full items-start gap-3 border border-[var(--linha)] px-4 py-3 text-left transition-colors hover:bg-[var(--placa)]"
                            >
                                <FiTruck className="mt-0.5 w-4 shrink-0 text-[var(--ink-2)]" aria-hidden />

                                <span className="min-w-0">
                                    <span className="block text-[0.85rem] font-semibold text-[var(--ink)]">
                                        Meu pedido não chegou
                                    </span>

                                    <span className="mt-0.5 block text-[0.78rem] leading-relaxed text-[var(--ink-3)]">
                                        O prazo de entrega já venceu. Você pode pedir o dinheiro de volta.
                                    </span>
                                </span>
                            </button>
                        ) : null}

                        {causas.includes("danificado") ? (
                            <button
                                type="button"
                                onClick={() => setAbrindo("danificado")}
                                className="flex w-full items-start gap-3 border border-[var(--linha)] px-4 py-3 text-left transition-colors hover:bg-[var(--placa)]"
                            >
                                <FiAlertCircle className="mt-0.5 w-4 shrink-0 text-[var(--ink-2)]" aria-hidden />

                                <span className="min-w-0">
                                    <span className="block text-[0.85rem] font-semibold text-[var(--ink)]">
                                        Chegou danificado
                                    </span>

                                    <span className="mt-0.5 block text-[0.78rem] leading-relaxed text-[var(--ink-3)]">
                                        Veio quebrado, rasgado ou molhado. Diga quais peças.
                                    </span>
                                </span>
                            </button>
                        ) : null}

                    </div>
                ) : null}

                {/* NÃO CHEGOU */}
                {abrindo === "atraso" ? (
                    <div>
                        <p className="text-[0.85rem] leading-relaxed text-[var(--ink)]">
                            Você está avisando que este pedido não chegou. A loja confere onde o
                            pacote parou e responde por aqui — se ela concordar, devolve{" "}
                            <strong className="font-semibold">{formatarMoeda(valorDoAtraso)}</strong>,
                            com o frete.
                        </p>

                        <label htmlFor="motivo-atraso" className="rotulo mt-4 block text-[var(--ink-2)]">
                            Quer contar mais alguma coisa? (opcional)
                        </label>

                        <textarea
                            id="motivo-atraso"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="O rastreio parou em outra cidade, o entregador não achou o endereço..."
                            className="campo mt-1.5 w-full resize-none text-[0.85rem]"
                        />

                        {erro ? <Erro texto={erro} /> : null}

                        <Acoes
                            enviando={enviando}
                            rotulo="avisar a loja"
                            aoEnviar={() => enviar("atraso")}
                            aoFechar={fechar}
                        />
                    </div>
                ) : null}

                {/* CHEGOU DANIFICADO */}
                {abrindo === "danificado" ? (
                    <div>
                        <p className="text-[0.85rem] leading-relaxed text-[var(--ink)]">
                            Marque o que veio danificado e conte o que aconteceu. A loja lê, responde
                            por aqui e, se concordar, devolve o valor dessas peças.
                        </p>

                        <ul className="mt-4 divide-y divide-[var(--linha-suave)]">
                            {disponiveis.map(({ item, resta }) => {

                                const escolhida = quantidades[item.id] ?? 0

                                return (
                                    <li key={item.id} className="flex items-center gap-3 py-3">

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[0.85rem] leading-snug text-[var(--ink)]">
                                                {item.produto_nome || `Produto #${item.produto_id}`}
                                                {item.produto_variacao ? (
                                                    <span className="text-[var(--ink-3)]"> · {item.produto_variacao}</span>
                                                ) : null}
                                            </p>

                                            <p className="mt-0.5 text-[0.75rem] text-[var(--ink-3)]">
                                                {formatarMoeda(item.preco_unitario)} · você recebeu {resta}
                                            </p>
                                        </div>

                                        {/* Quantidade em passos, e não campo de digitar: o
                                            número tem teto — o que a pessoa recebeu —, e
                                            campo livre convida a digitar o que vai ser
                                            recusado do outro lado. */}
                                        <div className="flex shrink-0 items-center gap-2">
                                            <button
                                                type="button"
                                                aria-label={`Tirar uma unidade de ${item.produto_nome}`}
                                                disabled={escolhida === 0}
                                                onClick={() =>
                                                    setQuantidades((atuais) => ({
                                                        ...atuais,
                                                        [item.id]: Math.max(0, escolhida - 1),
                                                    }))
                                                }
                                                className="h-8 w-8 border border-[var(--linha)] text-[var(--ink-2)] transition-colors hover:bg-[var(--placa)] disabled:opacity-40"
                                            >
                                                −
                                            </button>

                                            <span className="w-5 text-center text-[0.85rem] tabular-nums text-[var(--ink)]">
                                                {escolhida}
                                            </span>

                                            <button
                                                type="button"
                                                aria-label={`Somar uma unidade de ${item.produto_nome}`}
                                                disabled={escolhida >= resta}
                                                onClick={() =>
                                                    setQuantidades((atuais) => ({
                                                        ...atuais,
                                                        [item.id]: Math.min(resta, escolhida + 1),
                                                    }))
                                                }
                                                className="h-8 w-8 border border-[var(--linha)] text-[var(--ink-2)] transition-colors hover:bg-[var(--placa)] disabled:opacity-40"
                                            >
                                                +
                                            </button>
                                        </div>

                                    </li>
                                )
                            })}
                        </ul>

                        <label htmlFor="motivo-avaria" className="rotulo mt-4 block text-[var(--ink-2)]">
                            O que veio danificado?
                        </label>

                        <textarea
                            id="motivo-avaria"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="A caixa veio amassada e a peça está com um rasgo na costura lateral..."
                            className="campo mt-1.5 w-full resize-none text-[0.85rem]"
                        />

                        {conversa ? (
                            <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--ink-3)]">
                                Tem foto do dano?{" "}
                                <a href={conversa} target="_blank" rel="noopener noreferrer" className="link">
                                    Mande para a loja
                                </a>{" "}
                                — resolve mais rápido do que qualquer descrição.
                            </p>
                        ) : null}

                        {escolhidas > 0 ? (
                            <p className="mt-3 text-[0.82rem] text-[var(--ink-2)]">
                                {escolhidas === 1 ? "1 peça" : `${escolhidas} peças`} ·{" "}
                                <strong className="font-semibold text-[var(--ink)]">
                                    {formatarMoeda(valorDaAvaria)}
                                </strong>{" "}
                                <span className="text-[var(--ink-3)]">
                                    (o valor final é conferido pela loja)
                                </span>
                            </p>
                        ) : null}

                        {erro ? <Erro texto={erro} /> : null}

                        <Acoes
                            enviando={enviando}
                            rotulo="avisar a loja"
                            aoEnviar={() => enviar("danificado")}
                            aoFechar={fechar}
                        />
                    </div>
                ) : null}

                {/* QUALQUER OUTRO MOTIVO — a conversa, que é onde ele resolve. */}
                {abrindo === null ? (
                    <p
                        className={`text-[0.8rem] leading-relaxed text-[var(--ink-3)] ${causas.length > 0 || devolucoes.length > 0 ? "mt-4 border-t border-[var(--linha-suave)] pt-4" : ""}`}
                    >
                        {emAberto
                            ? "Enquanto a loja não responde, qualquer dúvida é com ela mesma."
                            : "Precisa resolver outra coisa — trocar o tamanho, tirar uma dúvida da peça? Fale com a loja."}{" "}

                        {conversa ? (
                            <a
                                href={conversa}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link inline-flex items-center gap-1.5"
                            >
                                <FiMessageCircle className="w-3.5" aria-hidden />
                                falar com a loja
                            </a>
                        ) : null}
                    </p>
                ) : null}

            </div>

        </section>
    )
}

function Erro({ texto }: { texto: string }) {
    return (
        <p className="mt-3 border-l-2 border-[var(--vermelho)] bg-[var(--erro-fundo)] px-3 py-2 text-[0.8rem] text-[var(--vermelho)]">
            {texto}
        </p>
    )
}

function Acoes({
    enviando,
    rotulo,
    aoEnviar,
    aoFechar,
}: {
    enviando: boolean
    rotulo: string
    aoEnviar: () => void
    aoFechar: () => void
}) {
    return (
        <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
                type="button"
                onClick={aoEnviar}
                disabled={enviando}
                className="btn px-5 py-2.5 text-[0.82rem]"
            >
                {enviando ? "enviando..." : rotulo}
            </button>

            <button
                type="button"
                onClick={aoFechar}
                className="text-[0.8rem] text-[var(--ink-3)] underline underline-offset-2"
            >
                agora não
            </button>
        </div>
    )
}

/** Um pedido de devolução já feito, com a resposta da loja quando houver. */
function CartaoDevolucao({
    devolucao,
    aviso,
}: {
    devolucao: DevolucaoDoPedido

    /** Link do WhatsApp com o recado já escrito. Vazio some com o botão. */
    aviso: string
}) {

    const pecas = devolucao.itens.reduce((soma, item) => soma + item.quantidade, 0)

    const { Icone, cor, titulo, texto } =
        devolucao.situacao === "pedida"
            ? {
                Icone: FiClock,
                cor: "var(--ink-2)",
                titulo: "A loja foi avisada",
                texto: "Ela está conferindo e responde por aqui.",
            }
            : devolucao.situacao === "aceita"
                ? {
                    Icone: FiCheckCircle,
                    cor: "var(--verde)",
                    titulo: "Devolução aceita",
                    texto: devolucao.estornado_em
                        ? `O valor foi devolvido em ${formatarDia(devolucao.estornado_em)}. Dependendo do banco, ele leva alguns dias para aparecer na sua fatura.`
                        : "A loja aceitou e o valor está a caminho.",
                }
                : {
                    Icone: FiX,
                    cor: "var(--vermelho)",
                    titulo: "Devolução recusada",
                    texto: "",
                }

    return (
        <div className="border border-[var(--linha)] px-4 py-3">

            <div className="flex items-start gap-2.5">
                <Icone className="mt-0.5 w-4 shrink-0" style={{ color: cor }} aria-hidden />

                <div className="min-w-0 flex-1">
                    <p className="text-[0.85rem] font-semibold" style={{ color: cor }}>
                        {titulo}
                    </p>

                    <p className="mt-1 text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                        {NOME_DA_CAUSA[devolucao.causa] ?? "devolução"} ·{" "}
                        {pecas === 1 ? "1 peça" : `${pecas} peças`} · {formatarMoeda(devolucao.valor)}
                        {devolucao.frete > 0 ? " (frete incluído)" : ""} · avisada em{" "}
                        {formatarDia(devolucao.created_at)}
                    </p>

                    {texto ? (
                        <p className="mt-1.5 text-[0.8rem] leading-relaxed text-[var(--ink-3)]">{texto}</p>
                    ) : null}

                    {/* A resposta escrita pela loja. Aparece na recusa sempre — é
                        obrigatória lá — e na aceitação quando alguém escreveu
                        alguma coisa. */}
                    {devolucao.resposta ? (
                        <p className="mt-2 border-l-2 border-[var(--linha)] pl-3 text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                            {devolucao.resposta}
                        </p>
                    ) : null}

                    {/* Falar com a loja enquanto ela não respondeu.
                        
                        A loja já foi avisada por dentro do sistema no instante
                        em que este pedido foi feito — este botão não é o aviso,
                        é a conversa: é por aqui que vai a foto do dano, e foto
                        resolve avaria mais rápido do que qualquer descrição.
                        
                        Some depois da resposta: decidida a devolução, o que
                        sobra é esperar o dinheiro, e um botão de "avisar" aí
                        faria a pessoa avisar de novo o que já foi resolvido. */}
                    {aviso && devolucao.situacao === "pedida" ? (
                        <a
                            href={aviso}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-claro mt-3 px-4 py-2 text-[0.78rem]"
                        >
                            <FiMessageCircle className="w-4" aria-hidden />
                            falar com a loja no WhatsApp
                        </a>
                    ) : null}
                </div>
            </div>

        </div>
    )
}
