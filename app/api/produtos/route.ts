import { sanitizeText } from "@/security/sanitize"

// Sem cookie, sem Authorization — a rota pública /public/produtos do
// backend não exige sessão. Ainda assim passa pelo servidor Next (nunca
// direto do navegador) para a URL do backend nunca ficar exposta no
// bundle do cliente, e para não depender de CORS entre os dois serviços.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const nome = sanitizeText(searchParams.get("nome") ?? "").slice(0, 100)
        const loja = (searchParams.get("loja") ?? "").slice(0, 40)

        // Sem loja não há catálogo: cada vitrine enxerga só o próprio.
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const url = new URL("/public/produtos", API_BASE)
        url.searchParams.set("loja", loja)

        if (nome) {
            url.searchParams.set("nome", nome)
        }

        const response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: "Não foi possível carregar os produtos" }, { status: response.status })
        }

        const dados = safeParse(texto)

        if (!dados) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        return Response.json(dados, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}
