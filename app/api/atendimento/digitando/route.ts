import { API_BASE, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

/**
 * "O cliente está digitando…" a caminho da loja.
 *
 * Não devolve corpo e não devolve erro: este aviso é enfeite útil, e uma
 * falha aqui não pode virar mensagem vermelha por cima da conversa de quem
 * está apenas escrevendo. O pior desfecho é a outra ponta não ver as
 * bolinhas — que é como era antes de isto existir.
 */
export async function POST(request: Request) {
    try {
        const entrada = await lerCorpo(request)
        const loja = String(entrada?.loja ?? "").slice(0, 40)

        if (!slugValido(loja)) return new Response(null, { status: 204 })

        const token = await tokenDaLoja(loja)

        if (!token) return new Response(null, { status: 204 })

        await chamarBackend(new URL(`/public/loja/${loja}/atendimento/digitando`, API_BASE), {
            method: "POST",
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        return new Response(null, { status: 204 })

    } catch {
        return new Response(null, { status: 204 })
    }
}
