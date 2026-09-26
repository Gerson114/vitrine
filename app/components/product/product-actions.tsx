"use client"

import { useEffect, useMemo, useState } from "react"
import { FiAlertCircle, FiShoppingBag } from "react-icons/fi"
import type { Produto } from "@/app/type/type"
import { useCarrinho } from "@/app/cart/cart-context"
import type { AdicionalEscolhido } from "@/app/cart/cart-context"

/**
 * O botão de comprar, e as perguntas que vêm antes dele.
 *
 * Aqui estava só o botão. As perguntas chegaram porque um item de cozinha não
 * é só o produto: "pizza calabresa" não é um pedido, é metade de um — falta a
 * borda, falta o tamanho, falta o "sem cebola". E isso não cabe num card de
 * catálogo, cabe na ficha, que é onde a pessoa já parou para decidir.
 *
 * As perguntas são buscadas AQUI e não na página inteira porque só interessam
 * a quem abriu a ficha, e porque a ficha é servidor e isto é navegador: quem
 * escolhe muda de ideia, e cada mudança é estado.
 *
 * O preço na tela soma o produto mais o que foi escolhido, e é por isso que o
 * botão mostra o total: "adicionar à sacola" sem valor faria a pessoa
 * descobrir a borda de R$ 8 só no carrinho.
 */
export default function ProductActions({ produto }: { produto: Produto }) {

    const { itens, adicionar, abrir } = useCarrinho()

    const [grupos, setGrupos] = useState<GrupoDaFicha[]>([])
    const [escolhas, setEscolhas] = useState<Record<number, number[]>>({})
    const [observacao, setObservacao] = useState("")
    const [limiteDoRecado, setLimiteDoRecado] = useState(200)
    const [erro, setErro] = useState("")

    // Quantas unidades deste produto já estão na sacola, somando todas as
    // linhas dele: a mesma pizza com bordas diferentes são duas linhas e duas
    // unidades da prateleira.
    const noCarrinho = itens
        .filter((item) => item.produto.id === produto.id)
        .reduce((soma, item) => soma + item.quantidade, 0)

    /* "Esgotado" quer dizer coisas diferentes nos dois tipos de produto.
    
       Em quem se conta, é estoque zero. Em quem não se conta — a pizza, que é
       feita quando alguém pede —, contar unidades não responde nada: quem
       responde é o "tem hoje?" que a cozinha desliga quando acaba a massa.
       Sem esta distinção, todo prato apareceria como "sem estoque". */
    const esgotado = produto.sem_contagem
        ? produto.disponivel === false
        : produto.estoque <= 0
    // Quem não conta unidade não tem teto na sacola: dá para pedir dez
    // pizzas, e a cozinha faz dez.
    const limiteAtingido = !produto.sem_contagem && noCarrinho >= produto.estoque

    useEffect(() => {

        if (!produto.tem_perguntas) return

        let cancelado = false

        async function buscar() {
            try {
                const resposta = await fetch(`/api/produtos/${produto.id}/adicionais`, { cache: "no-store" })

                if (!resposta.ok) return

                const dados = await resposta.json()

                if (!cancelado) {
                    setGrupos(Array.isArray(dados?.grupos) ? dados.grupos : [])
                    if (dados?.observacao_maxima) setLimiteDoRecado(Number(dados.observacao_maxima))
                }
            } catch {
                // Sem as perguntas, o botão continua funcionando e o servidor
                // recusa o que faltar — com a mensagem dizendo o que faltou.
                // É pior do que perguntar aqui, e melhor do que travar a ficha.
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [produto.id, produto.tem_perguntas])

    /** O que foi escolhido, já com nome e preço, para a sacola desenhar. */
    const escolhidos = useMemo((): AdicionalEscolhido[] => {

        const lista: AdicionalEscolhido[] = []

        for (const grupo of grupos) {
            for (const id of escolhas[grupo.id] ?? []) {

                const opcao = grupo.opcoes?.find((o) => o.id === id)

                if (opcao) {
                    lista.push({ opcao_id: opcao.id, grupo: grupo.nome, nome: opcao.nome, preco: opcao.preco })
                }
            }
        }

        return lista
    }, [grupos, escolhas])

    const precoBase = produto.preco_promocional ?? produto.preco
    const total = precoBase + escolhidos.reduce((soma, escolha) => soma + escolha.preco, 0)

    function alternar(grupo: GrupoDaFicha, opcaoID: number) {

        setErro("")

        setEscolhas((atual) => {

            const atuais = atual[grupo.id] ?? []

            if (atuais.includes(opcaoID)) {
                return { ...atual, [grupo.id]: atuais.filter((id) => id !== opcaoID) }
            }

            // Escolha única troca em vez de acumular: numa pergunta de "máximo
            // 1", clicar na segunda opção quer dizer "mudei de ideia", não
            // "quero as duas".
            if (grupo.maximo === 1) {
                return { ...atual, [grupo.id]: [opcaoID] }
            }

            if (atuais.length >= grupo.maximo) return atual

            return { ...atual, [grupo.id]: [...atuais, opcaoID] }
        })
    }

    function comprar() {

        // As perguntas obrigatórias são cobradas aqui e DE NOVO no servidor.
        // Aqui para a pessoa consertar com o produto na frente; lá porque o
        // corpo da requisição vem do navegador e nada garante que passou por
        // esta tela.
        for (const grupo of grupos) {

            if (grupo.minimo > 0 && (escolhas[grupo.id]?.length ?? 0) < grupo.minimo) {
                setErro(`Escolha ${grupo.minimo === 1 ? "uma opção" : `${grupo.minimo} opções`} em “${grupo.nome}”.`)
                return
            }
        }

        adicionar(produto, escolhidos.length > 0 ? escolhidos : undefined, observacao.trim() || undefined)

        // A escolha se desfaz depois de somar: a próxima pizza é outra pizza,
        // e deixar a borda anterior marcada faria a pessoa pedir sem querer.
        setEscolhas({})
        setObservacao("")
        setErro("")
    }

    return (

        <div>

            {grupos.map((grupo) => (
                <fieldset key={grupo.id} className="mb-5">

                    <legend className="rotulo-campo">
                        {grupo.nome}
                        <span className="ml-2 font-normal normal-case tracking-normal text-[var(--ink-3)]">
                            {grupo.minimo > 0 ? "obrigatório" : "opcional"}
                            {grupo.maximo > 1 ? ` · até ${grupo.maximo}` : ""}
                        </span>
                    </legend>

                    <div className="mt-2 space-y-1.5">
                        {(grupo.opcoes ?? []).map((opcao) => {

                            const marcada = (escolhas[grupo.id] ?? []).includes(opcao.id)

                            return (
                                <button
                                    key={opcao.id}
                                    type="button"
                                    onClick={() => alternar(grupo, opcao.id)}
                                    aria-pressed={marcada}
                                    className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-[0.85rem] transition-colors ${
                                        marcada
                                            ? "border-[var(--destaque)] bg-[color-mix(in_srgb,var(--destaque)_8%,transparent)] font-semibold text-[var(--ink)]"
                                            : "border-[var(--linha)] text-[var(--ink-2)] hover:bg-[var(--placa)]"
                                    }`}
                                >
                                    <span className="min-w-0 truncate">{opcao.nome}</span>

                                    {opcao.preco > 0 ? (
                                        <span className="num shrink-0 text-[0.8rem] text-[var(--ink-3)]">
                                            + {opcao.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                    ) : null}
                                </button>
                            )
                        })}
                    </div>
                </fieldset>
            ))}

            {/* O recado só aparece onde há pergunta: numa loja de ventilador
                um campo "alguma observação?" é convite para escrever pedido
                que ninguém vai ler. */}
            {grupos.length > 0 ? (
                <div className="mb-5">
                    <label className="rotulo-campo" htmlFor="observacao">Alguma observação?</label>

                    <input
                        id="observacao"
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        maxLength={limiteDoRecado}
                        placeholder="sem cebola, bem passado…"
                        className="campo mt-1.5"
                    />
                </div>
            ) : null}

            {erro ? (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--placa)] px-3 py-2.5 text-[0.8rem] font-semibold text-[var(--ink)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    {erro}
                </p>
            ) : null}

            <button
                type="button"
                onClick={comprar}
                disabled={esgotado || limiteAtingido}
                className="btn w-full py-4"
            >
                <FiShoppingBag className="w-[1.05rem]" aria-hidden />
                {esgotado
                    ? "sem estoque"
                    : limiteAtingido
                        ? "máximo na sacola"
                        : escolhidos.length > 0
                            ? `adicionar — ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                            : "adicionar à sacola"}
            </button>

            {noCarrinho > 0 ? (
                <button
                    type="button"
                    onClick={abrir}
                    className="mt-3 w-full text-center text-xs font-semibold text-[var(--ink)] underline underline-offset-4"
                >
                    {noCarrinho} {noCarrinho === 1 ? "unidade" : "unidades"} na sacola — ver sacola
                </button>
            ) : null}
        </div>

    )
}

/** Uma pergunta da ficha, como o servidor a manda. */
interface GrupoDaFicha {
    id: number
    nome: string
    minimo: number
    maximo: number
    opcoes?: { id: number; nome: string; preco: number }[]
}
