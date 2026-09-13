"use client"

import { useLoja } from "@/app/loja/loja-context"
import { aceitaPix, formatarMoeda, textoParcelamento } from "@/lib/pagamento"

/**
 * O bloco de preço da página de produto.
 *
 * Cliente porque as formas de pagamento vivem no contexto da loja, e é delas
 * que saem as duas linhas abaixo do preço. Mesma regra do card: nada de
 * "sem juros" nem de desconto no Pix que ninguém programou — só o que esta
 * loja de fato aceita (ver lib/pagamento.ts).
 */
export default function PrecoProduto({
    preco,
    precoAntigo,
    percentual,
}: {
    preco: number
    precoAntigo?: number
    percentual?: number
}) {

    const loja = useLoja()
    const parcelamento = textoParcelamento(loja)
    const pix = aceitaPix(loja)

    return (

        <div>

            {precoAntigo ? (
                <p className="preco-antigo">
                    de {formatarMoeda(precoAntigo)} por
                </p>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">

                <p className="preco-grande">{formatarMoeda(preco)}</p>

                {percentual && percentual > 0 ? (
                    <span className="selo-off text-[0.85rem]">-{percentual}%</span>
                ) : null}

            </div>

            {/* Os meios de pagamento numa linha só.
                O valor NÃO se repete aqui. As lojas grandes escrevem "R$ 40,00
                no Pix" porque nelas o Pix é mais barato que o cartão; nesta
                loja não há desconto programado, e repetir o mesmo número dois
                centímetros abaixo dele não informa nada — só faz o comprador
                reler para descobrir que é igual. */}
            {(pix || parcelamento) ? (
                <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">

                    {pix ? <span className="pix text-[0.8rem]">no Pix</span> : null}

                    {parcelamento ? (
                        <span className="parcelas text-[0.85rem]">
                            {pix ? parcelamento : parcelamento.replace(/^ou /, "")}
                        </span>
                    ) : null}

                </p>
            ) : null}

        </div>

    )
}
