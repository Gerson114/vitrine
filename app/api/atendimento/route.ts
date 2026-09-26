import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

/**
 * O chat do cliente com a loja.
 *
 * Como o resto da vitrine, o navegador nunca fala com o backend direto: a
 * sessão vive num cookie httpOnly do domínio da loja, e é este servidor que a
 * lê e a apresenta ao backend.
 *
 * GET /api/atendimento?loja=slug&desde=<id> — o fio, ou só o que chegou
 * depois de `desde`. É essa segunda forma que a tela usa para se atualizar
 * sozinha sem rebaixar a conversa inteira a cada poucos segundos.
 */
export async function GET(request: Request) {
    try {
        const parametros = new URL(request.url).searchParams

        const loja = String(parametros.get("loja") ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const token = await tokenDaLoja(loja)

        // Sem sessão não há fio: o atendimento é da CONTA da pessoa nesta
        // loja. A tela usa este 401 para convidar a entrar, em vez de mostrar
        // um chat que não manda nada.
        if (!token) {
            return Response.json({ erro: "Entre na sua conta para falar com a loja" }, { status: 401 })
        }

        const desde = String(parametros.get("desde") ?? "").replace(/\D+/g, "").slice(0, 12)

        const endereco = new URL(`/public/loja/${loja}/atendimento`, API_BASE)

        if (desde) endereco.searchParams.set("desde", desde)

        const resposta = await chamarBackend(endereco, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        const dados = safeParse(await resposta.text())

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível abrir o atendimento") },
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

/** POST /api/atendimento — o cliente mandando uma mensagem. */
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

        const token = await tokenDaLoja(loja)

        if (!token) {
            return Response.json({ erro: "Entre na sua conta para falar com a loja" }, { status: 401 })
        }

        // O corte aqui é só para não trafegar um livro; quem limpa e aplica o
        // teto de verdade é o backend, que é quem grava.
        const texto = String(entrada.texto ?? "").slice(0, 2000)

        if (!texto.trim()) {
            return Response.json({ erro: "Escreva alguma coisa antes de enviar" }, { status: 400 })
        }

        const resposta = await chamarBackend(new URL(`/public/loja/${loja}/atendimento/mensagens`, API_BASE), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ texto }),
            cache: "no-store",
        })

        const dados = safeParse(await resposta.text())

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível enviar a mensagem") },
                { status: resposta.status },
            )
        }

        return Response.json(dados ?? {}, {
            status: 201,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
