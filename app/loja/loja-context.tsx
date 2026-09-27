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
    /** "pequeno" | "medio" | "grande" — o destaque deste cartão na faixa. */
    tamanho?: string
}

/**
 * Uma peça do cabeçalho ou do rodapé.
 *
 * Vale aqui a mesma regra do bloco da home: o que chega é DADO — "sacola",
 * "busca grande", "selo com ícone de cadeado" —, nunca marcação. Quem desenha
 * cada peça é o código da vitrine (ver components/header/pecas.tsx).
 */
export interface PecaDaMoldura {
    id: string
    tipo: string

    texto?: string
    link?: string
    icone?: string
    tamanho?: string

    /** "sempre" | "so-desktop" | "so-celular". */
    aparicao?: string
}

/** Uma faixa horizontal do topo, com as três áreas dela. */
export interface FaixaDoTopo {
    id: string

    /** "servico" | "marca" | "navegacao" — cada uma com altura e cor próprias. */
    tipo: string

    ligada: boolean
    fundo?: string

    esquerda?: PecaDaMoldura[]
    centro?: PecaDaMoldura[]
    direita?: PecaDaMoldura[]
}

/** Uma coluna do rodapé. */
export interface ColunaDoRodape {
    id: string
    titulo?: string
    largura?: string
    pecas?: PecaDaMoldura[]
}

/** O cabeçalho e o rodapé da loja. */
export interface MolduraDaLoja {
    cabecalho?: { faixas?: FaixaDoTopo[] }
    rodape?: { ligado?: boolean; colunas?: ColunaDoRodape[]; barra?: PecaDaMoldura[] }
}

/**
 * O ramo da loja e as regras que ele traz.
 *
 * Os campos de cozinha só existem quando `ramo` é "comida": mandar tempo de
 * preparo de uma loja de ventilador faria o checkout dela prometer que o
 * ventilador fica pronto em quarenta minutos.
 */
export interface AtendimentoDaLoja {
    ramo: "produtos" | "comida"

    /** Abaixo disto a loja não fecha pedido. Zero é "sem mínimo". */
    pedido_minimo?: number

    /**
     * A loja aceita pagar uma parte agora e o resto na entrega.
     *
     * Vale para qualquer ramo, e não só para comida: quem vende bolo de
     * casamento e quem vende móvel sob medida têm o mesmo problema — o pedido
     * demora a sair e a loja não quer produzir sem sinal.
     */
    aceita_entrada?: boolean
    percentual_da_entrada?: number

    atendimento?: "na_hora" | "agendado" | "os_dois"
    aceita_na_hora?: boolean
    aceita_agendamento?: boolean

    minutos_de_preparo?: number
    minutos_de_antecedencia?: number
    dias_para_agendar?: number
}

/**
 * Como o pedido desta loja chega ao comprador.
 *
 * As duas formas que existem: sair para o endereço, ou o cliente buscar no
 * balcão. A cotação de frete traz as mesmas duas respostas, mas só nasce
 * quando alguém digita um CEP — e quem vai buscar na loja nunca digita CEP.
 * Por isso elas vêm junto da loja: o checkout precisa saber quais caminhos
 * existem antes de desenhar a tela.
 */
export interface EntregaDaLoja {
    /** A loja tem a entrega ligada e uma tabela de frete montada. */
    faz_entrega?: boolean

    /** A loja deixa o cliente buscar no balcão, sem frete. */
    retirada_na_loja?: boolean
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
     * O cabeçalho e o rodapé, montados peça a peça no mesmo editor.
     *
     * Vem junto da loja pelo mesmo motivo da home, e com mais razão: a
     * moldura está em TODAS as páginas, e pedi-la depois faria o topo de
     * fábrica piscar antes do topo da loja a cada navegação.
     *
     * Ausente vale como moldura de fábrica — que é exatamente o topo de três
     * faixas e o rodapé de quatro colunas que a vitrine sempre desenhou.
     */
    moldura?: MolduraDaLoja

    /**
     * Como esta loja trabalha: mercadoria pronta ou comida feita na hora, se
     * agenda, e a partir de quanto fecha pedido.
     *
     * Vem junto da loja porque o checkout precisa dos três para desenhar a
     * tela certa — descobrir só no clique do "finalizar" faria o campo de
     * hora aparecer depois de a pessoa já ter decidido.
     */
    atendimento?: AtendimentoDaLoja

    /**
     * Se esta loja entrega e se ela deixa retirar no balcão.
     *
     * Ausente vale como "as duas coisas": é o que a vitrine supunha antes
     * deste campo existir, e é o que mantém uma resposta antiga do servidor
     * funcionando em vez de esconder o checkout inteiro.
     */
    entrega?: EntregaDaLoja

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
