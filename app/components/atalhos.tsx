"use client"

import { FiCamera } from "react-icons/fi"

export interface Atalho {
    nome: string
    imagem: string
}

interface AtalhosProps {
    atalhos: Atalho[]
    aoEscolher: (categoria: string) => void
}

/**
 * As categorias da loja, logo abaixo da abertura.
 *
 * Eram miniaturas de 5rem com o nome embaixo — do tamanho de um ícone de
 * aplicativo, e com o mesmo peso visual de um. Numa loja, categoria é
 * navegação principal: é por ela que a maioria entra no catálogo, e o desenho
 * tem de dizer isso.
 *
 * TRILHO, e não grade. Era grade — e uma loja com vinte categorias empurrava
 * a primeira fileira de produtos para o final da segunda tela: quanto mais
 * completo o catálogo do lojista, pior a página ficava, que é o oposto do que
 * se quer. Aqui a régua cresce para o LADO: dez categorias ou cem ocupam a
 * mesma altura, e quem tem mais rola o dedo em vez de rolar a página. É o
 * mesmo desenho do carrossel de departamento de qualquer marketplace grande.
 */
export default function Atalhos({ atalhos, aoEscolher }: AtalhosProps) {

    if (atalhos.length === 0) return null

    return (

        <section className="py-7 sm:py-10">

            <div className="largura mb-4 flex items-end justify-between gap-4">

                {/* O olho e o título são UMA peça, e por isso vivem na mesma
                    coluna: soltos lado a lado dentro do `justify-between`, o
                    olho ia para a esquerda e o título para o meio da linha. */}
                <div>
                    <p className="olho mb-1.5">Categorias</p>

                    <h2 className="titulo">Escolha por categoria</h2>
                </div>

                <span className="hidden text-[0.78rem] text-[var(--ink-3)] sm:block">
                    {atalhos.length} {atalhos.length === 1 ? "categoria" : "categorias"}
                </span>
            </div>

            {/* `largura`, a mesma coluna do resto da página — o trilho rola
                DENTRO dela, alinhado ao título logo acima, em vez de vazar
                para a borda da tela num monitor largo. */}
            <div className="largura flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:gap-3.5 [&::-webkit-scrollbar]:hidden">
                {atalhos.map((atalho) => (
                    <button
                        key={atalho.nome}
                        type="button"
                        onClick={() => aoEscolher(atalho.nome)}
                        className="group flex w-[5.75rem] shrink-0 snap-start flex-col items-center gap-2 text-center sm:w-[6.5rem]"
                    >
                        {/* Redondo, e não retângulo: é o que separa "aqui é
                            navegação" de "aqui é produto" só pela forma do
                            card, sem precisar de rótulo nenhum dizendo isso —
                            o mesmo truque que os departamentos circulares dos
                            marketplaces grandes usam. */}
                        <span
                            className={`chapa moldura ${atalho.imagem ? "" : "sem-foto"} flex aspect-square w-full items-center justify-center overflow-hidden rounded-full`}
                        >
                            {atalho.imagem ? (
                                <img
                                    src={atalho.imagem}
                                    alt=""
                                    loading="lazy"
                                    aria-hidden
                                    className="foto h-full w-full object-cover"
                                />
                            ) : (
                                <span className="flex items-center justify-center text-[var(--ink-3)]">
                                    <FiCamera className="w-5" aria-hidden />
                                </span>
                            )}
                        </span>

                        <span className="line-clamp-2 text-[0.78rem] font-semibold leading-tight capitalize text-[var(--ink)] transition-colors group-hover:text-[var(--destaque)] sm:text-[0.82rem]">
                            {atalho.nome}
                        </span>
                    </button>
                ))}

            </div>

        </section>
    )
}
