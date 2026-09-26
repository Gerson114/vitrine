import { API_BASE, erroDoBackend, safeParse, slugValido, tokenDaLoja, tokenLimpo } from "@/lib/conta"
import { cookies } from "next/headers"
import { sanitizeText } from "@/security/sanitize"
import { lerCorpo } from "@/security/corpo"
import { chamarBackend } from "@/lib/backend"

const isDev = process.env.NODE_ENV === "development"

/**
 * Um pedido, para a tela de detalhe.
 *
 * Dois caminhos, nesta ordem:
 *
 *  1. QUEM TEM CONTA — a sessão prova de quem é o pedido, e o código só diz
 *     qual. É o caminho normal desde que fechar pedido passou a exigir conta.
 *
 *  2. QUEM NÃO TEM — código de 6 dígitos mais o contato informado na compra,
 *     ou um token de consulta já verificada. Continua existindo por causa dos
 *     pedidos antigos, feitos quando a vitrine ainda vendia sem cadastro.
 *
 * POST, e não GET, nos dois casos: nem código nem contato devem aparecer em
 * URL, que vai para o log do proxy e para o histórico do navegador.
 */
export async function POST(request: Request) {
    try {
        const entrada = await lerCorpo(request)

        if (!entrada) {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const codigo = sanitizeText(String(entrada.codigo ?? ""))
        const contato = sanitizeText(String(entrada.contato ?? ""))
        const loja = String(entrada.loja ?? "").slice(0, 40)

        if (!/^\d{6}$/.test(codigo) || !slugValido(loja)) {
            return Response.json({ erro: "Pedido não encontrado" }, { status: 404 })
        }

        // ---- caminho 1: sessão ----
        const sessao = await tokenDaLoja(loja)

        if (sessao) {
            const resposta = await chamarBackend(
                new URL(`/public/loja/${loja}/pedidos/${codigo}`, API_BASE),
                {
                    headers: { Accept: "application/json", Authorization: `Bearer ${sessao}` },
                    cache: "no-store",
                },
            )

            if (resposta.ok) {
                const dados = safeParse(await resposta.text())

                if (dados && typeof dados === "object" && "pedido" in dados) {
                    return Response.json(
                        { pedido: (dados as { pedido: unknown }).pedido },
                        { status: 200, headers: { "Cache-Control": "no-store" } },
                    )
                }
            }

            // Não achou pela conta (pedido de antes de ter conta, por
            // exemplo): cai no caminho antigo em vez de negar.
        }

        // ---- caminho 2: código + contato ----
        const cookieStore = await cookies()
        const nomeCookie = `pedido_token_${loja}_${codigo}`
        const tokenSalvo = cookieStore.get(nomeCookie)?.value ?? ""

        if (!tokenSalvo && !contato) {
            return Response.json({ erro: "Pedido não encontrado" }, { status: 404 })
        }

        const response = await chamarBackend(new URL("/public/pedidos/consulta", API_BASE), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ loja, codigo, contato, token: tokenSalvo }),
            cache: "no-store",
        })

        const dados = safeParse(await response.text())

        if (!response.ok) {
            return Response.json(
                { erro: erroDoBackend(dados, "Não foi possível consultar o pedido") },
                { status: response.status },
            )
        }

        if (!dados) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        // tokenLimpo pelo mesmo motivo do cookie de sessão (ver lib/conta): o
        // valor entra num Set-Cookie concatenado à mão, e um `;` dentro dele
        // seria lido pelo navegador como atributo do cookie.
        const novoToken = dados && typeof dados === "object" && "token" in dados
            ? tokenLimpo((dados as { token: unknown }).token)
            : ""

        const saida = Response.json(
            { pedido: (dados as { pedido: unknown }).pedido },
            { status: 200, headers: { "Cache-Control": "no-store" } },
        )

        // httpOnly e escopado por loja E código no próprio nome: um pedido
        // verificado não desbloqueia nenhum outro.
        if (novoToken) {
            saida.headers.append(
                "Set-Cookie",
                `${nomeCookie}=${novoToken}; Path=/; Max-Age=${60 * 60 * 24 * 7}; HttpOnly; SameSite=Lax${isDev ? "" : "; Secure"}`,
            )
        }

        return saida

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}
