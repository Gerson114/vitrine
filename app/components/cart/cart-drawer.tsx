"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FiCamera, FiCheck, FiHome, FiLock, FiMinus, FiPlus, FiShoppingBag, FiTrash2, FiTruck, FiUser, FiX } from "react-icons/fi"
import { ENTREGA_VAZIA, useCarrinho } from "@/app/cart/cart-context"
import type { Cotacao, Entrega } from "@/app/cart/cart-context"
import { useLoja, useTexto } from "@/app/loja/loja-context"
import type { AtendimentoDaLoja } from "@/app/loja/loja-context"
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

    /* A hora que a pessoa marcou, no formato do <input type="datetime-local">
       ("2026-09-15T12:30"). Vazio é "para agora".

       Nasce vazio mesmo na loja que SÓ agenda: preencher com um palpite faria
       alguém fechar sem ler, e a hora da entrega de comida não é detalhe. */
    const [agendadoPara, setAgendadoPara] = useState("")

    /* Para agora, ou marcado para depois.
    
       É uma escolha explícita, com dois botões, e não um campo de data que a
       pessoa deixa em branco. Deixar em branco "querendo agora" funciona para
       quem leu a tela inteira; quem só quer pedir a pizza passa direto e nunca
       descobre que dava para marcar. Na cozinha que só agenda, a escolha não
       existe e o campo é obrigatório. */
    const [quando, setQuando] = useState<"agora" | "agendado">("agora")

    /* Pagar tudo agora, ou só a entrada.
    
       Nasce em "tudo": quem não parou para escolher paga o pedido inteiro, que
       é o que a loja prefere e o que o cliente espera. A entrada é uma escolha
       consciente, com o valor escrito ao lado — não um padrão que alguém
       descobre no extrato. */
    const [pagamento, setPagamento] = useState<"tudo" | "entrada">("tudo")
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

    /* ------------------------------------------------------------------
       COMIDA: a hora e o mínimo

       A loja de mercadoria não passa por nada disto — `atendimento` chega
       com ramo "produtos" e as duas regras somem da tela. Quem decide é o
       servidor, sempre: estes valores só existem aqui para a pessoa saber
       antes de clicar, em vez de descobrir na recusa.
       ------------------------------------------------------------------ */
    const atendimento = loja.atendimento
    const ehComida = atendimento?.ramo === "comida"
    const agenda = Boolean(atendimento?.aceita_agendamento)
    const aceitaNaHora = Boolean(atendimento?.aceita_na_hora)
    const soAgendado = Boolean(ehComida && agenda && !aceitaNaHora)
    const preparo = atendimento?.minutos_de_preparo ?? 0

    // Na cozinha que SÓ agenda não há escolha a fazer: o modo é agendado,
    // qualquer que seja o botão que a pessoa não viu.
    const modoDaEntrega = soAgendado ? "agendado" : quando

    const perguntaQuando = ehComida && (agenda || preparo > 0)

    /* A entrada: uma parte agora, o resto na entrega.

       Só aparece com provedor de pagamento conectado. Combinar no WhatsApp já
       é um acerto direto entre as duas pessoas — parcelar o que já é combinado
       na conversa seria uma regra a mais para explicar e nenhuma a menos para
       cumprir.

       O valor é calculado aqui para a pessoa LER antes de decidir, mas quem
       manda é o servidor: ele recalcula sobre o pedido gravado e congela lá. */
    const ofereceEntrada = Boolean(atendimento?.aceita_entrada) && Boolean(loja.aceita_pagamento)
    const percentualDaEntrada = atendimento?.percentual_da_entrada ?? 50

    /* Existe algum caminho para fechar este pedido?
    
       São dois: o provedor de pagamento da loja, e combinar na conversa. Sem
       nenhum dos dois não há botão a desenhar — e é justamente aí que a tela
       precisa falar, em vez de terminar em branco. */
    const temComoPagar = Boolean(loja.aceita_pagamento) || Boolean(loja.combina_no_whatsapp)

    const valorDaEntrada = Math.round(totalComFrete * percentualDaEntrada) / 100
    const valorDoRestante = totalComFrete - valorDaEntrada

    /* Os números dos passos, contados UMA vez e na ordem em que as seções
       aparecem.
    
       Cada seção calculava o próprio número com uma conta sua — e no dia em
       que "Quando você quer receber" entrou no meio, ela e "Endereço de
       entrega" passaram a mostrar "4" as duas. Contar num lugar só é o que
       impede a próxima seção de repetir o erro: quem entra no meio não precisa
       saber de ninguém. */
    const numeroDaSecao = (() => {

        let atual = 0
        const proximo = () => ++atual

        return {
            quemCompra: proximo(),
            comoReceber: podeEntregar && podeRetirar ? proximo() : 0,
            contato: proximo(),
            quando: perguntaQuando ? proximo() : 0,
            endereco: querEntrega ? proximo() : 0,
            pagamento: ofereceEntrada ? proximo() : 0,
        }
    })()

    const minimo = atendimento?.pedido_minimo ?? 0
    const faltaParaOMinimo = minimo > 0 ? minimo - totalPreco : 0
    const abaixoDoMinimo = faltaParaOMinimo > 0.005

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

        // Quem não disse a forma está submetendo o FORMULÁRIO, e numa loja que
        // só combina na conversa isso é o WhatsApp — não existe outra.
        //
        // O defeito que isto corrige: o único botão type="submit" é o "ir para
        // o pagamento", e ele não é renderizado quando soCombina. O do WhatsApp
        // é type="button" com onClick. Só que formulário com campo de texto
        // submete no Enter mesmo sem botão de submit, e digitar o telefone e
        // apertar Enter é o gesto mais comum que existe. Nesse caminho a forma
        // chegava vazia, o backend pulava o trecho do WhatsApp e tentava abrir
        // cobrança numa loja sem provedor — a pessoa lia "esta loja ainda não
        // está aceitando pagamento pelo site" numa loja que aceita, só que pela
        // conversa.
        const comoPaga = forma ?? (soCombina ? "whatsapp" : undefined)

        // O botão do WhatsApp é type="button" e não passa pelo `required` do
        // formulário: sem esta conferência, quem escolhesse "Agendar" e não
        // marcasse a hora fecharia o pedido como se fosse para agora.
        if (modoDaEntrega === "agendado" && agendadoPara.trim() === "") {
            setErro("Escolha o dia e a hora da entrega.")
            return
        }

        setEnviando(true)
        setErro("")

        const resultado = await finalizarPedido({
            ...entrega,
            tipo: querEntrega ? "entrega" : "retirada",
        }, comoPaga, modoDaEntrega === "agendado" ? agendadoPara : "", ofereceEntrada && pagamento === "entrada")

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
                            <Secao numero={numeroDaSecao.quemCompra} titulo={t("sacola.quem_compra", "Quem está comprando")}>
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
                                    <Secao numero={numeroDaSecao.comoReceber} titulo={t("sacola.como_receber", "Como você quer receber")}>
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
                                    numero={numeroDaSecao.contato}
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

                                {/* ---------------------------------------------
                                    QUANDO

                                    Só na loja de comida. A de mercadoria não
                                    pergunta hora nenhuma: o prazo dela é o do
                                    frete, e quem escolhe é a transportadora.
                                    --------------------------------------------- */}
                                {perguntaQuando ? (
                                    <Secao
                                        numero={numeroDaSecao.quando}
                                        titulo="Quando você quer receber"
                                    >
                                        {/* Os dois caminhos, lado a lado, quando a
                                            cozinha faz os dois. O tempo de preparo
                                            fica DENTRO do botão "para agora": é a
                                            resposta da pergunta que a pessoa está
                                            fazendo ao clicar nele. */}
                                        {agenda && aceitaNaHora ? (
                                            <div className="grid grid-cols-2 gap-2">

                                                <Escolha
                                                    escolhida={modoDaEntrega === "agora"}
                                                    aoEscolher={() => { setQuando("agora"); setAgendadoPara("") }}
                                                    titulo="Para agora"
                                                    detalhe={preparo > 0 ? `fica pronto em ~${preparo} min` : "assim que der"}
                                                />

                                                <Escolha
                                                    escolhida={modoDaEntrega === "agendado"}
                                                    aoEscolher={() => setQuando("agendado")}
                                                    titulo="Agendar"
                                                    detalhe="escolher dia e hora"
                                                />
                                            </div>
                                        ) : null}

                                        {modoDaEntrega === "agendado" ? (
                                            <div className={agenda && aceitaNaHora ? "mt-3" : ""}>
                                                <label className="rotulo-campo" htmlFor="agendado">Dia e hora</label>

                                                <input
                                                    id="agendado"
                                                    type="datetime-local"
                                                    value={agendadoPara}
                                                    onChange={(e) => setAgendadoPara(e.target.value)}
                                                    min={horarioMinimo(atendimento?.minutos_de_antecedencia ?? 0)}
                                                    max={horarioMaximo(atendimento?.dias_para_agendar ?? 7)}
                                                    required
                                                    className="campo mt-1.5"
                                                />

                                                <p className="mt-1.5 text-[0.72rem] text-[var(--ink-3)]">
                                                    {textoDaAgenda(atendimento)}
                                                </p>
                                            </div>
                                        ) : null}

                                        {/* A cozinha que só faz na hora não tem o
                                            que perguntar — mas tem o que prometer,
                                            e é a primeira pergunta de quem pede
                                            comida. */}
                                        {!agenda && preparo > 0 ? (
                                            <p className="text-[0.8rem] text-[var(--ink-2)]">
                                                A loja prepara em cerca de {preparo} minutos depois de
                                                confirmar o pedido.
                                            </p>
                                        ) : null}
                                    </Secao>
                                ) : null}

                                {querEntrega ? (
                                    <Secao
                                        numero={numeroDaSecao.endereco}
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
                            {/* O mínimo da loja, dito ANTES do botão e com o
                                quanto falta. "Pedido mínimo R$ 30" sozinho faz
                                a pessoa somar de cabeça; "faltam R$ 8,50" faz
                                ela voltar e pôr mais um item. */}
                            {abaixoDoMinimo ? (
                                <p className="rounded-[var(--radius-md)] bg-[var(--placa)] px-4 py-3 text-center text-[0.8rem] text-[var(--ink-2)]">
                                    Esta loja fecha pedido a partir de{" "}
                                    <strong className="font-bold text-[var(--ink)]">{formatarMoeda(minimo)}</strong>.
                                    Faltam <strong className="font-bold text-[var(--ink)]">{formatarMoeda(faltaParaOMinimo)}</strong>.
                                </p>
                            ) : null}

            {/* ---------------------------------------------------------
                PAGAR TUDO, OU SÓ A ENTRADA

                É uma SEÇÃO numerada como as outras, e não um par de caixas
                solto acima do botão. Foi assim que nasceu, e ninguém a viu:
                sem título, dois retângulos entre o resumo e o botão não se
                leem como uma pergunta — leem-se como enfeite, e a pessoa
                clica em "ir para o pagamento" sem saber que havia escolha.

                Some quando a loja não parcela, que é o caso da maioria. */}
            {conta && ofereceEntrada ? (
                <Secao numero={numeroDaSecao.pagamento} titulo="Como você quer pagar">
                    <div className="grid grid-cols-2 gap-2">

                        <Escolha
                            escolhida={pagamento === "tudo"}
                            aoEscolher={() => setPagamento("tudo")}
                            titulo="Pagar tudo agora"
                            detalhe={formatarMoeda(totalComFrete)}
                        />

                        <Escolha
                            escolhida={pagamento === "entrada"}
                            aoEscolher={() => setPagamento("entrada")}
                            titulo={`Entrada de ${percentualDaEntrada}%`}
                            detalhe={`${formatarMoeda(valorDaEntrada)} agora`}
                        />
                    </div>

                    {/* O que sobra, dito com todas as letras: quem escolhe
                        entrada precisa saber quanto vai pagar na porta, e
                        descobrir isso na entrega é como se perde um cliente. */}
                    {pagamento === "entrada" ? (
                        <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--placa)] px-4 py-3 text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                            Você paga{" "}
                            <strong className="num font-bold text-[var(--ink)]">{formatarMoeda(valorDaEntrada)}</strong>{" "}
                            agora e os{" "}
                            <strong className="num font-bold text-[var(--ink)]">{formatarMoeda(valorDoRestante)}</strong>{" "}
                            restantes direto para a loja na entrega.
                        </p>
                    ) : null}
                </Secao>
            ) : null}


                            {conta ? (
                                <>
                                    {/* Duas formas de fechar, e a ordem importa: quem
                                        paga agora resolve tudo sozinho, e por isso vem
                                        primeiro. Combinar na conversa é o caminho de
                                        quem prefere falar com a loja — e é o único que
                                        existe quando ela não conectou provedor. */}
                                    {loja.aceita_pagamento && !soCombina ? (
                                        <button type="submit" disabled={enviando || abaixoDoMinimo} className="btn w-full py-3.5 text-[0.95rem]">
                                            {enviando
                                                ? "enviando…"
                                                : ofereceEntrada && pagamento === "entrada"
                                                    ? `pagar a entrada · ${formatarMoeda(valorDaEntrada)}`
                                                    : "ir para o pagamento"}
                                        </button>
                                    ) : null}

                                    {loja.combina_no_whatsapp ? (
                                        <button
                                            type="button"
                                            disabled={enviando || abaixoDoMinimo}
                                            onClick={() => void enviarPedido(undefined, "whatsapp")}
                                            className={`w-full py-3.5 text-[0.95rem] ${soCombina ? "btn" : "btn btn-claro"}`}
                                        >
                                            {enviando ? "enviando…" : "combinar o pagamento no WhatsApp"}
                                        </button>
                                    ) : null}

                                    {/* Loja sem provedor e sem WhatsApp: não há
                                        botão nenhum a mostrar, e antes disto a
                                        tela simplesmente terminava — o comprador
                                        chegava ao fim do checkout, com endereço
                                        preenchido, e não tinha o que clicar.
                                        Pior: lia "o pagamento acontece no
                                        ambiente do provedor" numa loja que não
                                        conectou provedor nenhum.
                                    
                                        Dizer o que está faltando não conserta a
                                        loja, mas devolve a saída a quem estava
                                        preso: fale com a gente. */}
                                    {!temComoPagar ? (
                                        <p className="rounded-[var(--radius-md)] bg-[var(--placa)] px-4 py-3 text-center text-[0.8rem] leading-relaxed text-[var(--ink-2)]">
                                            Esta loja ainda não configurou como receber pagamento pelo site.
                                            Fale com ela para combinar o seu pedido.
                                        </p>
                                    ) : (
                                        <p className="flex items-center justify-center gap-1.5 text-center text-[0.72rem] text-[var(--ink-3)]">
                                            <FiLock className="w-3 shrink-0" aria-hidden />
                                            {soCombina
                                                ? "Seu pedido fica reservado e você acerta o pagamento direto com a loja."
                                                : "O pagamento acontece no ambiente do provedor"}
                                        </p>
                                    )}
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

                                // O preço da linha inclui o que foi escolhido:
                                // "pizza R$ 45 + borda R$ 8" custa R$ 53, e
                                // mostrar R$ 45 aqui faria o total da sacola
                                // não bater com a soma das linhas.
                                const unitario = (item.produto.preco_promocional ?? item.produto.preco) +
                                    (item.adicionais ?? []).reduce((soma, a) => soma + a.preco, 0)

                                const subtotal = unitario * item.quantidade
                                const variacao = descreverVariacao(item.produto)

                                return (

                                    <li key={item.id} className="card flex gap-3 p-2.5">

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

                                                    {/* O que foi escolhido e o
                                                        recado, na própria linha:
                                                        é o que separa esta linha
                                                        da outra do mesmo produto,
                                                        e sem isso as duas ficam
                                                        idênticas na tela. */}
                                                    {item.adicionais && item.adicionais.length > 0 ? (
                                                        <p className="mt-0.5 text-[0.72rem] leading-snug text-[var(--ink-2)]">
                                                            {item.adicionais.map((a) => a.nome).join(" · ")}
                                                        </p>
                                                    ) : null}

                                                    {item.observacao ? (
                                                        <p className="mt-0.5 text-[0.72rem] italic leading-snug text-[var(--ink-3)]">
                                                            “{item.observacao}”
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
                                                    onClick={() => remover(item.id)}
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
                                                        onClick={() => definirQuantidade(item.id, item.quantidade - 1)}
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
                                                        onClick={() => definirQuantidade(item.id, item.quantidade + 1)}
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

/* ==========================================================================
   A agenda da comida

   As três funções abaixo só desenham o que dá para escolher. Quem RECUSA uma
   hora fora do combinado é o servidor (ver resolverAgendamento): o campo aqui
   evita que a pessoa escolha errado, não que ela mande errado.
   ========================================================================== */

/** O primeiro horário que a loja aceita, no formato do campo. */
function horarioMinimo(minutosDeAntecedencia: number): string {
    return paraOCampo(new Date(Date.now() + minutosDeAntecedencia * 60_000))
}

/** O último dia da agenda, no fim daquele dia. */
function horarioMaximo(dias: number): string {

    const limite = new Date()

    limite.setDate(limite.getDate() + dias)
    limite.setHours(23, 59, 0, 0)

    return paraOCampo(limite)
}

/**
 * Um instante no formato que o <input type="datetime-local"> entende.
 *
 * Montado a partir da hora LOCAL, e não de toISOString(): aquele devolve UTC,
 * e num país a três horas de Greenwich o campo abriria com a hora errada — e
 * o mínimo cairia três horas antes do que a loja aceita.
 */
function paraOCampo(quando: Date): string {

    const doisDigitos = (n: number) => String(n).padStart(2, "0")

    return `${quando.getFullYear()}-${doisDigitos(quando.getMonth() + 1)}-${doisDigitos(quando.getDate())}` +
        `T${doisDigitos(quando.getHours())}:${doisDigitos(quando.getMinutes())}`
}

/** A explicação embaixo do campo, nas palavras da regra que a loja escolheu. */
function textoDaAgenda(atendimento?: AtendimentoDaLoja): string {

    if (!atendimento) return ""

    const antecedencia = atendimento.minutos_de_antecedencia ?? 0
    const dias = atendimento.dias_para_agendar ?? 7

    const quanto = antecedencia >= 1440 && antecedencia % 1440 === 0
        ? `${antecedencia / 1440} dia(s)`
        : antecedencia >= 60 && antecedencia % 60 === 0
            ? `${antecedencia / 60} hora(s)`
            : `${antecedencia} minutos`

    const comAntecedencia = antecedencia > 0 ? `com pelo menos ${quanto} de antecedência, ` : ""

    return `A loja aceita ${comAntecedencia}até ${dias} dia(s) à frente.`
}

/**
 * Uma escolha entre duas, do tamanho de um alvo de dedo.
 *
 * O estado escolhido precisa ser ÓBVIO, e a primeira versão errou exatamente
 * nisso: um fundo com 8% da cor da marca some num tema claro, e as duas
 * opções ficavam idênticas na tela. Quem olhou não viu escolha nenhuma —
 * viu dois retângulos, e clicou no botão de baixo.
 *
 * O que marca agora são três coisas ao mesmo tempo, e nenhuma depende de o
 * tema da loja ter contraste: a borda de 2px na cor da marca, o texto em
 * negrito e o círculo com o "certo" dentro. Em preto e branco, em amarelo ou
 * em azul-marinho, dá para ver qual está escolhida.
 */
function Escolha({ escolhida, aoEscolher, titulo, detalhe }: {
    escolhida: boolean
    aoEscolher: () => void
    titulo: string
    detalhe: string
}) {

    return (
        <button
            type="button"
            onClick={aoEscolher}
            aria-pressed={escolhida}
            className={`flex items-start gap-2.5 rounded-[var(--radius-md)] px-3 py-3 text-left transition-colors ${
                escolhida
                    ? "border-2 border-[var(--destaque)] bg-[var(--fundo)]"
                    : "border border-[var(--linha)] hover:bg-[var(--placa)]"
            }`}
        >
            <span
                aria-hidden
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    escolhida
                        ? "border-[var(--destaque)] bg-[var(--destaque)] text-[var(--sobre-destaque)]"
                        : "border-[var(--linha-forte)]"
                }`}
            >
                {escolhida ? <FiCheck className="w-2.5" /> : null}
            </span>

            <span className="min-w-0">
                <span className={`block text-[0.85rem] text-[var(--ink)] ${escolhida ? "font-bold" : "font-semibold"}`}>
                    {titulo}
                </span>

                <span className="num mt-0.5 block text-[0.72rem] text-[var(--ink-2)]">
                    {detalhe}
                </span>
            </span>
        </button>
    )
}
