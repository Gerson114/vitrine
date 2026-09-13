"use client"

import { FiStar } from "react-icons/fi"

/**
 * As estrelas, nos dois papéis que elas têm numa loja.
 *
 * Lendo (`aoEscolher` ausente): mostram a nota de alguém, e não recebem
 * clique — é informação, não formulário.
 *
 * Escrevendo: viram cinco botões de rádio de verdade, com nome e rótulo, para
 * quem navega por teclado ou leitor de tela conseguir dar nota. Estrela
 * clicável feita de <div> é a forma mais comum de deixar essa gente de fora.
 */
export default function Estrelas({
    nota,
    tamanho = "w-4",
    aoEscolher,
    nome,
}: {
    nota: number
    tamanho?: string
    aoEscolher?: (nota: number) => void
    nome?: string
}) {

    const notas = [1, 2, 3, 4, 5]

    if (!aoEscolher) {
        return (
            <span className="inline-flex items-center gap-0.5" aria-label={`nota ${nota} de 5`}>
                {notas.map((valor) => (
                    <FiStar
                        key={valor}
                        aria-hidden
                        className={`${tamanho} ${
                            valor <= Math.round(nota)
                                ? "fill-current text-[var(--estrela)]"
                                : "text-[var(--linha)]"
                        }`}
                    />
                ))}
            </span>
        )
    }

    return (
        <span className="inline-flex items-center gap-1">
            {notas.map((valor) => (
                <label
                    key={valor}
                    className="cursor-pointer p-0.5"
                    title={`${valor} de 5`}
                >
                    <input
                        type="radio"
                        name={nome}
                        value={valor}
                        checked={nota === valor}
                        onChange={() => aoEscolher(valor)}
                        className="sr-only"
                    />

                    <FiStar
                        aria-hidden
                        className={`${tamanho} transition-colors ${
                            valor <= nota
                                ? "fill-current text-[var(--ink)]"
                                : "text-[var(--linha)] hover:text-[var(--ink-3)]"
                        }`}
                    />

                    <span className="sr-only">{valor} de 5</span>
                </label>
            ))}
        </span>
    )
}
