"use client"

import { FiArrowRight, FiCamera } from "react-icons/fi"

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
 * Agora são cards largos, com a foto ocupando o bloco inteiro e o nome sobre
 * um degradê. A foto é a do primeiro produto da categoria, então a régua se
 * monta sozinha conforme o catálogo cresce — e continua funcionando quando
 * ainda não há foto nenhuma.
 */
export default function Atalhos({ atalhos, aoEscolher }: AtalhosProps) {

    if (atalhos.length === 0) return null

    return (

        <section className="largura py-7 sm:py-10">

            <div className="mb-4 flex items-end justify-between gap-4">

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

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">

                {atalhos.map((atalho) => (
                    <button
                        key={atalho.nome}
                        type="button"
                        onClick={() => aoEscolher(atalho.nome)}
                        className="card card-hover group relative flex aspect-[3/2] items-end overflow-hidden text-left sm:aspect-[16/10]"
                    >
                        {atalho.imagem ? (
                            <img
                                src={atalho.imagem}
                                alt=""
                                loading="lazy"
                                aria-hidden
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                            />
                        ) : (
                            <span className="absolute inset-0 flex items-center justify-center bg-[var(--placa)] text-[var(--ink-3)]">
                                <FiCamera className="w-6" aria-hidden />
                            </span>
                        )}

                        {/* O degradê é o que garante o contraste do nome sobre
                            QUALQUER foto — sem ele, categoria com produto claro
                            fica com o texto ilegível, que é o defeito clássico
                            de card com imagem de fundo. */}
                        <span
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent"
                        />

                        <span className="relative flex w-full items-center justify-between gap-1.5 p-2.5 sm:p-3">
                            <span className="truncate text-[0.82rem] font-semibold capitalize text-white sm:text-[0.9rem]">
                                {atalho.nome}
                            </span>

                            <FiArrowRight
                                className="w-4 shrink-0 text-white transition-transform duration-200 group-hover:translate-x-0.5"
                                aria-hidden
                            />
                        </span>
                    </button>
                ))}

            </div>

        </section>
    )
}
