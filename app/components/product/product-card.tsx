"use client"

import { useState } from "react"
import Link from "next/link"
import { FiCamera, FiShoppingCart } from "react-icons/fi"
import Estrelas from "@/app/components/avaliacao/estrelas"
import type { Produto } from "@/app/type/type"
import { useCarrinho } from "@/app/cart/cart-context"
import { useLoja } from "@/app/loja/loja-context"
import { caminhoDaLoja } from "@/lib/caminhos"
import { aceitaPix, formatarMoeda, textoParcelamento } from "@/lib/pagamento"
import { desconto, descreverVariacao, precoFinal, representante } from "@/lib/variantes"

/**
 * O card de produto, no arranjo das lojas de departamento brasileiras.
 *
 * A versão anterior mostrava foto, nome e preço — e só. Não estava errada,
 * estava MUDA: quem chega numa loja que não conhece decide em dois segundos
 * se está num lugar sério, e três informações não sustentam essa decisão.
 * Aqui o card responde, sem clique nenhum: o que é, quanto custa, quanto
 * custava, quantos por cento caiu, como dá para pagar e se ainda tem.
 *
 * Nada disso é inventado. O desconto sai da diferença entre os dois preços
 * cadastrados; o Pix e o cartão saem dos meios que a loja de fato aceita (ver
 * lib/pagamento.ts); o aviso de estoque sai do estoque. Card que promete o
 * que a loja não cumpre é pior que card mudo.
 */
export default function ProductCard({ variantes }: { variantes: Produto[] }) {

    const { itens, adicionar } = useCarrinho()
    const loja = useLoja()

    const [selecionadoId, setSelecionadoId] = useState(() => representante(variantes).id)
    const produto = variantes.find((variante) => variante.id === selecionadoId) ?? variantes[0]

    const temVariacoes = variantes.length > 1

    const noCarrinho = itens.find((item) => item.produto.id === produto.id)?.quantidade ?? 0
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

    const temPromocao =
        produto.preco_promocional != null &&
        Number(produto.preco_promocional) < Number(produto.preco)

    const percentual = temPromocao ? desconto(produto) : 0
    const valor = precoFinal(produto)

    // "no Pix ou parcelado no cartão", "no Pix", "parcelado no cartão" — ou
    // nada, na loja que combina o pagamento por fora. Montado a partir do que
    // ela de fato aceita.
    const comoPagar = [
        aceitaPix(loja) ? "no Pix" : "",
        textoParcelamento(loja) ? "parcelado no cartão" : "",
    ].filter(Boolean).join(" ou ")

    // Com mais de uma variante, os chips logo abaixo já dizem qual é qual —
    // repetir a variação aqui seria dizer duas vezes a mesma coisa. Com uma
    // só, ela vira o subtítulo do card ("Tamanho P", "Voltagem 220V").
    const detalhes = temVariacoes ? "" : descreverVariacao(produto)

    return (

        // h-full para o card ocupar toda a altura da célula: numa fileira, os
        // cards têm conteúdo de tamanhos diferentes e sem isso cada um termina
        // numa altura, deixando a linha de baixo serrilhada.
        <article className="card card-produto group flex h-full flex-col overflow-hidden">

            <Link href={caminhoDaLoja(loja.slug, `produto/${produto.id}`)} className="flex flex-1 flex-col">

                <div className="relative">

                    {/* A moldura (ver globals.css): palco atrás, fio de um
                        pixel por dentro e a sombra de contato sob o produto.
                        Ela existe porque as fotos vêm do lojista, cada uma com
                        um fundo — recortada, de estúdio, tirada no balcão —, e
                        sobre o branco do card as boas e as ruins ficavam
                        igualmente soltas. O palco dá a todas o mesmo chão. */}
                    <div className="moldura flex aspect-square items-center justify-center p-4 sm:p-5">
                        {produto.imagem_url ? (
                            <img
                                src={produto.imagem_url}
                                alt={produto.nome}
                                loading="lazy"
                                className={`foto h-full w-full object-contain ${
                                    esgotado ? "opacity-45 grayscale" : ""
                                }`}
                            />
                        ) : (
                            <span className="flex flex-col items-center gap-1.5 text-[var(--ink-3)]">
                                <FiCamera className="w-6" aria-hidden />
                                <span className="text-xs">sem imagem</span>
                            </span>
                        )}
                    </div>

                    {/* O selo de desconto na quina, como nas lojas grandes.
                        Antes era uma faixa atravessando a base da foto, que
                        tapava o produto justamente nas fotos boas. */}
                    {temPromocao && percentual > 0 && !esgotado ? (
                        <span className="selo-etiqueta absolute left-2.5 top-2.5 z-[3]">
                            {percentual}% OFF
                        </span>
                    ) : null}

                    {esgotado ? (
                        <span className="selo-etiqueta selo-fora absolute left-2.5 top-2.5 z-[3] uppercase">
                            esgotado
                        </span>
                    ) : null}

                </div>

                <div className="flex flex-col gap-1 border-t border-[var(--linha-suave)] px-3 pb-1 pt-2.5 sm:px-3.5">

                    <h3 className="line-clamp-2 min-h-[2.4rem] text-[0.875rem] leading-snug text-[var(--ink)] first-letter:uppercase">
                        {produto.nome}
                    </h3>

                    {detalhes ? (
                        <p className="truncate text-xs capitalize text-[var(--ink-3)]">{detalhes}</p>
                    ) : null}

                    {/* A nota de quem comprou. Só existe quando existe: card de
                        produto novo não mostra estrela apagada. */}
                    {produto.avaliacoes && produto.nota_media ? (
                        <p className="flex items-center gap-1.5">
                            <Estrelas nota={produto.nota_media} tamanho="w-3" />
                            <span className="num text-[0.72rem] text-[var(--ink-3)]">
                                ({produto.avaliacoes})
                            </span>
                        </p>
                    ) : null}

                    {/* O BLOCO DE PREÇO.
                        A ordem é a das lojas de referência e não é aleatória:
                        o preço antigo primeiro (pequeno, riscado), o preço que
                        vale em seguida (grande), e só então como pagar. É a
                        sequência em que a pessoa lê "caiu de tanto para tanto,
                        e dá para pagar assim". */}
                    <div className="mt-0.5">

                        {temPromocao ? (
                            <p className="preco-antigo leading-none">
                                {formatarMoeda(Number(produto.preco))}
                            </p>
                        ) : (
                            /* Espaço reservado: sem ele, o preço de um card em
                               promoção fica um degrau abaixo do preço do card
                               vizinho, e a fileira inteira desalinha. */
                            <span className="block h-[0.95rem]" aria-hidden />
                        )}

                        <p className="preco mt-0.5">{formatarMoeda(valor)}</p>

                        {/* Uma linha só para os dois meios. Sem desconto no
                            Pix (que a loja não programou), "R$ 40,00 no Pix"
                            logo abaixo de "R$ 40,00" repete o mesmo número —
                            o que informa é PODER pagar assim, não o valor de
                            novo. */}
                        {comoPagar ? (
                            <p className="parcelas mt-1.5">{comoPagar}</p>
                        ) : null}

                    </div>

                    {!esgotado && produto.estoque <= 3 ? (
                        <p className="text-[0.72rem] font-bold leading-tight text-[var(--coral)]">
                            {produto.estoque === 1
                                ? "última unidade"
                                : `últimas ${produto.estoque} unidades`}
                        </p>
                    ) : null}

                </div>

            </Link>

            {/* A fileira de variações só existe quando há variações. O mt-auto
                empurra chips e botão para a base, e como os cards da fileira
                têm a mesma altura os botões terminam alinhados sozinhos. */}
            {temVariacoes ? (
                <div className="mt-auto flex flex-wrap gap-1.5 px-3 pt-2 sm:px-3.5">
                    {variantes.map((variante) => {
                        const semEstoque = variante.estoque <= 0

                        return (
                            <button
                                key={variante.id}
                                type="button"
                                onClick={() => setSelecionadoId(variante.id)}
                                aria-pressed={variante.id === produto.id}
                                className={`chip flex h-8 min-w-8 items-center justify-center px-2 text-[0.75rem] font-semibold uppercase ${
                                    variante.id === produto.id
                                        ? "chip-ativo"
                                        : semEstoque
                                            ? "text-[var(--esgotado)] line-through"
                                            : ""
                                }`}
                            >
                                {variante.variacao}
                            </button>
                        )
                    })}
                </div>
            ) : null}

            <div className={`px-3 pb-3 pt-2.5 sm:px-3.5 ${temVariacoes ? "" : "mt-auto"}`}>
                {/* Produto que faz pergunta não entra na sacola pelo card.
                
                    A pizza precisa de borda e o bife precisa de ponto, e
                    escolher isso não cabe num botão — o card leva à ficha, que
                    é onde as perguntas estão. Sem isto o produto entraria sem
                    resposta e o pedido seria recusado só no fim do checkout,
                    que é o pior lugar possível para descobrir que faltava
                    escolher o tamanho. */}
                {produto.tem_perguntas && !esgotado ? (
                    <Link
                        href={caminhoDaLoja(loja.slug, `produto/${produto.id}`)}
                        className="btn w-full px-2 py-2.5 text-[0.82rem]"
                    >
                        <FiShoppingCart className="w-4 shrink-0" aria-hidden />
                        escolher
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={() => adicionar(produto)}
                        disabled={esgotado || limiteAtingido}
                        className="btn w-full px-2 py-2.5 text-[0.82rem]"
                    >
                        <FiShoppingCart className="w-4 shrink-0" aria-hidden />
                        {esgotado
                            ? "sem estoque"
                            : limiteAtingido
                                ? "máximo na sacola"
                                : noCarrinho > 0
                                    ? `na sacola (${noCarrinho})`
                                    : "comprar"}
                    </button>
                )}
            </div>

        </article>

    )
}
