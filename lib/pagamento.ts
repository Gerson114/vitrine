import type { LojaAtual } from "@/app/loja/loja-context"

/**
 * O que dizer sobre pagamento na vitrine — e, principalmente, o que NÃO
 * dizer.
 *
 * Toda loja de departamento brasileira mostra duas linhas embaixo do preço:
 * o parcelamento no cartão e o valor no Pix. É informação que o comprador
 * procura antes de clicar, e a ausência dela é parte do que faz uma vitrine
 * parecer improvisada.
 *
 * Só que essas duas linhas são fáceis de transformar em mentira. "12x sem
 * juros" depende de como a conta da loja está configurada no provedor de
 * pagamento — na InfinitePay, por exemplo, o padrão é o comprador pagar os
 * juros. E "10% de desconto no Pix" é desconto que ninguém programou. Escrever
 * qualquer um dos dois aqui produz uma vitrine que promete o que a tela de
 * pagamento vai desmentir dois cliques adiante, que é exatamente a experiência
 * que ensina o cliente a desconfiar da loja.
 *
 * Então a régua é: só sai daqui o que vem dos meios que AQUELA loja de fato
 * aceita (loja.metodos_pagamento, publicado pelo backend a partir do provedor
 * conectado), e nenhum número que a loja não tenha se comprometido a cumprir.
 */

/** A loja recebe por Pix? */
export function aceitaPix(loja: LojaAtual): boolean {
    return metodos(loja).some((forma) => forma.includes("pix"))
}

/** A loja recebe no cartão de crédito? */
export function aceitaCartao(loja: LojaAtual): boolean {
    return metodos(loja).some(
        (forma) => forma.includes("crédito") || forma.includes("credito") || forma.includes("cartão"),
    )
}

/**
 * A linha do parcelamento, ou vazio quando a loja não passa cartão.
 *
 * Sem número de parcelas de propósito: quantas vezes e com ou sem juros é
 * decisão da conta da loja no provedor, e este código não tem como saber.
 * Dizer que dá para parcelar é verdade; dizer "12x sem juros" seria chute.
 */
export function textoParcelamento(loja: LojaAtual): string {
    return aceitaCartao(loja) ? "ou parcele no cartão de crédito" : ""
}

function metodos(loja: LojaAtual): string[] {
    if (!loja.aceita_pagamento) return []

    return (loja.metodos_pagamento ?? []).map((forma) => forma.toLowerCase())
}

/** "R$ 1.299,90" — o formato usado em toda a vitrine. */
export function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
