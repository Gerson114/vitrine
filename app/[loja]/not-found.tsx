"use client"

import Link from "next/link"
import Header from "@/app/components/header/header"
import Footer from "@/app/components/footer/footer"
import { useLoja } from "@/app/loja/loja-context"
import { caminhoDaLoja } from "@/lib/caminhos"

/**
 * 404 de dentro de uma loja: o endereço da vitrine existe, mas a página (um
 * produto, em geral) não. Como estamos dentro do layout de [loja], o
 * cabeçalho e o rodapé da loja continuam de pé e o visitante volta para o
 * catálogo dela — e não para a raiz, onde não há loja nenhuma.
 */
export default function NotFound() {

    const loja = useLoja()

    return (
        <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
            <Header />

            <main className="largura flex flex-col items-center py-24 text-center">
                <p className="rotulo text-[var(--ink-2)]">Erro 404</p>

                <h1 className="mt-2 text-[1.75rem] font-light leading-tight text-[var(--ink)]">
                    <strong className="font-bold">Página</strong> não encontrada
                </h1>

                <p className="mt-3 max-w-sm text-[0.88rem] text-[var(--ink-2)]">
                    O produto ou a página que você procura não existe nesta loja ou não
                    está mais disponível.
                </p>

                <Link href={caminhoDaLoja(loja.slug)} className="btn mt-6">
                    voltar à vitrine
                </Link>
            </main>

            <Footer />
        </div>
    )
}
