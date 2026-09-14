"use client"

import { createContext, useContext } from "react"

import { texto } from "./textos"

/**
 * A loja que está sendo servida nesta página. Vem do endereço na URL
 * (/maria-modas/...), resolvido no servidor pelo layout de [loja] — se o
 * endereço não existir, a página nem chega a ser montada.
 */
export interface TemaLoja {
    fundo?: string
    texto?: string
    destaque?: string
    palco?: string
    logo_url?: string
}

/**
 * Um bloco da home, montado pelo lojista no editor do painel.
 *
 * O que chega aqui é DADO, nunca marcação: "prateleira, título X, 8 produtos".
 * Quem desenha é o código da vitrine (ver components/blocos e o Vitrine), e é
 * por isso que este editor não é uma porta de injeção — o lojista escolhe,
 * ordena e configura, mas não escreve HTML que rode no navegador de quem
 * compra. O servidor valida a lista inteira antes de gravar (ver
 * services/paginas no backend).
 */
/**
 * Um selo da faixa de cartões — "compra segura", "acompanhe seu pedido".
 *
 * O ícone é uma CHAVE ("cadeado", "caixa"), e não um endereço de imagem: quem
 * traduz a chave em desenho é o componente da vitrine, com os ícones que ela
 * já tem. Assim não existe caminho para um `src` arbitrário vindo do painel.
 */
export interface CartaoDaLoja {
    icone?: string
    titulo?: string
    texto?: string
    link?: string
}

export interface Bloco {
    id: string
    tipo: string

    titulo?: string
    texto?: string

    fonte?: string
    categoria?: string
    quantidade?: number

    alinhamento?: string
    tom?: string
    altura?: string

    imagem_url?: string
    alt?: string

    link?: string
    botao_texto?: string

    /** Só do tipo "cartoes": os selos da faixa, na ordem em que aparecem. */
    cartoes?: CartaoDaLoja[]

    /**
     * Só do tipo "secao": as colunas, cada uma com os blocos dela.
     *
     * Uma lista de listas, e não uma árvore livre — um nível só de
     * aninhamento. É escolha: árvore sem fundo é o que faz um editor de
     * páginas virar um lugar onde se perde o bloco dentro do bloco.
     */
    colunas?: Bloco[][]
    fundo?: string
    largura?: string
}

export interface LojaAtual {
    slug: string
    nome: string

    /**
     * O CNPJ da loja, já com máscara, ou vazio se ela não preencheu.
     *
     * Vai no rodapé. Num comércio brasileiro é o sinal mais direto de que há
     * uma empresa registrada por trás da página — e é informação pública, que
     * consta de qualquer nota fiscal.
     */
    cnpj?: string

    /** Se a loja tem conta de pagamento conectada e pode cobrar pelo site. */
    aceita_pagamento?: boolean

    /**
     * Como se paga NESTA loja — "Pix", "Cartão de crédito"…
     *
     * Vem do provedor que ela conectou. A vitrine já teve esta lista escrita
     * à mão, anunciando boleto e débito em loja cujo gateway não faz nem um
     * nem outro: promessa que a loja não cumpre é o pior texto que pode
     * existir numa página de compra, porque quando o cliente descobre ele não
     * desconfia da frase — desconfia da loja.
     */
    metodos_pagamento?: string[]

    /**
     * Esta loja aceita combinar o pagamento na conversa.
     *
     * Campo próprio, e não deduzido do texto de metodos_pagamento: o checkout
     * DECIDE com base nisso, e decidir comparando frase quebraria no dia em
     * que alguém reescrevesse a frase.
     */
    combina_no_whatsapp?: boolean

    /** O número para onde o comprador vai ao escolher combinar. */
    whatsapp_pagamento?: string

    /* ---------------------------------------------------------------
       Como falar com esta loja, e onde ela fica

       Preenchido pelo lojista no painel. Vazio quando ele não preencheu, e
       aí a vitrine simplesmente não mostra a linha — rodapé com
       "Telefone: —" é pior do que rodapé sem telefone.
       --------------------------------------------------------------- */

    /** Só dígitos, com DDD: é o que vira link wa.me. */
    whatsapp?: string
    telefone?: string
    endereco?: string
    horario?: string

    // A aparência escolhida pelo lojista. Ausente ou com campos vazios quer
    // dizer tema de fábrica — o preto-e-branco do globals.css.
    tema?: TemaLoja

    /**
     * O desenho da home: quais seções aparecem, em que ordem e como.
     *
     * Vem junto da loja, e não numa segunda requisição, porque a vitrine
     * precisa dele para desenhar a primeira tela — pedi-lo depois faria a
     * loja aparecer com o layout de fábrica e se reorganizar na frente do
     * visitante. Ausente vale como layout padrão.
     */
    pagina?: Bloco[]

    /**
     * As palavras da loja: cada texto que a vitrine escreve sozinha, já
     * resolvido pelo servidor — o que o lojista reescreveu, ou o padrão.
     *
     * Não é tradução, é VOZ: a loja de parafuso não tem "sacola", tem
     * carrinho; a que só atende no balcão não diz "pronto para envio". Essas
     * palavras estavam fixas no código e obrigavam toda loja a falar como o
     * programa (ver services/paginas/textos.go no backend, que é onde mora o
     * catálogo e o padrão de cada chave).
     */
    textos?: Record<string, string>
}

const LojaContext = createContext<LojaAtual | null>(null)

export function LojaProvider({
    loja,
    children,
}: {
    loja: LojaAtual
    children: React.ReactNode
}) {
    return <LojaContext.Provider value={loja}>{children}</LojaContext.Provider>
}

export function useLoja(): LojaAtual {
    const contexto = useContext(LojaContext)

    if (!contexto) {
        throw new Error("useLoja precisa estar dentro de <LojaProvider>")
    }

    return contexto
}

/**
 * A palavra desta loja para uma chave, com o padrão à mão.
 *
 * O padrão fica escrito na CHAMADA, e não só no servidor, de propósito: é o
 * que mantém o JSX legível (quem lê a linha vê a frase que vai aparecer) e é
 * a rede de segurança se a resposta vier sem a chave — servidor mais antigo
 * que a vitrine, resposta de cache, JSON que não abriu. Uma tela em branco no
 * lugar de um botão é pior do que um botão com a palavra de fábrica.
 *
 * `dados` troca as etiquetas do texto: `t("produto.ultimas", "Últimas {n} em
 * estoque", { n: "3 unidades" })`. A etiqueta que não vier em `dados` fica
 * como está, visível — errar aparecendo é melhor do que errar em silêncio.
 *
 * A regra em si mora em ./textos, fora deste arquivo, e não por organização:
 * `"use client"` marca o ARQUIVO, não a função. Enquanto ela estava aqui, todo
 * export deste módulo era um ponto de entrada do cliente, e a página do produto
 * — montada no servidor — quebrava ao chamá-la. Este hook é só a ponte para
 * quem está do lado do cliente e tem contexto de React à mão.
 */
export function useTexto(): (chave: string, padrao: string, dados?: Record<string, string>) => string {

    const loja = useContext(LojaContext)

    return (chave, padrao, dados) => texto(loja?.textos, chave, padrao, dados)
}
