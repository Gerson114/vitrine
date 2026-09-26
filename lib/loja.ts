import { cache } from "react"
import type { Bloco, LojaAtual, TemaLoja } from "@/app/loja/loja-context"
import { chamarBackend, TEMPO_LIMITE_CURTO } from "@/lib/backend"

// Só roda no servidor (Server Components e rotas /api) — fala direto com o
// backend, sem passar pelo navegador.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

/**
 * Memorizado por requisição com o `cache` do React.
 *
 * Não é otimização de enfeite: a mesma pergunta era feita ao backend três
 * vezes para desenhar UMA página de produto — uma no `generateMetadata`, uma no
 * layout de [loja] e uma na própria página, porque cada um deles precisa da
 * loja e nenhum tem como passá-la aos outros. Com o `cache`, a primeira chamada
 * responde e as seguintes recebem a MESMA promessa; entre requisições nada é
 * guardado, então a loja continua sendo lida fresca a cada acesso.
 *
 * O segundo efeito importa tanto quanto: com o backend travado, cada chamada
 * esperava o próprio tempo limite, e o visitante levava trinta segundos para
 * receber o erro que a primeira já sabia em dez.
 */

/**
 * Traduz o endereço da URL na loja dona dele. Devolve null quando o endereço
 * não existe, quando a loja ainda não escolheu endereço ou quando ela não
 * assinou o plano com site — de fora, os três casos são o mesmo: essa loja
 * não está no ar.
 *
 * LANÇA quando não foi possível PERGUNTAR — backend fora do ar, tempo limite
 * estourado, resposta 5xx. A diferença entre "esta loja não existe" e "não sei
 * dizer se existe" parece sutil e não é: quem chama responde 404 ao null (ver
 * app/[loja]/layout.tsx), e um 404 é uma AFIRMAÇÃO. Enquanto esta função
 * devolvia null nos dois casos, uma queda de dez minutos do backend fazia toda
 * loja do sistema responder "não encontrada" — inclusive ao robô do Google, que
 * lê isso como "página removida" e tira a loja do índice. Recolocá-la lá leva
 * semanas, e é um estrago desproporcional a uma queda que durou minutos.
 *
 * O que se lança sobe até o boundary de erro (ver app/[loja]/error.tsx) e a
 * página sai com 500 — que é o código que significa "o problema é nosso, volte
 * depois", e é o que faz o buscador manter a loja no índice.
 */
export const buscarLojaServidor = cache(async function buscarLojaServidor(slug: string): Promise<LojaAtual | null> {

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40) {
        return null
    }

    let response: Response

    try {
        response = await chamarBackend(
            new URL(`/public/loja/${encodeURIComponent(slug)}`, API_BASE),
            { headers: { Accept: "application/json" }, cache: "no-store" },
            TEMPO_LIMITE_CURTO,
        )
    } catch (causa) {
        // Rede, DNS ou tempo limite: não chegamos a perguntar.
        throw new Error(`não foi possível consultar a loja ${JSON.stringify(slug)}`, { cause: causa })
    }

    // 5xx é o backend dizendo que ELE falhou, e não que a loja não existe.
    if (response.status >= 500) {
        throw new Error(`o backend respondeu ${response.status} ao consultar a loja ${JSON.stringify(slug)}`)
    }

    if (!response.ok) return null

    try {
        const dados = (await response.json()) as {
            loja?: {
                slug?: string
                nome?: string
                tema?: TemaLoja
                cnpj?: string
                aceita_pagamento?: boolean
                metodos_pagamento?: string[]
                whatsapp?: string
                telefone?: string
                endereco?: string
                horario?: string
                pagina?: Bloco[]
                textos?: Record<string, string>
            }
        }

        if (!dados.loja?.slug) return null

        /* O que chega do servidor passa INTEIRO, e só o que precisa de
           conferência é reescrito por cima.
        
           Aqui havia uma lista escrita à mão de campo por campo, e ela falhava
           em silêncio: campo novo no servidor simplesmente não chegava à tela,
           sem erro, sem aviso e sem nada quebrar de forma visível. Foi assim
           que a vitrine ficou sem a opção de agendamento, sem o botão de
           combinar no WhatsApp e sem a moldura montada no editor — três
           coisas que o servidor mandava e que morriam nesta função.
        
           O `LojaAtual` é o contrato, e ele é conferido pelo TypeScript. O que
           ainda é reescrito abaixo são os dois campos que chegam como estrutura
           livre e a tela percorre com `.map`: um `pagina` que não fosse lista
           quebraria a vitrine inteira. */
        return {
            ...(dados.loja as LojaAtual),

            slug: dados.loja.slug,
            nome: dados.loja.nome || dados.loja.slug,

            metodos_pagamento: Array.isArray(dados.loja.metodos_pagamento)
                ? dados.loja.metodos_pagamento
                : undefined,

            // A lista vem validada do servidor (ver services/paginas): tipo
            // fora do catálogo e propriedade que não pertence ao bloco não
            // chegam até aqui. Só se confere que é uma lista.
            pagina: Array.isArray(dados.loja.pagina) ? dados.loja.pagina : undefined,

            // As palavras desta loja, já resolvidas pelo servidor: cada chave
            // traz o texto final, o que o lojista escreveu ou o padrão (ver
            // services/paginas/textos.go). A vitrine só lê.
            textos:
                dados.loja.textos && typeof dados.loja.textos === "object"
                    ? dados.loja.textos
                    : undefined,
        }

    } catch (causa) {
        // Só o corpo ilegível chega aqui: a loja ausente já saiu por `null`
        // acima. Corpo que não é o JSON esperado é defeito do backend, e não
        // "esta loja não existe" — então sobe, pelo mesmo motivo do 5xx.
        throw new Error(`resposta ilegível ao consultar a loja ${JSON.stringify(slug)}`, { cause: causa })
    }
})
