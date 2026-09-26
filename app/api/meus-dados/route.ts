import { API_BASE, cookieApagado, erroDoBackend, safeParse, slugValido, tokenDaLoja } from "@/lib/conta"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

/**
 * Os direitos do titular (LGPD): ver o que a loja guarda, e mandar apagar.
 *
 * GET  → devolve o arquivo com os dados, como anexo.
 * POST → executa a exclusão e derruba a sessão aqui também.
 *
 * A sessão vive num cookie httpOnly desta origem, e o backend não alcança
 * esse cookie: sem apagá-lo aqui, a pessoa terminaria a exclusão e
 * continuaria com a tela dizendo que está logada — parecendo que nada
 * aconteceu, no momento em que ela mais precisa de clareza.
 */
export async function GET(request: Request) {
    try {
        const loja = String(new URL(request.url).searchParams.get("loja") ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const token = await tokenDaLoja(loja)

        if (!token) {
            return Response.json({ erro: "Entre na sua conta para ver os seus dados" }, { status: 401 })
        }

        const resposta = await chamarBackend(new URL(`/public/loja/${loja}/meus-dados`, API_BASE), {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        const texto = await resposta.text()

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(safeParse(texto), "Não foi possível reunir os seus dados") },
                { status: resposta.status },
            )
        }

        // Anexo: o direito é receber os dados num formato que dê para guardar
        // e levar embora, não uma tela para ler e esquecer.
        return new Response(texto, {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": 'attachment; filename="meus-dados.json"',
                "Cache-Control": "no-store",
            },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

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
            return Response.json({ erro: "Entre na sua conta para pedir a exclusão" }, { status: 401 })
        }

        const resposta = await chamarBackend(new URL(`/public/loja/${loja}/meus-dados/excluir`, API_BASE), {
            method: "POST",
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        const dados = safeParse(await resposta.text())

        if (!resposta.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível concluir a exclusão") },
                { status: resposta.status },
            )
        }

        const saida = Response.json(dados ?? {}, { status: 200, headers: { "Cache-Control": "no-store" } })

        // A conta deixou de existir: o cookie que a representava vai junto.
        saida.headers.append("Set-Cookie", cookieApagado(loja))

        return saida

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
