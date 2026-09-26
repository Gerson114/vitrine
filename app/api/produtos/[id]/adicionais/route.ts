// As perguntas que um produto faz: borda, tamanho, ponto da carne.
//
// Rota pública do backend, como o catálogo: escolher não exige conta, e só o
// fechamento do pedido exige. Passa pelo servidor Next pelo mesmo motivo do
// catálogo — a URL do backend não vai para o bundle do navegador.

import { chamarBackend } from "@/lib/backend"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {

    try {
        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "Produto inválido" }, { status: 400 })
        }

        const resposta = await chamarBackend(new URL(`/public/produtos/${id}/adicionais`, API_BASE), {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
        })

        const texto = await resposta.text()

        if (!resposta.ok) {
            return Response.json({ erro: "Não foi possível consultar as opções" }, { status: resposta.status })
        }

        return new Response(texto, {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
