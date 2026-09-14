"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FiCamera, FiCheck, FiHome, FiLock, FiMinus, FiPlus, FiShoppingBag, FiTrash2, FiTruck, FiUser, FiX } from "react-icons/fi"
import { ENTREGA_VAZIA, useCarrinho } from "@/app/cart/cart-context"
import type { Cotacao, Entrega } from "@/app/cart/cart-context"
import { useLoja, useTexto } from "@/app/loja/loja-context"
import { useConta } from "@/app/conta/conta-context"
import { descreverVariacao } from "@/lib/variantes"
import { caminhoDaLoja } from "@/lib/caminhos"

function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/**
 * O endereço para onde se manda quem vai pagar só vale se for http ou https.
 *
 * A checagem é por protocolo, e não por lista de domínios, porque o provedor
 * de pagamento é escolha do lojista e muda de loja para loja — fixar hosts
 * aqui quebraria a loja seguinte. O que se barra é o que nunca é endereço de
 * pagamento e sempre é ataque: `javascript:`, `data:`, `blob:`.
 */
function enderecoDePagamentoSeguro(endereco: string): boolean {
    try {
        const protocolo = new URL(endereco).protocol
        return protocolo === "https:" || protocolo === "http:"
    } catch {
        return false
    }
}

type Etapa = "carrinho" | "checkout" | "sucesso"

export default function CartDrawer() {

    // As palavras desta loja: "sacola" é o vocabulário de loja de roupa, e
    // esta vitrine vende parafuso também (ver loja-context.useTexto).
    const t = useTexto()
    const { itens, remover, definirQuantidade, limpar, totalPreco, aberto, fechar, finalizarPedido, cotarFrete } = useCarrinho()
    const loja = useLoja()
    const conta = useConta()

    const [etapa, setEtapa] = useState<Etapa>("carrinho")
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState("")
    const [codigoPedido, setCodigoPedido] = useState("")

    // ── A entrega ────────────────────────────────────────────────────────
    //
    // A cotação começa nula: enquanto ninguém digitou um CEP, a loja não tem
    // o que dizer sobre frete. É por ela que a tela descobre se esta loja
    // sequer entrega — e, quando não entrega, nem chega a pedir endereço.
    const [entrega, setEntrega] = useState<Entrega>(ENTREGA_VAZIA)
    const [cotacao, setCotacao] = useState<Cotacao | null>(null)
    const [cotando, setCotando] = useState(false)
    const [erroFrete, setErroFrete] = useState("")

    // Com a gaveta aberta no celular, o dedo que rola dentro dela chega ao fim
    // da lista e continua rolando a LOJA atrás — a pessoa fecha a sacola e a
    // vitrine está num outro lugar. Trancar o body enquanto a gaveta vive
    // resolve; o valor anterior é devolvido ao fechar para não atropelar o
    // `overflow-x: clip` que a folha de estilo põe no body.
    useEffect(() => {
        if (!aberto) return

        const anterior = document.body.style.overflow
        document.body.style.overflow = "hidden"

        return () => {
            document.body.style.overflow = anterior
        }
    }, [aberto])

    // O que esta loja oferece. Enquanto ninguém digitou um CEP a cotação é
    // nula, e aí valem os padrões: oferecer a entrega (para o cliente digitar
    // o CEP e descobrir) e a retirada.
    const podeEntregar = cotacao ? cotacao.disponivel : true
    const podeRetirar = cotacao ? cotacao.retirada_na_loja : true

    // Loja que só entrega não deve mostrar o pedido como retirada.
    const querEntrega = entrega.tipo === "entrega" || (!podeRetirar && podeEntregar)

    const freteAtual = querEntrega && cotacao && cotacao.disponivel ? cotacao.valor : 0
    const totalComFrete = totalPreco + freteAtual

    const quantidadeTotal = itens.reduce((soma, item) => soma + item.quantidade, 0)

    if (!aberto) return null

    function fecharTudo() {
        fechar()
        // Só reseta pra próxima visita se o pedido não foi concluído — se
        // foi, o carrinho já está vazio e faz sentido voltar pra ele.
        if (etapa !== "sucesso") setEtapa("carrinho")
        setErro("")
    }

    /**
     * Pergunta o frete quando o CEP fica completo.
     *
     * Só com oito dígitos: cotar a cada tecla gastaria uma ida ao servidor
     * por caractere para responder oito vezes "CEP inválido".
     */
    async function cotar(cepDigitado: string) {

        const digitos = cepDigitado.replace(/\D/g, "")

        setEntrega((atual) => ({ ...atual, cep: digitos }))
        setErroFrete("")

        if (digitos.length !== 8) {
            setCotacao(null)
            return
        }

        setCotando(true)

        try {
            const resposta = await cotarFrete(digitos)
            setCotacao(resposta)
        } catch (e) {
            setCotacao(null)
            setErroFrete(e instanceof Error ? e.message : "Não foi possível calcular o frete.")
        } finally {
            setCotando(false)
        }
    }

    // Loja que não conectou provedor nenhum e só combina na conversa: aí o
    // botão de combinar é o principal, e não a alternativa.
    const soCombina =
        Boolean(loja.combina_no_whatsapp) && (loja.metodos_pagamento ?? []).length <= 1

    async function enviarPedido(e?: React.FormEvent<HTMLFormElement>, forma?: "whatsapp") {
        e?.preventDefault()

        setEnviando(true)
        setErro("")

        const resultado = await finalizarPedido({
            ...entrega,
            tipo: querEntrega ? "entrega" : "retirada",
        }, forma)

        setEnviando(false)

        if (resultado.ok) {
            setCodigoPedido(resultado.codigo ?? "")

            // O pedido existe, mas ainda não é venda: quem confirma é o
            // provedor de pagamento. Manda a pessoa pagar em vez de dizer
            // "pedido realizado" — dizer isso antes do dinheiro entrar é a
            // forma mais fácil de alguém achar que comprou e nunca pagar.
            //
            // O endereço é conferido antes de virar navegação. Ele vem de
            // fora (o provedor devolve, o backend repassa), e `location.href`
            // aceita `javascript:` — um endereço desses seria script rodando
            // no domínio da loja, com a sessão da pessoa junto. Só http(s)
            // passa; qualquer outra coisa vira erro na tela em vez de virar
            // navegação.
            if (resultado.urlPagamento) {
                if (enderecoDePagamentoSeguro(resultado.urlPagamento)) {
                    window.location.href = resultado.urlPagamento
                    return
                }

                setErro("Não foi possível abrir o pagamento. Fale com a loja.")
                setEtapa("carrinho")
                return
            }

            setEtapa("sucesso")
        } else {
            setErro(resultado.mensagem)
        }
    }

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={fecharTudo} />

            {/* h-dvh e não h-full: no celular a barra de endereço do navegador
                aparece e some, e com altura em 100% o rodapé da sacola — onde
                está o botão de finalizar — ficava escondido atrás dela. */}
            <aside className="absolute right-0 top-0 flex h-dvh w-full max-w-md flex-col bg-[var(--fundo)] shadow-xl">

                {/* O cabeçalho diz onde a pessoa está E o que tem na mão.
                    "SUA SACOLA" em caixa alta espaçada não informava a
                    quantidade, que é justamente o que se quer conferir ao
                    abrir a sacola. */}
                <div className="flex items-center justify-between gap-3 bg-[var(--destaque)] px-4 py-3.5 sm:px-5">

                    <div className="flex min-w-0 items-center gap-2.5 text-[var(--sobre-destaque)]">
                        <FiShoppingBag className="w-5 shrink-0" aria-hidden />

                        <div className="min-w-0">
                            <h2 className="truncate text-[0.95rem] font-bold leading-tight">
                                {etapa === "checkout"
                                    ? t("sacola.finalizar", "Finalizar pedido")
                                    : etapa === "sucesso"
                                        ? "Pedido realizado"
                                        : t("sacola.titulo", "Sua sacola")}
                            </h2>

                            {etapa === "carrinho" && quantidadeTotal > 0 ? (
                                <p className="num text-[0.72rem] opacity-80">
                                    {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={fecharTudo}
                        aria-label="Fechar sacola"
                        className="-m-2 shrink-0 rounded-[var(--radius-md)] p-2 text-[var(--sobre-destaque)] transition-opacity hover:opacity-70"
                    >
                        <FiX className="w-5" aria-hidden />
                    </button>
                </div>

                {etapa === "sucesso" ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6 text-center sm:px-6">
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--verde-claro)] text-[var(--verde)]">
                            <FiCheck className="w-8" aria-hidden />
                        </span>

                        <p className="text-lg font-semibold text-[var(--ink)]">Pedido realizado</p>

                        <p className="max-w-xs text-[0.85rem] text-[var(--ink-2)]">
                            Recebemos seu pedido e vamos entrar em contato pelo
                            {" "}{conta?.email ?? "seu e-mail"} para combinar os próximos passos.
                        </p>

                        {codigoPedido ? (
                            <div className="card mt-2 w-full max-w-xs bg-[var(--placa)] p-4">
                                <p className="rotulo text-[var(--ink-2)]">Código do pedido</p>
                                <p className="num mt-1 text-2xl font-bold tracking-[0.2em] text-[var(--ink)]">
                                    {codigoPedido}
                                </p>
                                <p className="mt-1 text-[0.72rem] text-[var(--ink-3)]">
                                    Guarde para acompanhar o andamento
                                </p>
                            </div>
                        ) : null}

                        <button type="button" onClick={fecharTudo} className="btn mt-3">
                            voltar à loja
                        </button>

                        {codigoPedido ? (
                            <Link
                                href={caminhoDaLoja(loja.slug, `pedido/${codigoPedido}`)}
                                onClick={fecharTudo}
                                className="text-xs font-semibold text-[var(--ink)] underline underline-offset-4"
                            >
                                ver status do pedido agora
                            </Link>
                        ) : null}
                    </div>

                ) : etapa === "checkout" ? (
                    <form onSubmit={enviarPedido} className="flex flex-1 flex-col overflow-y-auto bg-[var(--placa)] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">

                        {/* ONDE A PESSOA ESTÁ.
                            Checkout sem indicação de progresso é onde o
                            comprador desiste: ele não sabe se depois disto vem
                            mais um formulário, ou dois, ou o cartão. Três
                            passos, o do meio aceso. */}
                        <ol className="mb-4 flex items-center gap-1.5 text-[0.7rem] font-semibold">
                            <Passo numero={1} rotulo={t("sacola.titulo", "Sua sacola")} estado="feito" />
                            <Traco />
                            <Passo numero={2} rotulo="Seus dados" estado="agora" />
                            <Traco />
                            <Passo numero={3} rotulo="Pagamento" estado="depois" />
                        </ol>

                        {/* Quem fecha pedido tem conta nesta loja. Não há campo
                            de nome nem de contato: os dois vêm do cadastro, e é
                            o servidor que os lê — assim o pedido não pode sair
                            com o nome de outra pessoa, e a loja passa a ver o
                            histórico de cada cliente em vez de um cadastro novo
                            por compra. */}
                        {conta ? (
                            <Secao numero={1} titulo={t("sacola.quem_compra", "Quem está comprando")}>
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--placa-forte)] text-[var(--ink-2)]">
                                        <FiUser className="w-5" aria-hidden />
                                    </span>

                                    <div className="min-w-0">
                                        <p className="truncate text-[0.88rem] font-bold text-[var(--ink)]">
                                            {conta.nome}
                                        </p>
                                        {conta.email ? (
                                            <p className="truncate text-[0.78rem] text-[var(--ink-3)]">
                                                {conta.email}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </Secao>
                        ) : (
                            <div className="card p-5 text-center">
                                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--placa)] text-[var(--ink-2)]">
                                    <FiUser className="w-5" aria-hidden />
                                </span>

                                <p className="mt-3 text-[0.9rem] font-bold text-[var(--ink)]">
                                    Entre para finalizar
                                </p>

                                <p className="mt-1 text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                                    O pedido fica ligado à sua conta, com o histórico e o
                                    acompanhamento. Sua sacola fica guardada — é só voltar.
                                </p>

                                <Link
                                    href={caminhoDaLoja(loja.slug, "conta")}
                                    onClick={fecharTudo}
                                    className="btn mt-4 inline-block w-full py-3"
                                >
                                    criar conta ou entrar
                                </Link>
                            </div>
                        )}

                        {/* ==========================
                            ENTREGA
                            Só aparece para quem tem conta: antes disso a
                            pessoa nem consegue fechar o pedido, e pedir o
                            endereço primeiro seria trabalho para nada.
                        ========================== */}
                        {conta ? (
                            <>

                                {/* As duas opções só aparecem quando a loja
                                    oferece as duas — botão que não faz nada é
                                    pior do que botão nenhum. Viraram cartões
                                    com ícone e explicação: dois retângulos com
                                    uma palavra dentro não diziam a diferença
                                    entre eles, e essa diferença muda o preço e
                                    o que se pede a seguir. */}
                                {podeEntregar && podeRetirar ? (
                                    <Secao numero={2} titulo={t("sacola.como_receber", "Como você quer receber")}>
                                        <div className="grid gap-2 sm:grid-cols-2">

                                            <OpcaoEntrega
                                                escolhida={entrega.tipo === "retirada"}
                                                aoEscolher={() => setEntrega({ ...entrega, tipo: "retirada" })}
                                                Icone={FiHome}
                                                titulo={t("sacola.retirar_titulo", "Retirar na loja")}
                                                texto={loja.endereco || t("sacola.retirar_texto", "Você busca no balcão")}
                                            />

                                            <OpcaoEntrega
                                                escolhida={entrega.tipo === "entrega"}
                                                aoEscolher={() => setEntrega({ ...entrega, tipo: "entrega" })}
                                                Icone={FiTruck}
                                                titulo={t("sacola.receber_titulo", "Receber em casa")}
                                                texto="Frete calculado pelo seu CEP"
                                            />

                                        </div>
                                    </Secao>
                                ) : null}

                                {/* O contato do pedido. Vem antes do endereço e
                                    vale para os dois tipos: é o número que a
                                    loja liga quando o entregador não acha a
                                    casa ou quando falta combinar alguma coisa.
                                    A conta tem e-mail, e e-mail não resolve
                                    entrega. */}
                                <Secao
                                    numero={podeEntregar && podeRetirar ? 3 : 2}
                                    titulo="Contato para este pedido"
                                >
                                    <label className="rotulo-campo" htmlFor="telefone">
                                        WhatsApp
                                    </label>

                                    <input
                                        id="telefone"
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        value={entrega.telefone}
                                        onChange={(e) => setEntrega({ ...entrega, telefone: e.target.value })}
                                        placeholder="(00) 00000-0000"
                                        maxLength={24}
                                        required
                                        className="campo"
                                    />

                                    <p className="mt-1.5 text-[0.72rem] text-[var(--ink-3)]">
                                        É por aqui que a loja fala com você sobre este pedido.
                                    </p>
                                </Secao>

                                {querEntrega ? (
                                    <Secao
                                        numero={podeEntregar && podeRetirar ? 4 : 3}
                                        titulo="Endereço de entrega"
                                    >
                                        <div className="space-y-3">

                                            <div>
                                                <label className="rotulo-campo" htmlFor="cep">CEP</label>

                                                <input
                                                    id="cep"
                                                    inputMode="numeric"
                                                    value={entrega.cep}
                                                    onChange={(e) => cotar(e.target.value)}
                                                    placeholder="00000-000"
                                                    maxLength={9}
                                                    required
                                                    className="campo"
                                                />

                                                {cotando ? (
                                                    <p className="mt-1.5 text-[0.75rem] text-[var(--ink-3)]">
                                                        calculando o frete…
                                                    </p>
                                                ) : null}

                                                {erroFrete ? (
                                                    <p className="mt-1.5 text-[0.75rem] font-semibold text-[var(--vermelho)]">
                                                        {erroFrete}
                                                    </p>
                                                ) : null}

                                                {/* O resultado do frete em
                                                    destaque, e não em cinza
                                                    miúdo: é a informação que a
                                                    pessoa digitou o CEP para
                                                    obter. */}
                                                {cotacao && cotacao.disponivel && !erroFrete && !cotando ? (
                                                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-sm)] bg-[var(--verde-claro)] px-2.5 py-1.5 text-[0.78rem] font-bold text-[var(--verde)]">
                                                        <FiTruck className="w-3.5 shrink-0" aria-hidden />
                                                        {cotacao.gratis ? "Frete grátis" : `Frete ${formatarMoeda(cotacao.valor)}`}
                                                        {cotacao.prazo_dias > 0 ? (
                                                            <span className="font-semibold opacity-80">
                                                                · até {cotacao.prazo_dias} {cotacao.prazo_dias === 1 ? "dia útil" : "dias úteis"}
                                                            </span>
                                                        ) : null}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="grid grid-cols-[1fr_6rem] gap-2">
                                                <div>
                                                    <label className="rotulo-campo" htmlFor="logradouro">Rua</label>
                                                    <input
                                                        id="logradouro"
                                                        value={entrega.logradouro}
                                                        onChange={(e) => setEntrega({ ...entrega, logradouro: e.target.value })}
                                                        required
                                                        className="campo"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="rotulo-campo" htmlFor="numero">Número</label>
                                                    <input
                                                        id="numero"
                                                        value={entrega.numero}
                                                        onChange={(e) => setEntrega({ ...entrega, numero: e.target.value })}
                                                        required
                                                        className="campo"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="rotulo-campo" htmlFor="complemento">
                                                    Complemento <span className="font-normal text-[var(--ink-3)]">(opcional)</span>
                                                </label>
                                                <input
                                                    id="complemento"
                                                    value={entrega.complemento}
                                                    onChange={(e) => setEntrega({ ...entrega, complemento: e.target.value })}
                                                    placeholder="apartamento, bloco, ponto de referência"
                                                    className="campo"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="rotulo-campo" htmlFor="bairro">Bairro</label>
                                                    <input
                                                        id="bairro"
                                                        value={entrega.bairro}
                                                        onChange={(e) => setEntrega({ ...entrega, bairro: e.target.value })}
                                                        required
                                                        className="campo"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="rotulo-campo" htmlFor="cidade">Cidade</label>
                                                    <input
                                                        id="cidade"
                                                        value={entrega.cidade}
                                                        onChange={(e) => setEntrega({ ...entrega, cidade: e.target.value })}
                                                        required
                                                        className="campo"
                                                    />
                                                </div>
                                            </div>

                                        </div>
                                    </Secao>
                                ) : null}

                                {/* O RESUMO, com o mesmo desenho da sacola.
                                    Fica aqui, e não só no provedor de
                                    pagamento: descobrir o valor da entrega
                                    depois de sair da loja é o motivo clássico
                                    de carrinho abandonado. */}
                                <div className="card p-4">

                                    <p className="rotulo mb-2.5 text-[var(--ink-2)]">Resumo</p>

                                    <dl className="space-y-1.5 text-[0.82rem]">

                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-[var(--ink-2)]">
                                                Produtos ({quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"})
                                            </dt>
                                            <dd className="num font-semibold text-[var(--ink)]">
                                                {formatarMoeda(totalPreco)}
                                            </dd>
                                        </div>

                                        {querEntrega ? (
                                            <div className="flex items-center justify-between gap-3">
                                                <dt className="text-[var(--ink-2)]">Frete</dt>
                                                <dd className={`num font-semibold ${cotacao?.gratis ? "text-[var(--verde)]" : "text-[var(--ink)]"}`}>
                                                    {cotacao && cotacao.disponivel
                                                        ? (cotacao.gratis ? "Grátis" : formatarMoeda(cotacao.valor))
                                                        : "a calcular"}
                                                </dd>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-3">
                                                <dt className="text-[var(--ink-2)]">Retirada na loja</dt>
                                                <dd className="num font-semibold text-[var(--verde)]">Grátis</dd>
                                            </div>
                                        )}

                                        <div className="flex items-end justify-between gap-3 border-t border-[var(--linha)] pt-2.5">
                                            <dt className="text-[0.9rem] font-bold text-[var(--ink)]">Total</dt>
                                            <dd className="preco text-[1.35rem]">{formatarMoeda(totalComFrete)}</dd>
                                        </div>

                                    </dl>

                                    {(loja.metodos_pagamento ?? []).length > 0 ? (
                                        <p className="mt-2 text-right text-[0.75rem] text-[var(--ink-2)]">
                                            {(loja.metodos_pagamento ?? []).join(" ou ")}
                                        </p>
                                    ) : null}

                                </div>

                            </>
                        ) : null}

                        {erro ? (
                            <p role="alert" className="mt-3 rounded-[var(--radius-sm)] border-l-[3px] border-[var(--vermelho)] bg-[var(--erro-fundo)] px-3 py-2.5 text-[0.8rem] font-semibold text-[var(--vermelho)]">
                                {erro}
                            </p>
                        ) : null}

                        <div className="mt-4 space-y-2">
                            {conta ? (
                                <>
                                    {/* Duas formas de fechar, e a ordem importa: quem
                                        paga agora resolve tudo sozinho, e por isso vem
                                        primeiro. Combinar na conversa é o caminho de
                                        quem prefere falar com a loja — e é o único que
                                        existe quando ela não conectou provedor. */}
                                    {loja.aceita_pagamento && !soCombina ? (
                                        <button type="submit" disabled={enviando} className="btn w-full py-3.5 text-[0.95rem]">
                                            {enviando ? "enviando…" : "ir para o pagamento"}
                                        </button>
                                    ) : null}

                                    {loja.combina_no_whatsapp ? (
                                        <button
                                            type="button"
                                            disabled={enviando}
                                            onClick={() => void enviarPedido(undefined, "whatsapp")}
                                            className={`w-full py-3.5 text-[0.95rem] ${soCombina ? "btn" : "btn btn-claro"}`}
                                        >
                                            {enviando ? "enviando…" : "combinar o pagamento no WhatsApp"}
                                        </button>
                                    ) : null}

                                    <p className="flex items-center justify-center gap-1.5 text-center text-[0.72rem] text-[var(--ink-3)]">
                                        <FiLock className="w-3 shrink-0" aria-hidden />
                                        {soCombina
                                            ? "Seu pedido fica reservado e você acerta o pagamento direto com a loja."
                                            : "O pagamento acontece no ambiente do provedor"}
                                    </p>
                                </>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => setEtapa("carrinho")}
                                disabled={enviando}
                                className="w-full py-2 text-xs font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]"
                            >
                                voltar à sacola
                            </button>
                        </div>
                    </form>

                ) : itens.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center sm:px-6">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--placa)]">
                            <FiShoppingBag className="w-7 text-[var(--ink-3)]" aria-hidden />
                        </span>

                        <p className="text-[0.95rem] font-bold text-[var(--ink)]">{t("sacola.vazia_titulo", "Sua sacola está vazia")}</p>

                        <p className="max-w-[16rem] text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                            {t("sacola.vazia_texto", "Escolha os produtos na vitrine e eles aparecem aqui.")}
                        </p>

                        {/* "escolher peças" saiu: esta loja vende ventilador e
                            perfume também. */}
                        <button type="button" onClick={fecharTudo} className="btn btn-claro mt-2">
                            {t("sacola.vazia_botao", "ver produtos")}
                        </button>
                    </div>
                ) : (
                    <>
                        <ul className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                            {itens.map((item) => {

                                const unitario = item.produto.preco_promocional ?? item.produto.preco
                                const subtotal = unitario * item.quantidade
                                const variacao = descreverVariacao(item.produto)

                                return (

                                    <li key={item.produto.id} className="card flex gap-3 p-2.5">

                                        {/* Fundo branco e borda, como na
                                            vitrine: a placa cinza deixava a
                                            foto de produto (que quase sempre já
                                            vem com fundo branco) com um
                                            retângulo claro no meio do cinza. */}
                                        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--linha-suave)] bg-white p-1 sm:h-24 sm:w-20">
                                            {item.produto.imagem_url ? (
                                                <img
                                                    src={item.produto.imagem_url}
                                                    alt={item.produto.nome}
                                                    className="h-full w-full object-contain"
                                                />
                                            ) : (
                                                <FiCamera className="w-5 text-[var(--ink-3)]" aria-hidden />
                                            )}
                                        </div>

                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">

                                            <div className="flex items-start justify-between gap-2">

                                                <div className="min-w-0">
                                                    <p className="line-clamp-2 text-[0.82rem] leading-snug text-[var(--ink)] first-letter:uppercase">
                                                        {item.produto.nome}
                                                    </p>

                                                    {variacao ? (
                                                        <p className="mt-0.5 truncate text-[0.72rem] capitalize text-[var(--ink-3)]">
                                                            {variacao}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                {/* Remover virou ícone e foi
                                                    para a quina: escrito, ele
                                                    tinha o mesmo peso visual
                                                    dos botões de quantidade, e
                                                    é a única ação da linha que
                                                    não tem volta. */}
                                                <button
                                                    type="button"
                                                    onClick={() => remover(item.produto.id)}
                                                    aria-label={`Remover ${item.produto.nome} da sacola`}
                                                    className="-m-1 shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--ink-3)] transition-colors hover:text-[var(--vermelho)]"
                                                >
                                                    <FiTrash2 className="w-4" aria-hidden />
                                                </button>
                                            </div>

                                            <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2">

                                                {/* O seletor virou um grupo
                                                    fechado, com os três
                                                    elementos dentro da mesma
                                                    borda — é o desenho que faz
                                                    a pessoa entender que os
                                                    dois botões mexem no número
                                                    do meio. */}
                                                <div className="flex items-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--linha)]">
                                                    <button
                                                        type="button"
                                                        onClick={() => definirQuantidade(item.produto.id, item.quantidade - 1)}
                                                        disabled={item.quantidade <= 1}
                                                        aria-label="Diminuir quantidade"
                                                        className="flex h-8 w-8 items-center justify-center text-[var(--ink-2)] transition-colors hover:bg-[var(--placa)] disabled:cursor-not-allowed disabled:opacity-35"
                                                    >
                                                        <FiMinus className="w-3" aria-hidden />
                                                    </button>

                                                    <span className="num w-8 border-x border-[var(--linha)] py-1 text-center text-[0.82rem] font-semibold text-[var(--ink)]">
                                                        {item.quantidade}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => definirQuantidade(item.produto.id, item.quantidade + 1)}
                                                        disabled={item.quantidade >= item.produto.estoque}
                                                        aria-label="Aumentar quantidade"
                                                        className="flex h-8 w-8 items-center justify-center text-[var(--ink-2)] transition-colors hover:bg-[var(--placa)] disabled:cursor-not-allowed disabled:opacity-35"
                                                    >
                                                        <FiPlus className="w-3" aria-hidden />
                                                    </button>
                                                </div>

                                                <div className="text-right">
                                                    {/* O valor da LINHA, que é
                                                        o que a pessoa confere
                                                        na sacola. O unitário
                                                        fica em cima, pequeno, e
                                                        só quando há mais de um
                                                        — com um item os dois
                                                        números seriam iguais. */}
                                                    {item.quantidade > 1 ? (
                                                        <p className="num text-[0.7rem] text-[var(--ink-3)]">
                                                            {item.quantidade} × {formatarMoeda(unitario)}
                                                        </p>
                                                    ) : null}

                                                    <p className="preco text-[1.05rem]">{formatarMoeda(subtotal)}</p>
                                                </div>

                                            </div>

                                            {item.quantidade >= item.produto.estoque ? (
                                                <p className="text-[0.7rem] font-semibold text-[var(--coral)]">
                                                    é tudo o que a loja tem deste item
                                                </p>
                                            ) : null}

                                        </div>
                                    </li>
                                )
                            })}
                        </ul>

                        {/* O RESUMO.
                            Era uma linha só: "Total". Numa loja de verdade o
                            resumo é onde a conta fica clara ANTES de o cliente
                            entregar endereço e cartão — subtotal, frete e
                            total, cada um na sua linha. Frete só aparece
                            depois de cotado: escrever "Frete: a calcular" no
                            primeiro passo é ansiedade de graça, e escrever
                            "grátis" sem saber é mentira. */}
                        <div className="border-t border-[var(--linha)] bg-[var(--placa)] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">

                            <dl className="space-y-1.5 text-[0.82rem]">

                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-[var(--ink-2)]">
                                        Subtotal ({quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"})
                                    </dt>
                                    <dd className="num font-semibold text-[var(--ink)]">
                                        {formatarMoeda(totalPreco)}
                                    </dd>
                                </div>

                                {cotacao && cotacao.disponivel && querEntrega ? (
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-[var(--ink-2)]">Frete</dt>
                                        <dd className={`num font-semibold ${cotacao.gratis ? "text-[var(--verde)]" : "text-[var(--ink)]"}`}>
                                            {cotacao.gratis ? "Grátis" : formatarMoeda(cotacao.valor)}
                                        </dd>
                                    </div>
                                ) : null}

                                <div className="flex items-end justify-between gap-3 border-t border-[var(--linha)] pt-2.5">
                                    <dt className="text-[0.9rem] font-bold text-[var(--ink)]">Total</dt>
                                    <dd className="preco text-[1.35rem]">{formatarMoeda(totalComFrete)}</dd>
                                </div>

                            </dl>

                            {/* Como se paga, dito ANTES de sair da loja: quem
                                está com a sacola na mão quer saber disso agora,
                                não depois de preencher o endereço. A lista vem
                                do provedor que a loja conectou — não se promete
                                meio de pagamento que ela não tem. */}
                            {(loja.metodos_pagamento ?? []).length > 0 ? (
                                <p className="mt-2 text-right text-[0.75rem] text-[var(--ink-2)]">
                                    {/* Sem toLowerCase: "pix" com p minúsculo é
                                        erro de grafia à vista do cliente, e a
                                        lista vem do provedor já escrita certa. */}
                                    {(loja.metodos_pagamento ?? []).join(" ou ")}
                                </p>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => setEtapa("checkout")}
                                className="btn mt-3.5 w-full py-3.5 text-[0.95rem]"
                            >
                                continuar
                            </button>

                            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[0.72rem] text-[var(--ink-3)]">
                                <FiLock className="w-3 shrink-0" aria-hidden />
                                Compra segura · seus dados de cartão não passam por esta loja
                            </p>

                            <div className="mt-2 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={fecharTudo}
                                    className="py-2 text-xs font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]"
                                >
                                    continuar comprando
                                </button>

                                <button
                                    type="button"
                                    onClick={limpar}
                                    className="py-2 text-xs text-[var(--ink-3)] transition-colors hover:text-[var(--vermelho)]"
                                >
                                    esvaziar sacola
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </aside>
        </div>
    )
}

/* ==========================================================================
   As peças do checkout
   ========================================================================== */

/** Um passo da régua de progresso do topo. */
function Passo({ numero, rotulo, estado }: {
    numero: number
    rotulo: string
    estado: "feito" | "agora" | "depois"
}) {

    const cores = {
        feito: "bg-[var(--verde)] text-white",
        agora: "bg-[var(--destaque)] text-[var(--sobre-destaque)]",
        depois: "bg-[var(--placa-forte)] text-[var(--ink-3)]",
    }[estado]

    return (
        <li className="flex min-w-0 items-center gap-1.5" aria-current={estado === "agora" ? "step" : undefined}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold ${cores}`}>
                {estado === "feito" ? <FiCheck className="w-3" aria-hidden /> : numero}
            </span>

            <span className={`truncate ${estado === "depois" ? "text-[var(--ink-3)]" : "text-[var(--ink)]"}`}>
                {rotulo}
            </span>
        </li>
    )
}

/** O fio entre dois passos. */
function Traco() {
    return <li aria-hidden className="h-px min-w-2 flex-1 bg-[var(--linha)]" />
}

/**
 * Uma etapa do formulário, numerada.
 *
 * O número não é enfeite: um checkout é uma sequência, e sem a numeração os
 * blocos viram uma pilha de campos em que ninguém sabe quanto falta.
 */
function Secao({ numero, titulo, children }: {
    numero: number
    titulo: string
    children: React.ReactNode
}) {
    return (
        <section className="card mb-3 p-4">

            <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--destaque)] text-[0.72rem] font-bold text-[var(--sobre-destaque)]">
                    {numero}
                </span>

                <h3 className="text-[0.88rem] font-bold text-[var(--ink)]">{titulo}</h3>
            </div>

            {children}
        </section>
    )
}

/** Retirar ou receber, como cartão escolhível. */
function OpcaoEntrega({ escolhida, aoEscolher, Icone, titulo, texto }: {
    escolhida: boolean
    aoEscolher: () => void
    Icone: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    titulo: string
    texto: string
}) {
    return (
        <button
            type="button"
            onClick={aoEscolher}
            aria-pressed={escolhida}
            className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border-2 p-3 text-left transition-colors ${
                escolhida
                    ? "border-[var(--destaque)] bg-[color-mix(in_srgb,var(--destaque)_6%,var(--fundo))]"
                    : "border-[var(--linha)] hover:border-[var(--ink-3)]"
            }`}
        >
            <Icone
                className={`mt-0.5 w-4 shrink-0 ${escolhida ? "text-[var(--destaque)]" : "text-[var(--ink-3)]"}`}
                aria-hidden
            />

            <span className="min-w-0">
                <span className={`block text-[0.82rem] font-bold ${escolhida ? "text-[var(--destaque)]" : "text-[var(--ink)]"}`}>
                    {titulo}
                </span>

                <span className="mt-0.5 block line-clamp-2 text-[0.72rem] leading-snug text-[var(--ink-3)]">
                    {texto}
                </span>
            </span>
        </button>
    )
}
