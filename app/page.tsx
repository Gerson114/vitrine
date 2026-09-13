import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vitrines",
    description: "Cada loja tem o seu próprio endereço.",
}

/**
 * Raiz do domínio: aqui não existe loja nenhuma. Cada lojista tem o próprio
 * endereço (/maria-modas), e é por ele que os clientes chegam — esta página
 * só explica isso para quem caiu no endereço sem o nome da loja.
 */
export default function Raiz() {
    return (
        <main className="largura flex min-h-screen flex-col items-center justify-center py-24 text-center">

            <p className="rotulo text-[var(--ink-2)]">Vitrines</p>

            <h1 className="mt-2 text-[1.75rem] font-light leading-tight text-[var(--ink)]">
                <strong className="font-bold">Cada loja</strong> tem o seu endereço
            </h1>

            <p className="mt-3 max-w-sm text-[0.88rem] leading-relaxed text-[var(--ink-2)]">
                Abra o endereço que a loja divulgou para você — ele termina com o
                nome dela, como em <code className="font-mono text-[var(--ink)]">/maria-modas</code>.
            </p>

        </main>
    )
}
