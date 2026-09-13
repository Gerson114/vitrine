import Link from "next/link"

/**
 * 404 de fora de qualquer loja — é o que aparece quando o endereço não é de
 * nenhuma vitrine no ar. Não usa o cabeçalho nem o rodapé da loja de
 * propósito: os dois dependem de saber qual loja é esta, e aqui não há uma.
 */
export default function NotFound() {
    return (
        <main className="largura flex min-h-screen flex-col items-center justify-center py-24 text-center">

            <p className="rotulo text-[var(--ink-2)]">Erro 404</p>

            <h1 className="mt-2 text-[1.75rem] font-light leading-tight text-[var(--ink)]">
                <strong className="font-bold">Loja</strong> não encontrada
            </h1>

            <p className="mt-3 max-w-sm text-[0.88rem] leading-relaxed text-[var(--ink-2)]">
                Este endereço não é de nenhuma loja no ar. Confira o link que a loja
                divulgou — ele pode ter sido digitado errado ou a loja pode não estar
                mais publicada.
            </p>

            <Link href="/" className="btn mt-6">
                voltar ao início
            </Link>

        </main>
    )
}
