import type { TemaLoja } from "@/app/loja/loja-context"

/**
 * O tema da loja virando estilo de verdade.
 *
 * A vitrine inteira é pintada por variáveis CSS (ver :root em globals.css):
 * as quatro que o lojista escolhe e as derivadas, que o próprio CSS calcula
 * a partir delas. Aqui só se escreve o que ele escolheu — o resto acompanha
 * sozinho, e é por isso que dar a cor a ele não produz uma loja ilegível.
 */

const COR_RE = /^#[0-9a-fA-F]{6}$/

/**
 * A luminância relativa de uma cor, na fórmula da WCAG. É a conta que
 * responde a única pergunta que o CSS não sabe responder: se o texto por
 * cima do destaque tem de ser claro ou escuro.
 */
export function luminancia(cor: string): number {

    const canal = (inicio: number) => {

        const valor = parseInt(cor.slice(inicio, inicio + 2), 16) / 255

        return valor <= 0.03928
            ? valor / 12.92
            : Math.pow((valor + 0.055) / 1.055, 2.4)
    }

    return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

/**
 * O contraste entre duas cores, de 1 (idênticas) a 21 (preto no branco). A
 * WCAG pede 4,5 para texto corrido e 3 para texto grande.
 *
 * A vitrine não recusa contraste ruim — quem escolhe a cara da loja é o
 * lojista. Quem usa esta conta é o painel, para avisar antes de salvar.
 */
export function contraste(uma: string, outra: string): number {

    const a = luminancia(uma)
    const b = luminancia(outra)

    const clara = Math.max(a, b)
    const escura = Math.min(a, b)

    return (clara + 0.05) / (escura + 0.05)
}

/** Preto ou branco — o que for mais legível por cima da cor dada. */
export function sobre(cor: string): string {
    return contraste(cor, "#ffffff") >= contraste(cor, "#000000") ? "#ffffff" : "#000000"
}

/**
 * As declarações CSS do tema desta loja, para irem num atributo `style`.
 *
 * Devolve string vazia quando a loja não escolheu nada: aí nenhuma variável
 * é sobrescrita e vale o preto-e-branco de fábrica do globals.css. Cor que
 * não seja #RRGGBB é descartada em silêncio — o servidor já a recusa na
 * gravação, e repetir a checagem aqui é o que garante que nada estranho
 * chegue a um bloco de estilo mesmo que um dia entre pelo banco.
 */
export function estiloDoTema(tema: TemaLoja | undefined): Record<string, string> {

    if (!tema) return {}

    const estilo: Record<string, string> = {}

    const por = (variavel: string, valor: string | undefined) => {
        if (valor && COR_RE.test(valor)) estilo[variavel] = valor
    }

    por("--fundo", tema.fundo)
    por("--ink", tema.texto)
    por("--destaque", tema.destaque)
    por("--palco", tema.palco)

    // A única derivada que o CSS não dá conta: escolher entre texto claro e
    // escuro exige medir a luminância do destaque, e color-mix não mede.
    if (tema.destaque && COR_RE.test(tema.destaque)) {
        estilo["--sobre-destaque"] = sobre(tema.destaque)
    }

    return estilo
}
