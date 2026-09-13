import { abrirSessao, credenciais } from "@/lib/conta-proxy"

// Entrar na conta desta loja. Pública — é justamente quem ainda não tem
// sessão que chama aqui.
export async function POST(request: Request) {
    return abrirSessao(request, "login", (entrada) => credenciais(entrada, false))
}
