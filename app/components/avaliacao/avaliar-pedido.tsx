"use client"

import { useEffect, useState } from "react"
import Estrelas from "./estrelas"
import type { ItemPedidoStatus } from "@/app/type/type"

/**
 * "Como foi?" — a avaliação dos produtos de um pedido entregue.
 *
 * Aparece na tela do pedido, e não num e-mail com link: é onde a pessoa já
 * está quando volta para conferir se chegou, e é o único lugar em que o
 * sistema tem certeza de que ela comprou aquilo.
 *
 * Uma nota por produto, com comentário opcional. A nota vai sozinha, no
 * clique da estrela — pedir para clicar em "enviar" depois de dar a nota é o
 * degrau que faz a maioria não avaliar. O comentário, quando existe, é salvo
 * no botão ao lado, porque texto sem botão nunca se sabe quando acabou.
 */

interface NotaDada {
    produto_id: number
    nota: number
    comentario: string
}

export default function AvaliarPedido({
    loja,
    codigo,
    itens,
}: {
    loja: string
    codigo: string
    itens: ItemPedidoStatus[]
}) {

    const [notas, setNotas] = useState<Record<number, number>>({})
    const [comentarios, setComentarios] = useState<Record<number, string>>({})
    const [salvando, setSalvando] = useState<number | null>(null)
    const [salvos, setSalvos] = useState<Record<number, boolean>>({})
    const [erro, setErro] = useState("")

    // O que a pessoa já respondeu volta preenchido: perguntar de novo o que
    // ela já disse é o jeito mais rápido de ela parar de responder.
    useEffect(() => {

        let vivo = true

        async function buscar() {
            try {
                const resposta = await fetch(
                    `/api/avaliacoes?loja=${encodeURIComponent(loja)}&pedido=${encodeURIComponent(codigo)}`,
                    { cache: "no-store" },
                )

                if (!resposta.ok) return

                const dados = (await resposta.json()) as { avaliacoes?: NotaDada[] }

                if (!vivo || !Array.isArray(dados.avaliacoes)) return

                const porProduto: Record<number, number> = {}
                const textos: Record<number, string> = {}

                for (const avaliacao of dados.avaliacoes) {
                    porProduto[avaliacao.produto_id] = avaliacao.nota
                    if (avaliacao.comentario) textos[avaliacao.produto_id] = avaliacao.comentario
                }

                setNotas(porProduto)
                setComentarios(textos)

            } catch {
                // Sem o que já foi dado, o formulário abre em branco. Não é
                // erro para mostrar na tela.
            }
        }

        void buscar()

        return () => {
            vivo = false
        }
    }, [loja, codigo])

    async function enviar(produtoID: number, nota: number, comentario: string) {

        setSalvando(produtoID)
        setErro("")

        try {
            const resposta = await fetch("/api/avaliacoes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ loja, codigo, produto_id: produtoID, nota, comentario }),
            })

            const dados = await resposta.json().catch(() => null)

            if (!resposta.ok) {
                setErro(
                    dados && typeof dados === "object" && "erro" in dados
                        ? String((dados as { erro: unknown }).erro)
                        : "Não foi possível enviar a sua avaliação.",
                )
                return
            }

            setSalvos((atuais) => ({ ...atuais, [produtoID]: true }))

        } catch {
            setErro("Não foi possível enviar a sua avaliação.")
        } finally {
            setSalvando(null)
        }
    }

    return (
        <section className="border border-[var(--linha)]">

            <h2 className="rotulo border-b border-[var(--linha)] bg-[var(--placa)] px-5 py-3 text-[var(--ink-2)] sm:px-6">
                Como foi?
            </h2>

            <div className="px-5 py-5 sm:px-6">

                <p className="text-[0.82rem] leading-relaxed text-[var(--ink-2)]">
                    Sua opinião aparece na página do produto e ajuda quem está pensando
                    em comprar. Leva um toque.
                </p>

                <ul className="mt-4 divide-y divide-[var(--linha-suave)]">
                    {itens.map((item) => {

                        const nota = notas[item.produto_id] ?? 0

                        return (
                            <li key={item.id} className="py-4">

                                <p className="text-[0.85rem] leading-snug text-[var(--ink)]">
                                    {item.produto_nome || `Produto #${item.produto_id}`}
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                                    <Estrelas
                                        nota={nota}
                                        tamanho="w-5"
                                        nome={`nota-${item.produto_id}`}
                                        aoEscolher={(valor) => {
                                            setNotas((atuais) => ({ ...atuais, [item.produto_id]: valor }))
                                            void enviar(item.produto_id, valor, comentarios[item.produto_id] ?? "")
                                        }}
                                    />

                                    {salvando === item.produto_id ? (
                                        <span className="text-[0.75rem] text-[var(--ink-3)]">enviando...</span>
                                    ) : salvos[item.produto_id] ? (
                                        <span className="text-[0.75rem] text-[var(--verde)]">obrigado!</span>
                                    ) : null}
                                </div>

                                {nota > 0 ? (
                                    <div className="mt-2.5 flex items-end gap-2">
                                        <label className="sr-only" htmlFor={`comentario-${item.produto_id}`}>
                                            Comentário sobre {item.produto_nome}
                                        </label>

                                        <textarea
                                            id={`comentario-${item.produto_id}`}
                                            value={comentarios[item.produto_id] ?? ""}
                                            onChange={(e) =>
                                                setComentarios((atuais) => ({
                                                    ...atuais,
                                                    [item.produto_id]: e.target.value,
                                                }))
                                            }
                                            rows={2}
                                            maxLength={600}
                                            placeholder="Conte como foi (opcional)"
                                            className="campo max-h-32 flex-1 resize-none text-[0.82rem]"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                enviar(item.produto_id, nota, comentarios[item.produto_id] ?? "")
                                            }
                                            disabled={salvando === item.produto_id}
                                            className="btn btn-claro px-4 py-2.5 text-[0.8rem]"
                                        >
                                            salvar
                                        </button>
                                    </div>
                                ) : null}

                            </li>
                        )
                    })}
                </ul>

                {erro ? (
                    <p className="mt-3 border-l-2 border-[var(--vermelho)] bg-[var(--erro-fundo)] px-3 py-2 text-[0.8rem] text-[var(--vermelho)]">
                        {erro}
                    </p>
                ) : null}

            </div>

        </section>
    )
}
