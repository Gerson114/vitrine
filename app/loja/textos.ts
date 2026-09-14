/**
 * A palavra que esta loja escolheu para cada etiqueta da vitrine.
 *
 * Este arquivo não tem `"use client"`, e é o motivo dele existir.
 *
 * A função estava dentro do loja-context, junto do hook que a usa — parecia o
 * lugar certo, porque é a mesma regra e o hook só delega para cá. Mas aquele
 * arquivo é `"use client"`, e o `"use client"` não marca uma função: ele marca o
 * ARQUIVO. Todo export dele vira um ponto de entrada do cliente, inclusive uma
 * função pura que não toca em React. A página do produto, que o Next monta no
 * servidor, quebrava ao chamá-la:
 *
 *   Attempted to call texto() from the server but texto is on the client.
 *
 * Daí a separação: a regra mora aqui, onde os dois lados podem chamá-la, e o
 * hook continua no contexto, onde ele precisa estar. Uma implementação só —
 * duas cópias da mesma regra é como uma delas passa a tratar a etiqueta de um
 * jeito diferente da outra.
 */

/**
 * A palavra desta loja para uma chave, com o padrão à mão.
 *
 * O padrão fica escrito na CHAMADA, e não só no servidor, de propósito: é o
 * que mantém o JSX legível (quem lê a linha vê a frase que vai aparecer) e é
 * a rede de segurança se a resposta vier sem a chave — servidor mais antigo
 * que a vitrine, resposta de cache, JSON que não abriu. Uma tela em branco no
 * lugar de um botão é pior do que um botão com a palavra de fábrica.
 *
 * `dados` troca as etiquetas do texto: `texto(t, "produto.ultimas", "Últimas
 * {n} em estoque", { n: "3 unidades" })`. A etiqueta que não vier em `dados`
 * fica como está, visível — errar aparecendo é melhor do que errar em silêncio.
 */
export function texto(
    textos: Record<string, string> | undefined,
    chave: string,
    padrao: string,
    dados?: Record<string, string>,
): string {

    const escrito = textos?.[chave]
    const frase = escrito && escrito.trim() ? escrito : padrao

    if (!dados) return frase

    return Object.entries(dados).reduce(
        (texto, [etiqueta, valor]) => texto.split(`{${etiqueta}}`).join(valor),
        frase,
    )
}
