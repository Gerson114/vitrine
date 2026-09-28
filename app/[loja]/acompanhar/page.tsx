import Link from "next/link"
import { notFound } from "next/navigation"
import Header from "@/app/components/header/header"
import Footer from "@/app/components/footer/footer"
import { buscarLojaServidor } from "@/lib/loja"
import { clienteLogado, meusPedidos } from "@/lib/conta"
import { caminhoDaLoja } from "@/lib/caminhos"
import CartaoPedido from "@/app/components/pedido/cartao-pedido"
import MeusDados from "@/app/components/conta/meus-dados"
import type { Metadata } from "next"

/**
 * Fora do índice de busca.
 *
 * Esta tela mostra nome, e-mail, endereço e o que a pessoa comprou. Ela exige
 * sessão, então o robô nunca vê o conteúdo — mas sem este `noindex` o ENDEREÇO
 * dela entra no índice de qualquer forma, por qualquer link que aponte para
 * cá, e uma loja não deve ter "meus pedidos de <nome>" achável no Google.
 *
 * É o par do Disallow em app/robots.ts, e não o substitui: o robots.txt pede
 * para não rastrear, este cabeçalho manda não indexar. Buscador que ignora o
 * primeiro costuma respeitar o segundo.
 */
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

/**
 * Meus pedidos.
 *
 * Era um formulário pedindo o código de 6 dígitos. Não é mais: fechar pedido
 * passou a exigir conta, então o pedido tem dono e quem está logado já provou
 * quem é — pedir o código de novo seria perguntar duas vezes a mesma coisa. E
 * o código sozinho é um espaço de busca de um milhão, pequeno demais para ser
 * a única chave de um dado pessoal.
 *
 * Componente de servidor: a sessão vive num cookie httpOnly, que o navegador
 * não lê. Quem pergunta ao backend é o servidor.
 */
export default async function MeusPedidosPage({ params }: PageProps<"/[loja]/acompanhar">) {

    const { loja: slug } = await params
    const loja = await buscarLojaServidor(slug)

    if (!loja) notFound()

    const cliente = await clienteLogado(slug)
    const pedidos = cliente ? await meusPedidos(slug) : []

    // A mesma linha que separa as abas do painel do lojista: concluído é
    // "entregue" ou "cancelado" — os dois desfechos em que nada mais vai
    // acontecer com o pedido. O resto (aguardando pagamento, em preparo, a
    // caminho) é o que a pessoa abriu esta tela para ver.
    const emAndamento = pedidos.filter((pedido) => pedido.status !== "entregue" && pedido.status !== "cancelado")
    const concluidos = pedidos.filter((pedido) => pedido.status === "entregue" || pedido.status === "cancelado")

    return (
        <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
            <Header />

            <main className="largura flex flex-1 flex-col py-8 sm:py-12">

                <p className="rotulo text-[var(--ink-3)]">Minha conta</p>

                <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--linha)] pb-4">
                    <h1 className="text-[1.35rem] font-light leading-tight text-[var(--ink)] sm:text-[1.6rem]">
                        {cliente
                            ? <>Olá, <strong className="font-bold">{cliente.nome.split(" ")[0]}</strong></>
                            : <><strong className="font-bold">Entre</strong> para ver seus pedidos</>}
                    </h1>

                    {cliente && pedidos.length > 0 ? (
                        <span className="text-[0.8rem] text-[var(--ink-2)]">
                            {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
                        </span>
                    ) : null}
                </div>

                {!cliente ? (
                    <div className="mt-6 max-w-md border border-[var(--linha)] bg-[var(--placa)] p-5">
                        <p className="text-[0.88rem] text-[var(--ink-2)]">
                            Seus pedidos ficam guardados na sua conta desta loja — sem
                            código para decorar.
                        </p>
                        <Link href={caminhoDaLoja(slug, "conta")} className="btn mt-4 inline-block">
                            entrar ou criar conta
                        </Link>
                    </div>
                ) : pedidos.length === 0 ? (
                    <div className="mt-6 max-w-md border border-[var(--linha)] bg-[var(--placa)] p-5">
                        <p className="text-[0.88rem] text-[var(--ink-2)]">
                            Você ainda não fez nenhum pedido nesta loja.
                        </p>
                        <Link href={caminhoDaLoja(slug)} className="btn mt-4 inline-block">
                            ver produtos
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* EM ANDAMENTO primeiro, e sempre visível: é o pedido
                            que a pessoa abriu esta tela para acompanhar. Numa
                            conta com muita compra (a loja atende há tempo), ele
                            ficava perdido no meio de trinta entregues — a
                            mesma pergunta que fez o painel do lojista separar
                            "em andamento" de "aguardando"/"entregues". */}
                        {emAndamento.length > 0 ? (
                            <div className="mt-6">
                                <h2 className="rotulo text-[var(--ink-2)]">
                                    Em andamento · {emAndamento.length}
                                </h2>

                                <ul className="mt-3 flex flex-col gap-3">
                                    {emAndamento.map((pedido) => (
                                        <CartaoPedido key={pedido.codigo} pedido={pedido} slug={slug} />
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {concluidos.length > 0 ? (
                            <div className={emAndamento.length > 0 ? "mt-8" : "mt-6"}>
                                <h2 className="rotulo text-[var(--ink-3)]">
                                    Concluídos · {concluidos.length}
                                </h2>

                                <ul className="mt-3 flex flex-col gap-3">
                                    {concluidos.map((pedido) => (
                                        <CartaoPedido key={pedido.codigo} pedido={pedido} slug={slug} />
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </>
                )}

                {cliente ? <MeusDados slug={slug} /> : null}

            </main>

            <Footer />
        </div>
    )
}
