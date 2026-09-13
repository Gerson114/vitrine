"use client"

import { FiShoppingBag } from "react-icons/fi"
import type { Produto } from "@/app/type/type"
import { useCarrinho } from "@/app/cart/cart-context"

export default function ProductActions({ produto }: { produto: Produto }) {

    const { itens, adicionar, abrir } = useCarrinho()

    const noCarrinho = itens.find((item) => item.produto.id === produto.id)?.quantidade ?? 0
    const esgotado = produto.estoque <= 0
    const limiteAtingido = noCarrinho >= produto.estoque

    return (

        <div>
            <button
                type="button"
                onClick={() => adicionar(produto)}
                disabled={esgotado || limiteAtingido}
                className="btn w-full py-4"
            >
                <FiShoppingBag className="w-[1.05rem]" aria-hidden />
                {esgotado
                    ? "sem estoque"
                    : limiteAtingido
                        ? "máximo na sacola"
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
