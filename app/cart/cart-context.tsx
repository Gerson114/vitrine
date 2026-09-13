"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Produto } from "@/app/type/type"

export interface ItemCarrinho {
    produto: Produto
    quantidade: number
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
    adicionar: (produto: Produto) => void
    remover: (produtoId: number) => void
    definirQuantidade: (produtoId: number, quantidade: number) => void
    limpar: () => void
    totalItens: number
    totalPreco: number
    aberto: boolean
    abrir: () => void
    fechar: () => void
    finalizarPedido: (entrega: Entrega) => Promise<ResultadoPedido>

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
            if (salvo) setItens(JSON.parse(salvo))
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

    const adicionar = useCallback((produto: Produto) => {
        setItens((atual) => {
            const existente = atual.find((item) => item.produto.id === produto.id)
            const limite = produto.estoque

            if (existente) {
                if (existente.quantidade >= limite) return atual
                return atual.map((item) =>
                    item.produto.id === produto.id
                        ? { ...item, quantidade: item.quantidade + 1 }
                        : item
                )
            }

            if (limite <= 0) return atual
            return [...atual, { produto, quantidade: 1 }]
        })
    }, [])

    const remover = useCallback((produtoId: number) => {
        setItens((atual) => atual.filter((item) => item.produto.id !== produtoId))
    }, [])

    const definirQuantidade = useCallback((produtoId: number, quantidade: number) => {
        setItens((atual) =>
            atual
                .map((item) =>
                    item.produto.id === produtoId
                        ? { ...item, quantidade: Math.min(Math.max(1, quantidade), item.produto.estoque) }
                        : item
                )
        )
    }, [])

    const limpar = useCallback(() => setItens([]), [])

    const finalizarPedido = useCallback(
        async (entrega: Entrega): Promise<ResultadoPedido> => {
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
                        itens: itens.map((item) => ({
                            produto_id: item.produto.id,
                            quantidade: item.quantidade,
                        })),

                        // O telefone sobe fora da entrega porque não é
                        // endereço: é o contato do pedido, e vale igual para
                        // quem vem buscar no balcão.
                        telefone: entrega.telefone,

                        // O endereço vai; o valor do frete não. Quem calcula
                        // é o servidor, sobre o CEP e a tabela da loja.
                        entrega,
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

    const totalPreco = useMemo(
        () => itens.reduce((soma, item) => soma + precoUnitario(item.produto) * item.quantidade, 0),
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
