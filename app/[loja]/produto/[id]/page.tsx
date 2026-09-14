import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { FiBox, FiCamera, FiChevronRight, FiLock, FiPackage } from "react-icons/fi"
import Header from "@/app/components/header/header"
import Footer from "@/app/components/footer/footer"
import ProductActions from "@/app/components/product/product-actions"
import PrecoProduto from "@/app/components/product/preco-produto"
import Prateleira from "@/app/components/prateleira"
import AvaliacoesDoProduto from "@/app/components/avaliacao/avaliacoes-produto"
import { listarProdutosServidor } from "@/lib/catalogo"
import { buscarLojaServidor } from "@/lib/loja"
import { texto } from "@/app/loja/textos"
import { caminhoDaLoja } from "@/lib/caminhos"
import { agruparPorNome, ordenarPorVariacao } from "@/lib/variantes"

export async function generateMetadata({ params }: PageProps<"/[loja]/produto/[id]">): Promise<Metadata> {

    const { loja: slug, id } = await params
    const loja = await buscarLojaServidor(slug)

    if (!loja) return { title: "Loja não encontrada" }

    if (!/^\d+$/.test(id)) return { title: `Produto não encontrado | ${loja.nome}` }

    const produtos = await listarProdutosServidor(loja.slug)
    const produto = produtos.find((item) => item.id === Number(id))

    return {
        title: produto ? `${produto.nome} | ${loja.nome}` : `Produto não encontrado | ${loja.nome}`,
        description: produto?.categoria ? `${produto.nome} — ${produto.categoria}` : undefined,
    }
}

export default async function ProdutoPage({ params }: PageProps<"/[loja]/produto/[id]">) {

    const { loja: slug, id } = await params

    if (!/^\d+$/.test(id)) notFound()

    // O catálogo já vem restrito a esta loja, então um id de produto de
    // outra vitrine simplesmente não é encontrado aqui.
    //
    // A loja vem junto porque esta página é montada no SERVIDOR e não tem o
    // contexto de React que o resto da vitrine usa — e é dela que saem as
    // palavras que o lojista reescreveu ("Sem estoque no momento" e companhia).
    // As duas buscas saem juntas: em série, a página esperaria uma para só
    // então pedir a outra.
    const [produtos, loja] = await Promise.all([
        listarProdutosServidor(slug),
        buscarLojaServidor(slug),
    ])
    const produto = produtos.find((item) => item.id === Number(id))

    if (!produto) notFound()

    const esgotado = produto.estoque <= 0

    // Outros produtos, agrupados por nome (cada tamanho é cadastrado à
    // parte) — exclui o próprio produto, cujos tamanhos já aparecem no
    // seletor logo abaixo.
    const relacionados = agruparPorNome(produtos.filter((item) => item.nome !== produto.nome))
        .sort((a, b) => {
            const categoriaA = a.variantes[0].categoria === produto.categoria ? -1 : 0
            const categoriaB = b.variantes[0].categoria === produto.categoria ? -1 : 0
            return categoriaA - categoriaB
        })
        .slice(0, 8)

    // Cada tamanho é cadastrado como produto separado com o mesmo nome (ver
    // handlers/cadastroProduto/roupas no backend, que só bloqueia duplicar
    // nome+tamanho). Aqui juntamos essas variantes pra virar um seletor.
    const variantes = produtos
        .filter((item) => item.nome === produto.nome)
        .sort(ordenarPorVariacao)

    const temVariantes = variantes.length > 1

    // A ficha técnica não tem mais campos fixos: "Cor" e "Tecido" viraram
    // linhas de `atributos`, o mapa livre que cada ramo preenche com o próprio
    // vocabulário. A variação só aparece aqui quando é única — havendo mais de
    // uma, o seletor logo acima já a mostra.
    const detalhes = [
        !temVariantes && produto.variacao
            ? { rotulo: produto.variacao_rotulo || "Variação", valor: produto.variacao }
            : null,
        ...Object.entries(produto.atributos ?? {}).map(([rotulo, valor]) => ({ rotulo, valor })),
        { rotulo: "Código", valor: produto.codigo },
    ].filter((detalhe): detalhe is { rotulo: string; valor: string } => Boolean(detalhe?.valor))

    const temPromocao =
        produto.preco_promocional != null &&
        Number(produto.preco_promocional) < Number(produto.preco)

    const precoFinal = Number(produto.preco_promocional ?? produto.preco)

    const percentual = temPromocao
        ? Math.round((1 - precoFinal / Number(produto.preco)) * 100)
        : 0

    return (
        <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
            <Header />

            <main className="largura py-5 sm:py-6">

                {/* min-w-0 nos itens que encolhem: dentro de um flex, um item
                    com truncate ainda tem largura mínima automática, e o nome
                    de produto comprido empurrava a migalha para fora da tela
                    no celular em vez de virar reticências. */}
                <nav aria-label="Você está em" className="mb-5 flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-3)]">
                    <Link href={caminhoDaLoja(slug)} className="link shrink-0">Início</Link>
                    <FiChevronRight className="w-3 shrink-0" aria-hidden />
                    <span className="hidden min-w-0 shrink-0 truncate capitalize sm:inline">{produto.categoria || "Produtos"}</span>
                    <FiChevronRight className="hidden w-3 shrink-0 sm:block" aria-hidden />
                    <span className="min-w-0 truncate text-[var(--ink)]">{produto.nome}</span>
                </nav>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:items-start">

                    {/* Gruda ao rolar: a coluna da direita é mais alta que a
                        foto (ficha técnica, descrição, relacionados), e sem
                        isto a pessoa perde a imagem de vista justamente
                        enquanto lê o que está comprando. */}
                    <div className="card relative overflow-hidden lg:sticky lg:top-32">
                        <div className="flex aspect-square items-center justify-center overflow-hidden bg-white p-4 sm:p-8">
                            {produto.imagem_url ? (
                                <img
                                    src={produto.imagem_url}
                                    alt={produto.nome}
                                    className={`h-full w-full object-contain ${esgotado ? "grayscale" : ""}`}
                                />
                            ) : (
                                <span className="flex flex-col items-center gap-2 text-[var(--ink-3)]">
                                    <FiCamera className="w-8" aria-hidden />
                                    <span className="text-sm">sem imagem</span>
                                </span>
                            )}
                        </div>

                        {esgotado ? (
                            <span className="absolute left-3 top-3 rounded-[var(--radius-sm)] bg-[var(--ink)] px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-white">
                                esgotado
                            </span>
                        ) : null}

                        {temPromocao && percentual > 0 && !esgotado ? (
                            <span className="selo-off absolute left-3 top-3 text-[0.85rem]">
                                -{percentual}%
                            </span>
                        ) : null}
                    </div>

                    <div className="flex flex-col">

                        <p className="rotulo text-[var(--ink-2)]">{produto.categoria || "Produto"}</p>

                        {/* first-letter:uppercase, e não capitalize: o lojista
                            cadastra como quiser ("ventilador"), e um título de
                            produto em caixa baixa parece cadastro pela metade.
                            capitalize estragaria os nomes que já vêm certos —
                            "Smart Tv Lg 65 Qned" viraria pior do que já é. */}
                        <h1 className="mt-1.5 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)] first-letter:uppercase sm:text-[1.6rem]">
                            {produto.nome}
                        </h1>

                        <p className="mt-1 text-[0.78rem] text-[var(--ink-3)]">
                            Código {produto.codigo}
                        </p>

                        {/* A CAIXA DE COMPRA.
                            Preço, opção, botão e garantias dentro de uma placa
                            só, como nas lojas de departamento. Soltos na
                            página, eles eram cinco blocos de texto seguidos e
                            o botão de comprar não se destacava de nenhum — a
                            caixa é o que transforma isso num lugar onde se
                            decide. */}
                        <div className="card mt-5 p-4 sm:mt-6 sm:p-5">

                            <PrecoProduto
                                preco={precoFinal}
                                precoAntigo={temPromocao ? Number(produto.preco) : undefined}
                                percentual={percentual}
                            />

                            {/* "peças" saiu: esta vitrine vende ventilador,
                                café e parafuso também, e contar tudo em peças é
                                vocabulário de loja de roupa. */}
                            <p className={`mt-3 text-[0.82rem] font-semibold ${esgotado ? "text-[var(--vermelho)]" : produto.estoque <= 3 ? "text-[var(--coral)]" : "text-[var(--verde)]"}`}>
                                {esgotado
                                    ? texto(loja?.textos, "produto.esgotado", "Sem estoque no momento")
                                    : produto.estoque <= 3
                                        ? texto(loja?.textos, "produto.ultimas", "Últimas {n} em estoque", {
                                            n: `${produto.estoque} ${produto.estoque === 1 ? "unidade" : "unidades"}`,
                                        })
                                        : texto(loja?.textos, "produto.em_estoque", "Em estoque, pronto para envio")}
                            </p>

                        {temVariantes ? (
                            <div className="mt-5 border-t border-[var(--linha-suave)] pt-4">
                                {/* O rótulo é o que o LOJISTA escolheu para
                                    este eixo. Estava fixo em "Tamanho", então
                                    a loja de eletro mostrava "Tamanho 220V" —
                                    o tipo de detalhe errado que faz o cliente
                                    desconfiar do resto da página. */}
                                <p className="rotulo">
                                    {produto.variacao_rotulo?.trim() || texto(loja?.textos, "produto.opcao", "Opção")}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {variantes.map((variante) => {
                                        const selecionado = variante.id === produto.id
                                        const semEstoque = variante.estoque <= 0

                                        return (
                                            <Link
                                                key={variante.id}
                                                href={caminhoDaLoja(slug, `produto/${variante.id}`)}
                                                aria-current={selecionado ? "true" : undefined}
                                                className={`chip flex h-11 min-w-11 items-center justify-center px-3 font-semibold uppercase ${
                                                    selecionado
                                                        ? "chip-ativo"
                                                        : semEstoque
                                                            ? "text-[var(--esgotado)] line-through"
                                                            : ""
                                                }`}
                                            >
                                                {variante.variacao}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}

                            <div className="mt-5">
                                <ProductActions produto={produto} />
                            </div>

                        {/* As garantias ficam coladas no botão de propósito: é
                            no segundo antes de clicar em "comprar" que a dúvida
                            aparece, e é ali que ela tem de ser respondida — não
                            no rodapé, onde quase ninguém chega.

                            As três são verdade sobre este sistema. Nenhuma
                            promete prazo, frete ou troca, que são coisas que só
                            a loja pode prometer. */}
                            {!esgotado ? (
                                <ul className="mt-4 divide-y divide-[var(--linha-suave)] border-t border-[var(--linha-suave)]">
                                <Garantia
                                    Icone={FiLock}
                                    titulo="Compra segura"
                                    texto="Seus dados de cartão não passam por esta loja: o pagamento acontece no ambiente do provedor."
                                />
                                <Garantia
                                    Icone={FiBox}
                                    titulo="Peça reservada na hora"
                                    texto="Ao fechar o pedido, esta unidade sai do estoque e fica separada para você."
                                />
                                    <Garantia
                                        Icone={FiPackage}
                                        titulo="Acompanhe pela sua conta"
                                        texto="Do pagamento à entrega, cada etapa fica registrada em Meus pedidos."
                                    />
                                </ul>
                            ) : null}

                        </div>

                        {detalhes.length > 0 ? (
                            <dl className="mt-8 divide-y divide-[var(--linha-suave)] border-t border-[var(--linha)]">
                                {detalhes.map((detalhe) => (
                                    <div key={detalhe.rotulo} className="flex justify-between gap-4 py-2.5 text-[0.85rem]">
                                        <dt className="text-[var(--ink-2)]">{detalhe.rotulo}</dt>
                                        <dd className="capitalize text-[var(--ink)]">{detalhe.valor}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : null}

                        {produto.descricao ? (
                            <div className="mt-8 border-t border-[var(--linha)] pt-6">
                                <p className="rotulo">Descrição</p>
                                <p className="mt-3 whitespace-pre-line text-[0.88rem] leading-relaxed text-[var(--ink)]">
                                    {produto.descricao}
                                </p>
                            </div>
                        ) : null}

                        {/* O que quem comprou achou. Numa loja que ninguém
                            conhece, é a prova mais barata de que ela entrega
                            — e só aparece quando existe de verdade. */}
                        <AvaliacoesDoProduto produtoID={produto.id} loja={slug} />

                    </div>

                </div>

            </main>

            {relacionados.length > 0 ? (
                <Prateleira titulo="Você também pode gostar" grupos={relacionados} />
            ) : null}

            <Footer />
        </div>
    )
}

/** Uma linha de garantia ao lado do botão de compra. */
function Garantia({ Icone, titulo, texto }: {
    Icone: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    titulo: string
    texto: string
}) {
    return (
        <li className="flex items-start gap-3 py-3">
            <Icone className="mt-0.5 w-4 shrink-0 text-[var(--destaque)]" aria-hidden />
            <div>
                <p className="text-[0.82rem] font-semibold text-[var(--ink)]">{titulo}</p>
                <p className="mt-0.5 text-[0.78rem] leading-relaxed text-[var(--ink-2)]">{texto}</p>
            </div>
        </li>
    )
}
