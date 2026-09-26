import { API_BASE, cookieApagado, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

// Sair da conta.
//
// Avisa o backend ANTES de apagar o cookie: é lá que a sessão morre de
// verdade (o TokenVersao do cliente é incrementado e todo token já emitido
// deixa de valer). Apagar só o cookie deixaria uma cópia do token válida por
// mais sete dias.
export async function POST(request: Request) {
    try {
        const entrada = await lerCorpo(request)
        const loja = String(entrada?.loja ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const token = await tokenDaLoja(loja)

        if (token) {
            // Falha aqui não impede a saída: o cookie é apagado de qualquer
            // jeito, e ficar preso numa conta por causa de um erro de rede
            // seria pior do que uma sessão que sobrevive no servidor.
            await chamarBackend(new URL(`/public/loja/${loja}/logout`, API_BASE), {
                method: "POST",
                headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
                cache: "no-store",
            }).catch(() => null)
        }

        const saida = Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
        saida.headers.append("Set-Cookie", cookieApagado(loja))

        return saida

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
