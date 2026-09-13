/**
 * O contato público da loja, do jeito que a vitrine precisa dele.
 *
 * O número é guardado só com dígitos (ver services/loja no backend) porque
 * aqui ele vira endereço: wa.me não abre conversa com parêntese e traço no
 * meio. Estas funções fazem o caminho de volta — do número limpo para o link
 * que abre a conversa e para o texto que a pessoa lê na tela.
 */

/**
 * O link que abre a conversa no WhatsApp, com a mensagem já escrita.
 *
 * Acrescenta o 55 quando o número tem só DDD + linha, que é como todo mundo
 * digita no Brasil. Devolve vazio quando não há número: quem chama trata isso
 * escondendo o botão, em vez de mostrar um link que não leva a lugar nenhum.
 */
export function linkWhatsapp(numero?: string, mensagem?: string): string {

    const digitos = (numero ?? "").replace(/\D+/g, "")

    if (digitos.length < 10 || digitos.length > 13) return ""

    const completo = digitos.length <= 11 ? `55${digitos}` : digitos

    const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""

    return `https://wa.me/${completo}${texto}`
}

/**
 * O número como gente lê: "(81) 98888-7777".
 *
 * Só formata o que reconhece — celular e fixo com DDD. Qualquer outro
 * tamanho volta como veio, porque inventar uma máscara para um número
 * estrangeiro seria escondê-lo atrás de um formato errado.
 */
export function telefoneLegivel(numero?: string): string {

    const digitos = (numero ?? "").replace(/\D+/g, "")

    const nacional = digitos.length > 11 && digitos.startsWith("55")
        ? digitos.slice(2)
        : digitos

    if (nacional.length === 11) {
        return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
    }

    if (nacional.length === 10) {
        return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`
    }

    return numero ?? ""
}
