import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"

/**
 * As avaliações: as de um produto (públicas) e as que o comprador já deu num
 * pedido (dele, e só dele).
 *
 * GET /api/avaliacoes?loja=slug&produto=12 — o que disseram daquele produto.
 * GET /api/avaliacoes?loja=slug&pedido=905014 — o que EU já avaliei ali.
 *
 * As duas leituras moram na mesma rota porque são a mesma pergunta feita de
 * dois lugares — a página do produto e a do pedido —, e a diferença entre
 * elas é só quem pode ver o quê. Quem decide isso é o backend: a segunda
 * forma leva a sessão junto.
 */
export async function GET(request: Request) {
    try {
        const parametros = new URL(request.url).searchParams

        const loja = String(parametros.get("loja") ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const pedido = String(parametros.get("pedido") ?? "")

        if (pedido) {

            if (!/^\d{6}$/.test(pedido)) {
                return Response.json({ erro: "Pedido não encontrado" }, { status: 404 })
            }

            const token = await tokenDaLoja(loja)

            if (!token) {
                return Response.json({ avaliacoes: [] }, { status: 200 })
            }

            return repassar(
                new URL(`/public/loja/${loja}/pedidos/${pedido}/avaliacoes`, API_BASE),
                { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
            )
        }

        const produto = String(parametros.get("produto") ?? "").replace(/\D+/g, "").slice(0, 12)

        if (!produto) {
            return Response.json({ erro: "Produto não informado" }, { status: 400 })
        }

        const endereco = new URL(`/public/produtos/${produto}/avaliacoes`, API_BASE)
        endereco.searchParams.set("loja", loja)

        return repassar(endereco, { headers: { Accept: "application/json" } })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

/** POST /api/avaliacoes — a nota que o comprador dá a um produto que recebeu. */
export async function POST(request: Request) {
    try {
        const entrada = await lerCorpo(request)

        if (!entrada) {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const loja = String(entrada.loja ?? "").slice(0, 40)
        const codigo = String(entrada.codigo ?? "")

        if (!slugValido(loja) || !/^\d{6}$/.test(codigo)) {
            return Response.json({ erro: "Pedido não encontrado" }, { status: 404 })
        }

        const token = await tokenDaLoja(loja)

        if (!token) {
            return Response.json({ erro: "Entre na sua conta para avaliar" }, { status: 401 })
        }

        const nota = Number(entrada.nota)

        if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
            return Response.json({ erro: "Dê uma nota de 1 a 5" }, { status: 400 })
        }

        return repassar(
            new URL(`/public/loja/${loja}/pedidos/${codigo}/avaliacoes`, API_BASE),
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    produto_id: Number(entrada.produto_id),
                    nota,
                    comentario: String(entrada.comentario ?? "").slice(0, 600),
                }),
            },
        )

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

async function repassar(endereco: URL, opcoes: RequestInit): Promise<Response> {

    const resposta = await fetch(endereco, { ...opcoes, cache: "no-store" })

    const dados = safeParse(await resposta.text())

    if (!resposta.ok) {
        return Response.json(
            { erro: erroDoBackend(dados, "Não foi possível carregar as avaliações") },
            { status: resposta.status },
        )
    }

    return Response.json(dados ?? {}, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
    })
}
