import { API_BASE, erroDoBackend, safeParse, slugValido } from "@/lib/conta"
import { sanitizeText } from "@/security/sanitize"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

/**
 * Esqueci minha senha, nesta loja: pedir o código e trocar a senha com ele.
 *
 * Uma rota só para os dois passos, escolhidos por `acao`, porque são o mesmo
 * assunto e compartilham tudo — a loja, a limpeza dos campos e o repasse. O
 * que NÃO vem para cá é decisão nenhuma: quem diz se existe conta com aquele
 * e-mail (e cuida para que a resposta seja igual existindo ou não) é o
 * backend.
 *
 * Trocar a senha não abre sessão de propósito: quem acabou de escolher uma
 * senha nova entra com ela, e uma sessão que nasce de um código de e-mail é
 * uma sessão a mais para alguém herdar num aparelho compartilhado.
 */
export async function POST(request: Request) {
    try {
        const entrada = await lerCorpo(request)

        if (!entrada) {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const loja = String(entrada.loja ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const trocar = String(entrada.acao ?? "") === "redefinir"
        const email = sanitizeText(String(entrada.email ?? "")).slice(0, 254)

        if (!email) {
            return Response.json({ erro: "Informe o seu e-mail" }, { status: 400 })
        }

        const corpo: Record<string, unknown> = { email }

        if (trocar) {

            const codigo = String(entrada.codigo ?? "").trim().slice(0, 6)
            const senha = String(entrada.senha ?? "").slice(0, 200)

            if (!codigo || !senha) {
                return Response.json({ erro: "Preencha o código e a senha nova" }, { status: 400 })
            }

            corpo.codigo = codigo
            corpo.senha = senha
        }

        const caminho = trocar ? "senha/redefinir" : "senha/recuperar"

        const resposta = await chamarBackend(new URL(`/public/loja/${loja}/${caminho}`, API_BASE), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(corpo),
            cache: "no-store",
        })

        const dados = safeParse(await resposta.text())

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível continuar") },
                { status: resposta.status },
            )
        }

        return Response.json(dados ?? {}, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
