/**
 * Monta um caminho dentro de uma loja. Toda ligação interna da vitrine passa
 * por aqui: um href cru como "/produto/9" levaria o visitante para fora da
 * loja em que ele está — e, como cada endereço é de um lojista diferente,
 * para o catálogo de outra pessoa.
 *
 * Vive fora de loja-context.tsx (que é "use client") porque as páginas de
 * servidor também montam links: função de módulo client não pode ser
 * chamada do servidor.
 */
export function caminhoDaLoja(slug: string, caminho: string = ""): string {
    const limpo = caminho.replace(/^\/+/, "")
    return limpo ? `/${slug}/${limpo}` : `/${slug}`
}
