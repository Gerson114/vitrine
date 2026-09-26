import type { Metadata } from "next"

/**
 * Este layout existe por uma linha só: tirar as telas de pedido do índice de
 * busca.
 *
 * A página de pedido é `"use client"` e por isso não pode exportar `metadata`
 * — é a restrição do Next, e um layout de servidor por cima dela é o caminho
 * de sempre para o caso.
 *
 * O que se evita é concreto: o endereço de um pedido é
 * /loja/pedido/905014, seis dígitos. Um buscador que indexe esses endereços
 * publica uma lista de códigos válidos, que é o começo do trabalho de quem vai
 * varrê-los na consulta por código (ver o balde "pedido-consulta" em
 * security/limite.ts, que é o outro lado da mesma porta).
 */
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function LayoutDoPedido({ children }: { children: React.ReactNode }) {
    return children
}
