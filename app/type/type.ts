export interface Produto {
    id: number
    codigo: string
    nome: string
    descricao: string
    preco: number
    estoque: number
    categoria: string
    imagem_url: string

    // O que separa esta peça das irmãs do mesmo modelo — "P" numa camiseta,
    // "220V" num ventilador, "500 g" num pacote de café — e como esse eixo se
    // chama para o lojista ("Tamanho", "Voltagem", "Peso").
    //
    // Substituíram o antigo campo `tamanho`: só roupa tem tamanho, e a loja
    // precisa poder vender qualquer coisa. Vêm vazios ("") em produto que não
    // tem variação nenhuma, que é a maioria fora do vestuário — por isso todo
    // consumidor destes campos precisa tratar string vazia, e não assumir que
    // há texto.
    variacao: string
    variacao_rotulo: string

    // Ficha técnica livre: o que descreve o produto no vocabulário do ramo da
    // loja ("Cor": "Preto", "Tecido": "Algodão"). Tomou o lugar dos antigos
    // campos fixos `cor` e `tecido`.
    //
    // Opcional de verdade: o backend a omite quando está vazia, então aqui ela
    // chega `undefined` — nunca itere sobre ela sem o `?? {}`.
    atributos?: Record<string, string>

    preco_promocional?: number | null

    /**
     * O que quem comprou achou: a média das notas e quantas são.
     *
     * Opcionais porque o backend os omite quando o produto ainda não tem
     * avaliação nenhuma — e é assim que deve ser tratado na tela: produto sem
     * nota não desenha estrela vazia. Cinco estrelas apagadas num catálogo
     * novo fazem a loja parecer mal avaliada, quando ela só é nova.
     */
    nota_media?: number
    avaliacoes?: number
}

/** Slide do banner do topo, configurado pelo lojista no admin. */
export interface Banner {
    id: number
    titulo: string
    descricao: string
    imagem_url: string
    valor: number
    valor_antigo: number
    link: string
    ativo: boolean
    ordem: number
}

export type StatusPedido = "pendente" | "confirmado" | "enviado" | "entregue" | "cancelado"

export interface ItemPedidoStatus {
    id: number
    produto_id: number
    produto_nome: string
    quantidade: number
    preco_unitario: number

    /** O código da peça na loja. Vai no comprovante impresso. */
    produto_codigo?: string

    /**
     * O que separa esta peça das irmãs do mesmo modelo ("P", "220V") e o nome
     * do eixo ("Tamanho", "Voltagem"). Vêm vazios em produto sem variação.
     */
    produto_variacao?: string
    produto_variacao_rotulo?: string
}

export interface PedidoStatus {
    /**
     * Só a consulta por código + contato devolve o id interno; a consulta de
     * quem está logado devolve o pedido sem ele. A tela não usa nenhum dos
     * dois — o pedido se identifica pelo código de seis dígitos.
     */
    id?: number

    codigo: string
    status: StatusPedido

    /**
     * Como está o dinheiro: "aguardando" enquanto o provedor não confirma,
     * "aprovado" depois, "recusado" no cartão negado ou no Pix vencido,
     * "estornado" quando o valor voltou. É a diferença entre "a loja está
     * preparando" e "falta pagar" — sem isto, os dois casos apareciam iguais
     * na tela.
     *
     * Vazio no pedido que não passou por gateway nenhum: os antigos e os que
     * o próprio lojista lança pelo balcão, já combinados.
     */
    pagamento_status?: string

    /** Quando o pagamento entrou no sistema. É o que vira "Recebido". */
    pago_em?: string

    /** Como foi pago, no vocabulário do provedor: "pix", "credit_card"… */
    pagamento_metodo?: string

    created_at: string
    updated_at: string
    itens: ItemPedidoStatus[]

    /* ---------------------------------------------------------------
       Entrega
       --------------------------------------------------------------- */

    /** "entrega" ou "retirada". Vazio nos pedidos anteriores à entrega. */
    entrega_tipo?: string

    /** O telefone que o comprador deixou neste pedido, só com dígitos. */
    telefone?: string

    cep?: string
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    uf?: string

    /** Quanto foi cobrado de frete, congelado no fechamento do pedido. */
    frete?: number
    prazo_dias?: number

    /* ---------------------------------------------------------------
       Rastreio
       --------------------------------------------------------------- */

    transportadora?: string
    codigo_rastreio?: string

    /** O dia que a loja marcou para despachar, antes de ela despachar. */
    envio_previsto_em?: string

    enviado_em?: string

    /**
     * Quando a mercadoria deve chegar. Calculada pelo servidor a partir do
     * dia da saída (ou do pagamento, enquanto não há dia marcado) mais o
     * prazo combinado — refazer essa conta aqui seria ter duas versões dela.
     */
    previsao_entrega?: string

    /* ---------------------------------------------------------------
       Devolução
       --------------------------------------------------------------- */

    /** Quando a mercadoria chegou. É daqui que correm os sete dias. */
    entregue_em?: string

    /** Quanto deste pedido já voltou para quem comprou. */
    valor_estornado?: number

    /**
     * O que dá para pedir de devolução AGORA, decidido pelo servidor:
     *
     *   "atraso"     — o pedido passou do prazo prometido e não chegou.
     *   "danificado" — chegou há pouco, e veio quebrado ou rasgado.
     *
     * Vazio (ou ausente) é o pedido que não abre nenhuma das duas portas, e
     * aí a tela manda falar com a loja. São as ÚNICAS duas causas: devolução
     * de motivo livre não existe aqui, porque ela automatiza o caminho de
     * quem recebe a mercadoria inteira e pede o dinheiro de volta assim
     * mesmo. Qualquer outro motivo se resolve conversando com a loja, que
     * tem como ver a peça e negociar.
     */
    causas_devolucao?: CausaDevolucao[]

    /** Os pedidos de devolução desta compra, do mais novo para o mais velho. */
    devolucoes?: DevolucaoDoPedido[]
}

/**
 * Um pedido de devolução, como quem comprou o vê.
 *
 * Nasce em "pedida" e termina em "aceita" ou "recusada" — quem decide é a
 * loja. Quando aceita, `estornado_em` é a prova de que o dinheiro saiu de
 * lá; até ele existir, a tela diz que a devolução foi aceita e o valor está
 * a caminho, que é a verdade.
 */
export type CausaDevolucao = "atraso" | "danificado"

export interface DevolucaoDoPedido {
    id: number
    situacao: "pedida" | "aceita" | "recusada"

    /** Por que ela pôde ser pedida. */
    causa: CausaDevolucao

    /** O que a pessoa escreveu. Obrigatório na avaria, opcional no atraso. */
    motivo: string

    /** Quanto a loja devolve: as peças mais o frete, quando ele é devido. */
    valor: number
    frete: number

    /** O que a loja escreveu ao responder. */
    resposta?: string

    itens: { item_pedido_id: number; produto_id: number; quantidade: number }[]

    created_at: string
    decidida_em?: string
    estornado_em?: string
}
