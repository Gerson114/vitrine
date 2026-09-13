import { abrirSessao } from "@/lib/conta-proxy"
import { sanitizeText } from "@/security/sanitize"

// Os seis dígitos que fazem a conta nascer.
//
// O cadastro inteiro já está guardado do lado do backend (nome e senha com
// hash), então daqui só sobem o e-mail e o código — a pessoa não redigita
// nada, e a senha não viaja uma segunda vez.
export async function POST(request: Request) {
    return abrirSessao(request, "cadastro/confirmar", (entrada) => {

        const email = sanitizeText(String(entrada.email ?? "")).slice(0, 254)
        const codigo = String(entrada.codigo ?? "").trim().slice(0, 6)

        if (!email || !codigo) return "Preencha o código que chegou por e-mail"

        return { email, codigo }
    })
}
