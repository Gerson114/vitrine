// Pública — banners configurados pelo lojista pro topo da loja. Só repassa
// pro backend, no mesmo padrão de proxy usado no resto do app.
import { chamarBackend } from "@/lib/backend"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export async function GET(request: Request) {
    try {
        const loja = (new URL(request.url).searchParams.get("loja") ?? "").slice(0, 40)

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(loja)) {
            return Response.json({ banners: [] }, { status: 200, headers: { "Cache-Control": "no-store" } })
        }

        const url = new URL("/public/banners", API_BASE)
        url.searchParams.set("loja", loja)

        const response = await chamarBackend(url, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ banners: [] }, { status: 200, headers: { "Cache-Control": "no-store" } })
        }

        const dados = safeParse(texto)

        return Response.json(dados ?? { banners: [] }, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ banners: [] }, { status: 200, headers: { "Cache-Control": "no-store" } })
    }
}

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}
