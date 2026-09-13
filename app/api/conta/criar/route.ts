import { abrirSessao, credenciais } from "@/lib/conta-proxy"

// Criar conta nesta loja. O backend já devolve a pessoa logada — ela acabou
// de escolher a senha, e pedir para digitá-la de novo só faz abandonar
// carrinho.
export async function POST(request: Request) {
    return abrirSessao(request, "cadastro", (entrada) => credenciais(entrada, true))
}
