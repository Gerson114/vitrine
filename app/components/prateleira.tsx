"use client"

import { useRef } from "react"
import { FiChevronLeft, FiChevronRight } from "react-icons/fi"
import type { GrupoProduto } from "@/lib/variantes"
import ProductCard from "./product/product-card"

interface PrateleiraProps {
    id?: string
    titulo: string
    grupos: GrupoProduto[]
}

/**
 * Prateleira horizontal ("Mais vistos" da referência): uma fileira só, que
 * corre no dedo e, no desktop, também nas setas. Usa o mesmo card da grade
 * para a loja não ter dois desenhos de produto concorrendo.
 */
export default function Prateleira({ id, titulo, grupos }: PrateleiraProps) {

    const trilho = useRef<HTMLDivElement>(null)

    if (grupos.length === 0) return null

    function correr(direcao: number) {
        const alvo = trilho.current
        if (!alvo) return

        alvo.scrollBy({ left: direcao * alvo.clientWidth * 0.8, behavior: "smooth" })
    }

    return (

        <section id={id} className="largura py-7 sm:py-10">

            <div className="mb-4 flex items-end justify-between gap-4">

                <h2 className="titulo titulo-fio">{titulo}</h2>

                <div className="hidden gap-1.5 md:flex">
                    <button
                        type="button"
                        onClick={() => correr(-1)}
                        aria-label="Voltar"
                        className="chip flex h-8 w-8 items-center justify-center"
                    >
                        <FiChevronLeft className="w-4" aria-hidden />
                    </button>

                    <button
                        type="button"
                        onClick={() => correr(1)}
                        aria-label="Avançar"
                        className="chip flex h-8 w-8 items-center justify-center"
                    >
                        <FiChevronRight className="w-4" aria-hidden />
                    </button>
                </div>

            </div>

            <div className="trilho-borda">
            <div ref={trilho} className="trilho flex snap-x snap-mandatory items-stretch gap-3 pb-2 sm:gap-4">
                {grupos.map((grupo) => (
                    <div
                        key={grupo.nome}
                        /* Pouco mais de meia tela: o card seguinte fica
                            sempre meio à mostra, que é o que avisa que a
                            prateleira corre para o lado. */
                        className="w-[54%] shrink-0 snap-start min-[420px]:w-[43%] sm:w-[31%] lg:w-[23.2%] xl:w-[18.6%]"
                    >
                        <ProductCard variantes={grupo.variantes} />
                    </div>
                ))}
            </div>
            </div>

        </section>

    )
}
