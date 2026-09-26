"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { caminhoDaLoja } from "@/lib/caminhos"

/**
 * O erro de dentro de uma loja: a vitrine existe, mas a página quebrou.
 *
 * É o par do not-found.tsx daqui, para a outra forma de uma página não
 * aparecer. A diferença com o global-error é que aqui o layout de [loja] está
 * de pé, então as cores do lojista já valem e há para onde voltar: o catálogo
 * dele.
 *
 * O endereço da loja vem de `useParams`, e não do contexto: se o que quebrou
 * foi o próprio provedor, `useLoja` lançaria de novo dentro do boundary — e um
 * boundary que lança é a tela branca que ele existe para evitar.
 */
export default function ErroDaLoja({ reset }: { error: Error & { digest?: string }; reset: () => void }) {

    const parametros = useParams<{ loja: string }>()
    const slug = typeof parametros?.loja === "string" ? parametros.loja : ""

    return (
        <main className="largura flex min-h-screen flex-col items-center justify-center py-24 text-center">

            <p className="rotulo text-[var(--ink-2)]">Erro</p>

            <h1 className="mt-2 text-[1.75rem] font-light leading-tight text-[var(--ink)]">
                <strong className="font-bold">Esta página</strong> não carregou
            </h1>

            <p className="mt-3 max-w-sm text-[0.88rem] leading-relaxed text-[var(--ink-2)]">
                Foi uma falha nossa, e não no seu pedido: nada do que você já comprou
                mudou por causa disto. Tente de novo ou volte à vitrine.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => reset()} className="btn">
                    tentar de novo
                </button>

                {slug ? (
                    <Link href={caminhoDaLoja(slug)} className="link text-[0.85rem]">
                        voltar à vitrine
                    </Link>
                ) : null}
            </div>

        </main>
    )
}
