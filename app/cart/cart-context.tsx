"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Produto } from "@/app/type/type"

/** Uma escolha do cliente sobre o item: "Catupiry", "Ao ponto". */
export interface AdicionalEscolhido {
    opcao_id: number
    grupo: string
    nome: string
    preco: number
}

export interface ItemCarrinho {
    /**
     * A identidade da LINHA, e não a do produto.
     *
     * Aqui estava o id do produto, e ele deixou de servir no dia em que o
     * item passou a ter escolhas: "pizza com borda" e "pizza sem borda" são
     * o mesmo produto e duas linhas da sacola. A linha é o produto mais o
     * que foi escolhido mais o recado — mudou qualquer um dos três, é outra
     * linha.
     */
    id: string

    produto: Produto
    quantidade: number

    /** O que foi escolhido junto. Vazio na loja que não faz perguntas. */
    adicionais?: AdicionalEscolhido[]

    /** O recado do cliente sobre este item: "sem cebola". */
    observacao?: string
}

/**
 * A identidade de uma linha da sacola.
 *
 * Os ids das opções vão ORDENADOS: escolher catupiry e depois cheddar tem de
 * cair na mesma linha que escolher cheddar e depois catupiry — é o mesmo
 * pedido, e duas linhas iguais na sacola é defeito que o cliente vê.
 */
function identidadeDaLinha(
    produtoID: number,
    adicionais: AdicionalEscolhido[] | undefined,
    observacao: string | undefined,
): string {

    const escolhas = (adicionais ?? []).map((a) => a.opcao_id).sort((a, b) => a - b).join(".")

    return `${produtoID}|${escolhas}|${(observacao ?? "").trim().toLowerCase()}`
}

export interface ResultadoPedido {
    ok: boolean
    mensagem: string
    codigo?: string
    /** A sessão acabou (ou nunca existiu): a tela manda criar conta. */
    precisaEntrar?: boolean
    /** Para onde o cliente vai pagar. O pedido só vira venda depois disso. */
    urlPagamento?: string
}

/** O endereço e o contato que o cliente preencheu no checkout. */
export interface Entrega {
    /** "entrega" ou "retirada". */
    tipo: string

    /**
     * O WhatsApp de quem está comprando.
     *
     * Vale para os dois tipos, e não só para a entrega: é por ele que a loja
     * avisa que o pagamento entrou e que a mercadoria saiu — e é por ele que
     * ela liga quando o entregador não acha a casa. E-mail a conta já tem;
     * e-mail não avisa ninguém aqui.
     */
    telefone: string

    cep: string
    logradouro: string
    numero: string
    complemento: string
    bairro: string
    cidade: string
}

/** A resposta de "quanto custa entregar aqui". */
export interface Cotacao {
    /** Falso é a loja que não entrega: a tela nem pede endereço. */
    disponivel: boolean
    retirada_na_loja: boolean
    uf?: string
    valor: number
    prazo_dias: number

    /**
     * O valor caiu a zero pela isenção de carrinho alto, e não porque a regra
     * é zero. A tela escreve "Frete grátis" em vez de "R$ 0,00", que parece
     * defeito.
     */
    gratis: boolean
}

export const ENTREGA_VAZIA: Entrega = {
    tipo: "retirada",
    telefone: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
}

interface CarrinhoContextValor {
    itens: ItemCarrinho[]
    adicionar: (produto: Produto, adicionais?: AdicionalEscolhido[], observacao?: string) => void
    remover: (linhaId: string) => void
    definirQuantidade: (linhaId: string, quantidade: number) => void
    limpar: () => void
    totalItens: number
    totalPreco: number
    aberto: boolean
    abrir: () => void
    fechar: () => void
    finalizarPedido: (
        entrega: Entrega,
        forma?: "whatsapp",
        agendadoPara?: string,
        entrada?: boolean,
    ) => Promise<ResultadoPedido>

    /** Quanto custa entregar num CEP, perguntado ao servidor. */
    cotarFrete: (cep: string) => Promise<Cotacao>
}

const CarrinhoContext = createContext<CarrinhoContextValor | null>(null)

// O carrinho é guardado por loja. Sem o endereço na chave, quem visitasse
// duas vitrines veria a sacola de uma aparecer na outra — e o pedido sairia
// com produto que aquela loja não vende.
function chaveStorage(loja: string): string {
    return `carrinho:${loja}`
}

function precoUnitario(produto: Produto): number {
    return produto.preco_promocional ?? produto.preco
}

/**
 * A sacola salva, conferida antes de virar estado.
 *
 * O que está no localStorage não é dado confiável: é texto que sobrevive a
 * versões do site, que o dono do navegador pode editar à mão e que fica lá
 * depois de o formato ter mudado. `JSON.parse` aceita `"5"` e `{}` sem
 * reclamar — e aí o primeiro `itens.reduce` do total lança TypeError DENTRO de
 * um Provider que embrulha a vitrine inteira, o que na prática é a loja toda
 * em tela branca para quem tinha aquela sacola. Sem jeito de sair, porque o
 * carrinho é recarregado no próximo acesso.
 *
 * Linha sem produto, sem id ou com quantidade que não é número positivo é
 * descartada em silêncio: a sacola volta menor, o que é ruim, mas a loja abre.
 */
function sacolaSalva(bruto: string): ItemCarrinho[] {

    const dados: unknown = JSON.parse(bruto)

    if (!Array.isArray(dados)) return []

    return dados.filter((linha): linha is ItemCarrinho => {

        if (!linha || typeof linha !== "object") return false

        const item = linha as Partial<ItemCarrinho>

        if (typeof item.id !== "string" || !item.id) return false
        if (!Number.isFinite(item.quantidade) || (item.quantidade ?? 0) <= 0) return false

        const produto = item.produto as Partial<Produto> | undefined

        // O produto é relido do catálogo em toda tela que mostra preço, mas o
        // total da sacola é somado a partir DESTA cópia: sem id e sem preço
        // numérico ela não serve para somar nada.
        if (!produto) return false

        return Number.isInteger(produto.id) && Number.isFinite(produto.preco)
    })
}

export function CartProvider({
    loja,
    children,
}: {
    /** Endereço da loja desta vitrine (ver app/loja/loja-context). */
    loja: string
    children: React.ReactNode
}) {
    const [itens, setItens] = useState<ItemCarrinho[]>([])
    const [aberto, setAberto] = useState(false)
    const [carregado, setCarregado] = useState(false)

    // Carrega o carrinho salvo depois do mount (client-only). Não dá pra
    // usar lazy init no useState: o servidor não tem localStorage, então o
    // primeiro render do client precisa começar igual ao do servidor
    // (vazio) pra não gerar erro de hidratação — daí o setState no efeito.
    useEffect(() => {
        try {
            const salvo = localStorage.getItem(chaveStorage(loja))
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (salvo) setItens(sacolaSalva(salvo))
        } catch {
            // localStorage indisponível ou dado corrompido: começa vazio.
        } finally {
            setCarregado(true)
        }
    }, [loja])

    // Persiste a cada mudança, depois da carga inicial (evita sobrescrever
    // o storage com [] antes do useEffect acima terminar de ler).
    useEffect(() => {
        if (!carregado) return
        localStorage.setItem(chaveStorage(loja), JSON.stringify(itens))
    }, [itens, carregado, loja])

    const adicionar = useCallback((
        produto: Produto,
        adicionais?: AdicionalEscolhido[],
        observacao?: string,
    ) => {
        setItens((atual) => {

            const id = identidadeDaLinha(produto.id, adicionais, observacao)
            const existente = atual.find((item) => item.id === id)

            // O limite é do PRODUTO, e ele é contado somando todas as linhas
            // dele: três pizzas em duas linhas com bordas diferentes são três
            // unidades da prateleira, e é isso que o estoque tem de aguentar.
            const jaNaSacola = atual
                .filter((item) => item.produto.id === produto.id)
                .reduce((soma, item) => soma + item.quantidade, 0)

            // Quem não conta unidade não tem teto: a pizzaria faz dez pizzas
            // se pedirem dez, e o estoque dela não é um número na prateleira.
            if (!produto.sem_contagem && jaNaSacola >= produto.estoque) return atual

            if (existente) {
                return atual.map((item) =>
                    item.id === id ? { ...item, quantidade: item.quantidade + 1 } : item)
            }

            return [...atual, { id, produto, quantidade: 1, adicionais, observacao }]
        })
    }, [])

    const remover = useCallback((linhaId: string) => {
        setItens((atual) => atual.filter((item) => item.id !== linhaId))
    }, [])

    const definirQuantidade = useCallback((linhaId: string, quantidade: number) => {
        setItens((atual) => {

            const linha = atual.find((item) => item.id === linhaId)

            if (!linha) return atual

            // O teto é o estoque do produto MENOS o que as outras linhas dele
            // já levam: duas linhas da mesma pizza não podem somar mais do que
            // existe na prateleira.
            const nasOutrasLinhas = atual
                .filter((item) => item.produto.id === linha.produto.id && item.id !== linhaId)
                .reduce((soma, item) => soma + item.quantidade, 0)

            const teto = linha.produto.sem_contagem
                ? Number.MAX_SAFE_INTEGER
                : Math.max(1, linha.produto.estoque - nasOutrasLinhas)

            return atual.map((item) =>
                item.id === linhaId
                    ? { ...item, quantidade: Math.min(Math.max(1, quantidade), teto) }
                    : item)
        })
    }, [])

    const limpar = useCallback(() => setItens([]), [])

    const finalizarPedido = useCallback(
        async (
            entrega: Entrega,
            forma?: "whatsapp",
            agendadoPara?: string,
            entrada?: boolean,
        ): Promise<ResultadoPedido> => {
            try {
                const response = await fetch("/api/pedidos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        // A loja vai junto: é ela que decide de qual catálogo
                        // o pedido é, e o backend recusa item que não seja
                        // dela.
                        // Nome e contato não vão mais daqui: o pedido é
                        // assinado pela conta logada, e quem a lê é o
                        // servidor, pelo cookie httpOnly que o navegador nem
                        // enxerga.
                        loja,
                        // Uma linha por linha da sacola, e não uma por produto:
                        // "pizza com borda" e "pizza sem borda" são pedidos
                        // diferentes do mesmo produto, e somá-las perderia
                        // metade do que a cozinha precisa fazer.
                        //
                        // Dos adicionais vai só o ID da opção. Nome e preço o
                        // servidor lê do banco — aceitá-los daqui seria deixar
                        // o comprador escrever quanto a borda custa.
                        itens: itens.map((item) => ({
                            produto_id: item.produto.id,
                            quantidade: item.quantidade,
                            observacao: item.observacao ?? "",
                            adicionais: (item.adicionais ?? []).map((a) => ({ opcao_id: a.opcao_id })),
                        })),

                        // O telefone sobe fora da entrega porque não é
                        // endereço: é o contato do pedido, e vale igual para
                        // quem vem buscar no balcão.
                        telefone: entrega.telefone,

                        // O endereço vai; o valor do frete não. Quem calcula
                        // é o servidor, sobre o CEP e a tabela da loja.
                        entrega,

                        // Como a pessoa escolheu pagar. Vazio é o provedor da
                        // loja; "whatsapp" é combinar na conversa.
                        //
                        // A escolha é conferida no servidor contra o que a
                        // loja oferece: mandar "whatsapp" para uma loja que
                        // não combina não fecha pedido — recusa.
                        forma: forma ?? "",

                        // A hora que a pessoa marcou, nas lojas de comida que
                        // agendam. Vazio é "para agora".
                        //
                        // Conferida no servidor contra a antecedência e a
                        // janela da loja: o campo da tela já só oferece o que
                        // cabe, mas o corpo da requisição vem do navegador e
                        // nada impede alguém de mandar outra coisa.
                        agendado_para: agendadoPara ?? "",

                        // Pagar só uma parte agora. Conferido no servidor
                        // contra a configuração da loja: mandar `true` para
                        // uma loja que não parcela não parte o pedido.
                        entrada: entrada === true,
                    }),
                })

                const dados = await response.json().catch(() => null)

                if (!response.ok) {
                    const erro = dados && typeof dados === "object" && "erro" in dados
                        ? String((dados as { erro: unknown }).erro)
                        : "Não foi possível concluir o pedido."

                    // 401 é o caso de sessão ausente ou vencida. A sacola não
                    // se perde: a pessoa cria conta e volta para ela intacta,
                    // porque o carrinho vive no localStorage desta loja.
                    return { ok: false, mensagem: erro, precisaEntrar: response.status === 401 }
                }

                const codigo = dados && typeof dados === "object" && "pedido" in dados
                    ? String((dados as { pedido: { codigo?: unknown } }).pedido?.codigo ?? "")
                    : ""

                const urlPagamento = dados && typeof dados === "object" && "url_pagamento" in dados
                    ? String((dados as { url_pagamento: unknown }).url_pagamento ?? "")
                    : ""

                // A sacola só é esvaziada quando há para onde pagar. Sem isso,
                // uma falha no meio deixaria a pessoa sem carrinho E sem
                // pedido pago — e ela teria de remontar tudo.
                if (urlPagamento) setItens([])

                return {
                    ok: true,
                    mensagem: "Pedido criado. Falta pagar.",
                    codigo: codigo || undefined,
                    urlPagamento: urlPagamento || undefined,
                }

            } catch {
                return { ok: false, mensagem: "Não foi possível concluir o pedido. Tente novamente." }
            }
        },
        [itens, loja]
    )

    /**
     * Pergunta ao servidor quanto custa entregar num CEP.
     *
     * Manda o carrinho, e não o total: a isenção por valor tem de ser
     * calculada sobre o preço que o servidor conhece. Se o total viesse
     * daqui, bastaria dizer "meu carrinho custa mil" para ganhar frete
     * grátis.
     */
    const cotarFrete = useCallback(
        async (cep: string): Promise<Cotacao> => {

            const response = await fetch("/api/frete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    loja,
                    cep,
                    itens: itens.map((item) => ({
                        produto_id: item.produto.id,
                        quantidade: item.quantidade,
                    })),
                }),
            })

            const dados = await response.json().catch(() => null)

            if (!response.ok) {
                const mensagem = dados && typeof dados === "object" && "erro" in dados
                    ? String((dados as { erro: unknown }).erro)
                    : "Não foi possível calcular o frete."

                throw new Error(mensagem)
            }

            return dados as Cotacao
        },
        [itens, loja],
    )

    const totalItens = useMemo(
        () => itens.reduce((soma, item) => soma + item.quantidade, 0),
        [itens]
    )

    // O total soma o produto MAIS o que foi escolhido nele: a borda entra no
    // preço, e um total sem ela não bate com o que o servidor vai cobrar.
    const totalPreco = useMemo(
        () => itens.reduce((soma, item) => {

            const adicionais = (item.adicionais ?? []).reduce((extra, a) => extra + a.preco, 0)

            return soma + (precoUnitario(item.produto) + adicionais) * item.quantidade
        }, 0),
        [itens]
    )

    const valor: CarrinhoContextValor = {
        itens,
        adicionar,
        remover,
        definirQuantidade,
        limpar,
        totalItens,
        totalPreco,
        aberto,
        abrir: () => setAberto(true),
        fechar: () => setAberto(false),
        finalizarPedido,
        cotarFrete,
    }

    return <CarrinhoContext.Provider value={valor}>{children}</CarrinhoContext.Provider>
}

export function useCarrinho(): CarrinhoContextValor {
    const contexto = useContext(CarrinhoContext)
    if (!contexto) throw new Error("useCarrinho precisa estar dentro de <CartProvider>")
    return contexto
}
