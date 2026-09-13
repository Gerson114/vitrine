"use client"

import { useEffect, useState } from "react"
import Estrelas from "./estrelas"

/**
 * O que quem comprou disse deste produto.
 *
 * Carrega no navegador, depois da página: a ficha do produto é o que vende, e
 * segurá-la esperando uma consulta de avaliações — que na maioria dos
 * produtos volta vazia — atrasaria justamente o que importa.
 *
 * Produto sem nenhuma avaliação não desenha nada. Uma seção "Avaliações (0)"
 * numa loja nova só anuncia que ninguém comprou ainda.
 */

interface Avaliacao {
    autor: string
    nota: number
    comentario: string
    criada_em: string
}

interface Resposta {
    media: number
    total: number
    avaliacoes: Avaliacao[]
}

export default function AvaliacoesDoProduto({
    produtoID,
    loja,
}: {
    produtoID: number
    loja: string
}) {

    const [dados, setDados] = useState<Resposta | null>(null)

    useEffect(() => {

        let vivo = true

        async function buscar() {
            try {
                const resposta = await fetch(
                    `/api/avaliacoes?loja=${encodeURIComponent(loja)}&produto=${produtoID}`,
                    { cache: "no-store" },
                )

                if (!resposta.ok) return

                const lido = (await resposta.json()) as Resposta

                if (vivo) setDados(lido)

            } catch {
                // Sem avaliações na tela é melhor do que um erro no meio da
                // página do produto: quem veio aqui veio comprar.
            }
        }

        void buscar()

        return () => {
            vivo = false
        }
    }, [produtoID, loja])

    if (!dados || dados.total === 0) return null

    return (
        <div className="mt-8 border-t border-[var(--linha)] pt-6">

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="rotulo">Quem comprou</p>

                <Estrelas nota={dados.media} />

                <span className="num text-[0.85rem] font-semibold text-[var(--ink)]">
                    {dados.media.toFixed(1).replace(".", ",")}
                </span>

                <span className="text-[0.8rem] text-[var(--ink-3)]">
                    {dados.total} {dados.total === 1 ? "avaliação" : "avaliações"}
                </span>
            </div>

            {dados.avaliacoes.length > 0 ? (
                <ul className="mt-4 divide-y divide-[var(--linha-suave)]">
                    {dados.avaliacoes.map((avaliacao, indice) => (
                        <li key={`${avaliacao.autor}-${indice}`} className="py-3.5">

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <Estrelas nota={avaliacao.nota} tamanho="w-3.5" />

                                <span className="text-[0.82rem] font-semibold text-[var(--ink)]">
                                    {avaliacao.autor}
                                </span>

                                <span className="num text-[0.75rem] text-[var(--ink-3)]">
                                    {new Date(avaliacao.criada_em).toLocaleDateString("pt-BR")}
                                </span>
                            </div>

                            <p className="mt-1.5 whitespace-pre-line text-[0.85rem] leading-relaxed text-[var(--ink-2)]">
                                {avaliacao.comentario}
                            </p>

                        </li>
                    ))}
                </ul>
            ) : null}

        </div>
    )
}
