import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import Header from "@/app/components/header/header"
import FormularioConta from "@/app/components/conta/formulario-conta"
import { buscarLojaServidor } from "@/lib/loja"
import { clienteLogado } from "@/lib/conta"
import { caminhoDaLoja } from "@/lib/caminhos"

export default async function ContaPage({ params }: PageProps<"/[loja]/conta">) {

    const { loja: slug } = await params

    const loja = await buscarLojaServidor(slug)

    if (!loja) notFound()

    const inicio = caminhoDaLoja(slug)

    const cliente = await clienteLogado(slug)

    if (cliente) redirect(inicio)

    return (
        <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
            <Header />

            <main className="largura flex flex-1 flex-col justify-center py-10 sm:py-12">

                <div className="mb-6 text-center">
                    <p className="rotulo text-[var(--ink-2)]">{loja.nome}</p>
                    <h1 className="mt-1 text-[1.25rem] font-light leading-snug text-[var(--ink)] sm:text-[1.4rem]">
                        Para finalizar o pedido, <strong className="font-bold">crie sua conta</strong>
                    </h1>
                    <p className="mt-2 text-[0.85rem] text-[var(--ink-2)]">
                        É rápido, e depois você acompanha seus pedidos por aqui.
                    </p>
                </div>

                <FormularioConta voltarPara={inicio} />

                <p className="mt-8 text-center text-[0.8rem]">
                    <Link href={inicio} className="link">voltar para a loja</Link>
                </p>

            </main>
        </div>
    )
}
