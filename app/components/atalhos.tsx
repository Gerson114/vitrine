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
                        className="produto group flex flex-col text-left"
                    >
                        {/* O nome saiu de DENTRO da foto.

                            Ele morava sobre a imagem, e para continuar legível
                            sobre qualquer foto precisava de um degradê preto
                            cobrindo dois terços do card — que escurecia
                            justamente a parte do produto que a pessoa estava
                            tentando ver. Embaixo, em chapa própria, o nome é
                            sempre legível e a foto aparece inteira: some o
                            degradê e some o problema que ele existia para
                            remendar. */}
                        <span className={`chapa moldura ${atalho.imagem ? "" : "sem-foto"} flex aspect-[4/3] w-full items-center justify-center overflow-hidden`}>
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
                                    <FiCamera className="w-6" aria-hidden />
                                </span>
                            )}
                        </span>

                        <span className="flex w-full items-center justify-between gap-1.5 pt-2.5">
                            <span className="truncate text-[0.85rem] font-semibold capitalize text-[var(--ink)] sm:text-[0.92rem]">
                                {atalho.nome}
                            </span>

                            <FiArrowRight
                                className="w-4 shrink-0 text-[var(--ink-3)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--destaque)]"
                                aria-hidden
                            />
                        </span>
                    </button>
                ))}

            </div>

        </section>
    )
}
