"use client"

import { createContext, useContext } from "react"
import type { ClienteLogado } from "@/lib/conta"

/**
 * Quem está logado nesta vitrine.
 *
 * Resolvido no SERVIDOR, no layout de [loja], e descido por contexto — nunca
 * consultado pelo navegador. A diferença importa: o token vive num cookie
 * httpOnly, que o JavaScript da página não enxerga, então é o servidor quem
 * pergunta ao backend quem é a pessoa. O que chega aqui é só nome e e-mail,
 * para a tela saber o que mostrar.
 *
 * null = visitante. E visitante é o normal: a vitrine inteira é aberta, e a
 * conta só é exigida na hora de fechar o pedido.
 */
const ContaContext = createContext<ClienteLogado | null>(null)

export function ContaProvider({
    cliente,
    children,
}: {
    cliente: ClienteLogado | null
    children: React.ReactNode
}) {
    return <ContaContext.Provider value={cliente}>{children}</ContaContext.Provider>
}

export function useConta(): ClienteLogado | null {
    return useContext(ContaContext)
}
