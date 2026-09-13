import type { Produto } from "@/app/type/type"

/**
 * A sequência natural das variações que TÊM uma: tamanho de roupa não é
 * alfabético (GG viria antes de M) nem numérico, então esta lista é a única
 * forma de ordená-lo certo. Qualquer outro rótulo cai na comparação de texto
 * mais abaixo.
 */
export const ORDEM_CONHECIDA = ["PP", "P", "M", "G", "GG", "XG", "XGG"]

/** A variação do produto, sempre como texto aparado — nunca undefined. */
function valorDaVariacao(produto: Produto | undefined): string {
    return (produto?.variacao ?? "").trim()
}

/**
 * Ordena as variantes de um mesmo produto.
 *
 * Lê `variacao`, e não o antigo `tamanho`: o backend trocou aquele campo por
 * este quando o sistema deixou de ser só de roupa (ver app/type/type.ts). O
 * código daqui continuou lendo `tamanho`, que a API não manda mais — e como o
 * tipo declarava o campo como string obrigatória, o TypeScript nunca reclamou
 * e o erro só aparecia em produção, no primeiro produto com duas variantes:
 * `undefined.localeCompare` derrubava a vitrine inteira.
 *
 * Daí a leitura passar por valorDaVariacao(): mesmo que um dia chegue um
 * produto sem o campo, aqui ele vira "" e a página continua de pé.
 */
export function ordenarPorVariacao(a: Produto, b: Produto): number {

    const valorA = valorDaVariacao(a)
    const valorB = valorDaVariacao(b)

    const indiceA = ORDEM_CONHECIDA.indexOf(valorA.toUpperCase())
    const indiceB = ORDEM_CONHECIDA.indexOf(valorB.toUpperCase())

    if (indiceA !== -1 && indiceB !== -1) return indiceA - indiceB
    if (indiceA !== -1) return -1
    if (indiceB !== -1) return 1

    // numeric: true para o que é número não sair em ordem de texto — numeração
    // de calçado (37, 38, 39, 40) e peso ("500 g", "1 kg") ficariam com o "10"
    // antes do "9" numa comparação alfabética comum.
    return valorA.localeCompare(valorB, "pt-BR", { numeric: true, sensitivity: "base" })
}

/**
 * A variação escrita para o cliente ler: "Tamanho P", "Voltagem 220V".
 *
 * Devolve "" quando o produto não tem variação — que é o caso da maioria fora
 * do vestuário —, e quem chama decide se mostra alguma coisa.
 */
export function descreverVariacao(produto: Produto): string {

    const valor = valorDaVariacao(produto)

    if (!valor) return ""

    const rotulo = (produto.variacao_rotulo ?? "").trim()

    return rotulo ? `${rotulo} ${valor}` : valor
}

export interface GrupoProduto {
    nome: string
    variantes: Produto[]
}

/**
 * Cada variação é cadastrada como produto separado com o mesmo nome (o
 * backend só bloqueia duplicar nome+variação). Aqui juntamos essas variantes
 * numa única entrada de vitrine, pra virar um card só com seletor.
 */
export function agruparPorNome(produtos: Produto[]): GrupoProduto[] {
    const mapa = new Map<string, Produto[]>()

    for (const produto of produtos) {
        const lista = mapa.get(produto.nome)
        if (lista) lista.push(produto)
        else mapa.set(produto.nome, [produto])
    }

    return Array.from(mapa.entries()).map(([nome, variantes]) => ({
        nome,
        variantes: [...variantes].sort(ordenarPorVariacao),
    }))
}

/** Variante mostrada por padrão no card: a primeira com estoque, ou a
 *  primeira da lista se nenhuma tiver. */
export function representante(variantes: Produto[]): Produto {
    return variantes.find((variante) => variante.estoque > 0) ?? variantes[0]
}

export function precoFinal(produto: Produto): number {
    return Number(produto.preco_promocional ?? produto.preco)
}

/** Percentual de desconto arredondado; 0 quando não há promoção real. */
export function desconto(produto: Produto): number {
    const cheio = Number(produto.preco)
    const promocional = produto.preco_promocional

    if (promocional == null || !Number.isFinite(cheio) || cheio <= 0) return 0
    if (Number(promocional) >= cheio) return 0

    return Math.round((1 - Number(promocional) / cheio) * 100)
}
