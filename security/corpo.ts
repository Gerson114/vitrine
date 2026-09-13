/**
 * Leitura do corpo JSON das rotas internas, com teto de tamanho.
 *
 * `request.json()` lê o que vier: um POST de 50 MB em /api/pedidos é aceito,
 * carregado inteiro na memória do servidor e só então descartado por ser
 * inválido. Meia dúzia de conexões fazendo isso ao mesmo tempo derrubam o
 * processo sem precisar de nenhuma falha de lógica — é negação de serviço
 * pelo caminho mais barato que existe.
 *
 * Nada que esta vitrine manda chega perto de 32 KB: o maior corpo é um pedido
 * com dezenas de itens, e cada item são dois números.
 *
 * O `content-length` é conferido primeiro porque corta antes de ler; mas ele
 * é opcional (e mentiroso, num corpo `chunked`), então o texto lido é medido
 * de novo. Corpo grande demais e JSON quebrado voltam iguais — `null` — e a
 * rota responde a mesma coisa aos dois: quem manda 50 MB não merece uma
 * mensagem de erro melhor do que quem manda `{`.
 */

export const LIMITE_DO_CORPO = 32 * 1024

export async function lerCorpo(request: Request): Promise<Record<string, unknown> | null> {

    const declarado = Number(request.headers.get("content-length") ?? "")

    if (Number.isFinite(declarado) && declarado > LIMITE_DO_CORPO) return null

    const bruto = await request.text().catch(() => "")

    if (!bruto || bruto.length > LIMITE_DO_CORPO) return null

    try {
        const dados: unknown = JSON.parse(bruto)

        // Só objeto serve. Array e valor solto passariam pelo `typeof` e
        // quebrariam na primeira leitura de campo.
        if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null

        return dados as Record<string, unknown>

    } catch {
        return null
    }
}
