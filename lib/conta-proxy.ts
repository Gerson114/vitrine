import { API_BASE, cookieDaSessao, erroDoBackend, safeParse, slugValido } from "@/lib/conta"
import { sanitizeText } from "@/security/sanitize"
import { lerCorpo } from "@/security/corpo"

/**
 * O caminho comum de "entrar" e "criar conta": os dois mandam credenciais ao
 * backend, recebem um token e o gravam como cookie httpOnly desta loja.
 *
 * O token NUNCA volta ao navegador no corpo. O backend o devolve ali porque
 * ele não tem como gravar cookie no domínio da vitrine, mas quem repassa a
 * resposta somos nós — e aqui ele para, vira cookie e some. Deixá-lo escapar
 * no JSON entregaria a sessão ao JavaScript da página, que é exatamente o que
 * o httpOnly existe para impedir.
 */
export async function abrirSessao(
    request: Request,
    caminho: "login" | "cadastro" | "cadastro/confirmar",
    campos: (entrada: Record<string, unknown>) => Record<string, unknown> | string,
): Promise<Response> {
    try {
        const entrada = await lerCorpo(request)

        if (!entrada) {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const loja = String(entrada.loja ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const corpo = campos(entrada)

        if (typeof corpo === "string") {
            return Response.json({ erro: corpo }, { status: 400 })
        }

        const resposta = await fetch(new URL(`/public/loja/${loja}/${caminho}`, API_BASE), {
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

        // O cadastro que ainda não virou conta.
        //
        // Com servidor de e-mail ligado, criar conta não devolve sessão: o
        // backend guardou os dados e mandou seis dígitos para o e-mail (ver
        // services/cliente). Não há token para virar cookie, e não é erro —
        // é o passo seguinte. A tela recebe o aviso e pede o código.
        const pendente = dados && typeof dados === "object" && "confirmar" in dados
            && Boolean((dados as { confirmar: unknown }).confirmar)

        if (pendente) {
            return Response.json(dados, {
                status: resposta.status,
                headers: { "Cache-Control": "no-store" },
            })
        }

        const token = dados && typeof dados === "object" && "token" in dados
            ? String((dados as { token: unknown }).token ?? "")
            : ""

        if (!token) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        const cliente = dados && typeof dados === "object" && "cliente" in dados
            ? (dados as { cliente: unknown }).cliente
            : null

        const saida = Response.json(
            { cliente },
            { status: resposta.status, headers: { "Cache-Control": "no-store" } },
        )

        saida.headers.append("Set-Cookie", cookieDaSessao(loja, token))

        return saida

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

/** Limpa e confere os campos de entrada, devolvendo a mensagem de erro se algo falta. */
export function credenciais(entrada: Record<string, unknown>, comNome: boolean) {
    const email = sanitizeText(String(entrada.email ?? "")).slice(0, 254)

    // A senha é cortada antes de sair daqui. Não é capricho: no backend ela
    // vira um hash, e hashear um megabyte de texto é trabalho de CPU que o
    // atacante paga em um byte e o servidor paga inteiro — o jeito clássico
    // de derrubar um login sem descobrir senha nenhuma.
    const password = String(entrada.password ?? "").slice(0, 200)

    if (!email || !password) return "Preencha e-mail e senha"

    if (!comNome) return { email, password }

    const nome = sanitizeText(String(entrada.nome ?? "")).slice(0, 120)

    if (!nome) return "Informe o seu nome"

    return { nome, email, password }
}
