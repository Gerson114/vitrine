import { cookies } from "next/headers"

// URL do backend. Só o servidor do Next a conhece — o navegador nunca fala
// direto com ele, mesmo padrão do resto do app.
export const API_BASE = process.env.API_URL ?? "http://localhost:8080"

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Valida o endereço da loja antes de ele virar parte de uma URL. */
export function slugValido(loja: string): boolean {
    return SLUG_RE.test(loja)
}

/**
 * O nome do cookie de sessão do comprador, POR LOJA.
 *
 * A loja entra no nome, e não só no conteúdo do token, porque a mesma pessoa
 * pode ter conta em várias vitrines do sistema e as sessões não podem se
 * atropelar: entrar na loja da Maria não pode deslogar a conta do João, e o
 * cookie de uma não pode ser apresentado como o da outra. O backend recusaria
 * de qualquer forma (o token carrega a loja e o middleware confere), mas o
 * jeito de não depender disso é nunca mandar o cookie errado.
 */
export function nomeDoCookie(loja: string): string {
    return `cliente_token_${loja}`
}

/** O token da sessão nesta loja, ou "" se não há sessão. */
export async function tokenDaLoja(loja: string): Promise<string> {
    const cookieStore = await cookies()
    return cookieStore.get(nomeDoCookie(loja))?.value ?? ""
}

/**
 * O cabeçalho Set-Cookie da sessão.
 *
 * httpOnly: o JavaScript da página nunca enxerga o token, então um XSS não o
 * carrega embora. SameSite=Lax: o cookie não acompanha requisição disparada
 * por outro site, que é como um formulário escondido tentaria comprar em nome
 * de quem está logado.
 */
export function cookieDaSessao(loja: string, token: string): string {
    const seguro = process.env.NODE_ENV === "development" ? "" : "; Secure"
    const validade = 60 * 60 * 24 * 7 // sete dias, igual ao token do backend
    return `${nomeDoCookie(loja)}=${token}; Path=/; Max-Age=${validade}; HttpOnly; SameSite=Lax${seguro}`
}

/** O mesmo cookie, vencido — é assim que se apaga um httpOnly. */
export function cookieApagado(loja: string): string {
    const seguro = process.env.NODE_ENV === "development" ? "" : "; Secure"
    return `${nomeDoCookie(loja)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${seguro}`
}

export function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

/** A mensagem de erro que o backend mandou, ou uma genérica. */
export function erroDoBackend(dados: unknown, padrao: string): string {
    return dados && typeof dados === "object" && "erro" in dados
        ? String((dados as { erro: unknown }).erro)
        : padrao
}

export interface ClienteLogado {
    id: number
    nome: string
    email: string | null
}

/**
 * Quem está logado nesta vitrine, lido no servidor.
 *
 * Devolve null sem sessão — e também quando o backend recusa o token, que é o
 * caso de quem saiu da conta noutro aparelho ou de um cookie de loja trocada.
 * A vitrine trata os três como "visitante", que é o que eles são.
 */
export async function clienteLogado(loja: string): Promise<ClienteLogado | null> {

    if (!slugValido(loja)) return null

    const token = await tokenDaLoja(loja)

    if (!token) return null

    try {
        const resposta = await fetch(new URL(`/public/loja/${loja}/conta`, API_BASE), {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        if (!resposta.ok) return null

        const dados = safeParse(await resposta.text())

        if (!dados || typeof dados !== "object" || !("cliente" in dados)) return null

        return (dados as { cliente: ClienteLogado }).cliente

    } catch {
        return null
    }
}

export interface ItemDoPedido {
    produto_id: number
    produto_nome: string
    produto_variacao?: string
    produto_variacao_rotulo?: string
    // O backend já mandava a imagem; o tipo é que não a declarava, e por isso
    // a lista de pedidos aparecia sem foto nenhuma.
    produto_imagem_url?: string
    quantidade: number
    preco_unitario: number
}

export interface MeuPedido {
    codigo: string
    status: string

    /**
     * Como está o dinheiro deste pedido. Vem junto porque, na lista, um
     * pedido esperando pagamento parecia igual a um que a loja já aceitou — e
     * é o primeiro que a pessoa precisa achar, porque é o único que depende
     * dela.
     */
    pagamento_status?: string

    created_at: string
    updated_at: string
    total: number
    itens: ItemDoPedido[]
}

/**
 * Os pedidos de quem está logado nesta loja.
 *
 * Não pede código nenhum: o pedido já tem dono desde que fechar exige conta,
 * então quem provou quem é não deve provar de novo com um número de seis
 * dígitos. Devolve lista vazia sem sessão.
 */
export async function meusPedidos(loja: string): Promise<MeuPedido[]> {

    if (!slugValido(loja)) return []

    const token = await tokenDaLoja(loja)

    if (!token) return []

    try {
        const resposta = await fetch(new URL(`/public/loja/${loja}/pedidos`, API_BASE), {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        if (!resposta.ok) return []

        const dados = safeParse(await resposta.text())

        if (!dados || typeof dados !== "object" || !("pedidos" in dados)) return []

        const lista = (dados as { pedidos: unknown }).pedidos

        return Array.isArray(lista) ? (lista as MeuPedido[]) : []

    } catch {
        return []
    }
}
