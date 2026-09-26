/**
 * Toda chamada da vitrine ao backend passa por aqui, por um motivo: o tempo
 * limite.
 *
 * O `fetch` do Node não tem teto de duração. Backend que aceita a conexão e
 * não responde — banco travado num lock, pool de conexões esgotado, a rede do
 * Docker no meio de um reinício — deixa a requisição pendurada indefinidamente,
 * e cada uma dessas segura um pedido do servidor Next do outro lado. Em poucos
 * minutos de backend doente a vitrine para de responder a QUALQUER coisa,
 * inclusive às páginas que não dependem dele, porque não há mais o que atender
 * com. É uma queda que não aparece em nenhum log de erro: as requisições
 * simplesmente nunca terminam.
 *
 * Com teto, a mesma falha vira um 502 ou uma lista vazia em dez segundos, e o
 * servidor continua de pé. Uma loja que responde "não foi possível carregar os
 * produtos" é ruim; uma loja que não responde é pior, e conserta-se mais
 * devagar porque nada indica onde doeu.
 *
 * O teto NÃO cobre o tempo de leitura do corpo — `AbortSignal.timeout` conta da
 * chamada até o fim da resposta, que é justamente o que se quer limitar aqui,
 * já que todo corpo que vem do backend é JSON de alguns kilobytes.
 */

/**
 * Dez segundos para o que a vitrine mostra: catálogo, loja, banner, pedido.
 *
 * É muito acima do normal (o backend responde em milissegundos, na mesma rede
 * do Docker) e bem abaixo da paciência de quem está olhando a tela — quem
 * esperou dez segundos já recarregou a página.
 */
export const TEMPO_LIMITE = 10_000

/**
 * Cinco segundos para a leitura de uma linha só: a loja pelo endereço dela.
 *
 * O teto é mais apertado que o das outras porque a consulta é a mais barata que
 * existe no sistema (uma busca por chave, na mesma rede do Docker) e porque ela
 * é o PRIMEIRO passo de toda página da vitrine: enquanto ela não responde, nada
 * é desenhado.
 *
 * E porque ela é cobrada duas vezes quando falha. No caminho normal a
 * memorização por requisição a reduz a uma chamada por acesso (ver
 * buscarLojaServidor em lib/loja.ts), mas quando ela lança, o Next renderiza a
 * página uma segunda vez para montar a tela de erro — e essa segunda passagem
 * tem memória própria e paga o tempo limite de novo. Com dez segundos, o
 * visitante esperava vinte para receber um erro; com cinco, dez.
 */
export const TEMPO_LIMITE_CURTO = 5_000

/**
 * Trinta segundos para o que atravessa até o provedor de pagamento.
 *
 * Fechar pedido e conferir pagamento não param no backend: ele chama a
 * InfinitePay, que é um serviço na internet aberta, com a latência de um. Dez
 * segundos ali cortariam uma cobrança legítima pela metade — e cortar no meio
 * de um pagamento é o único caso em que o tempo limite custa mais do que a
 * espera.
 */
export const TEMPO_LIMITE_PAGAMENTO = 30_000

/**
 * Chama o backend com teto de duração.
 *
 * A assinatura é a do `fetch` de propósito, para os pontos de chamada não
 * mudarem de forma: só o nome da função muda. `cache: "no-store"` fica como
 * padrão porque é o que toda chamada daqui já pedia — catálogo, pedido e sessão
 * não podem vir de cache.
 */
export function chamarBackend(
    endereco: URL | string,
    opcoes: RequestInit = {},
    limite: number = TEMPO_LIMITE,
): Promise<Response> {
    return fetch(endereco, {
        cache: "no-store",
        ...opcoes,

        // Um sinal que já venha nas opções manda: quem chama pode ter o próprio
        // motivo para desistir antes.
        signal: opcoes.signal ?? AbortSignal.timeout(limite),
    })
}
