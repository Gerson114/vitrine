"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import type { Produto } from "@/app/type/type"
import { useLoja } from "@/app/loja/loja-context"
import Header from "@/app/components/header/header"
import Footer from "@/app/components/footer/footer"
import BannerSlider from "@/app/components/banner-slider"
import Atalhos, { type Atalho } from "@/app/components/atalhos"
import Prateleira from "@/app/components/prateleira"
import Cartoes from "@/app/components/cartoes"
import Pagination from "@/app/components/pagination"
import ProductCard from "@/app/components/product/product-card"
import { agruparPorNome, desconto, precoFinal, representante } from "@/lib/variantes"
import { BlocoEspaco, BlocoFaixa, BlocoImagem, BlocoSecao, BlocoTexto } from "@/app/components/blocos"
import type { Bloco } from "@/app/loja/loja-context"

/**
 * A home de quem nunca abriu o editor: a composição que a vitrine sempre
 * teve, escrita como blocos. O servidor manda esta mesma lista quando a loja
 * não tem layout gravado (ver services/paginas.Padrao) — ela existe aqui para
 * o caso de a resposta vir sem página nenhuma.
 */
const LAYOUT_PADRAO: Bloco[] = [
    { id: "banner", tipo: "banner" },
    { id: "atalhos", tipo: "atalhos" },
    { id: "ofertas", tipo: "prateleira", titulo: "Ofertas do dia", fonte: "ofertas", quantidade: 8 },
    { id: "grade", tipo: "grade" },
]

const ITENS_POR_PAGINA = 12

type Ordenacao = "relevancia" | "menor-preco" | "maior-preco" | "desconto" | "nome"

const ORDENACOES: { valor: Ordenacao; rotulo: string }[] = [
    { valor: "relevancia", rotulo: "Mais relevantes" },
    { valor: "menor-preco", rotulo: "Menor preço" },
    { valor: "maior-preco", rotulo: "Maior preço" },
    { valor: "desconto", rotulo: "Maiores descontos" },
    { valor: "nome", rotulo: "Nome (A–Z)" },
]

interface RespostaCatalogo {
    produtos: Produto[]
}

async function listarProdutos(loja: string, nome?: string): Promise<Produto[]> {
    const parametros = new URLSearchParams({ loja })

    if (nome) parametros.set("nome", nome)

    const response = await fetch(`/api/produtos?${parametros}`, { cache: "no-store" })

    if (!response.ok) {
        throw new Error("Não foi possível carregar os produtos.")
    }

    const dados = (await response.json()) as RespostaCatalogo
    return Array.isArray(dados.produtos) ? dados.produtos : []
}

export default function Vitrine({ buscaInicial = "" }: { buscaInicial?: string }) {

    const loja = useLoja()

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState(buscaInicial)
    const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
    const [ordenacao, setOrdenacao] = useState<Ordenacao>("relevancia")
    const [paginaAtual, setPaginaAtual] = useState(1)

    // A régua de categorias vem do catálogo inteiro, não do resultado da
    // busca: ela é navegação, e navegação não pode sumir quando o visitante
    // digita uma palavra que não casa com nada.
    const [categorias, setCategorias] = useState<string[]>([])

    const grade = useRef<HTMLElement>(null)


    /* ==========================
       DADOS
    ========================== */

    useEffect(() => {
        const termo = busca.trim()
        let cancelado = false

        // Debounce: uma requisição por pausa na digitação, não por tecla.
        const timer = setTimeout(() => {
            setLoading(true)
            setErro("")

            listarProdutos(loja.slug, termo || undefined)
                .then((dados) => {
                    if (cancelado) return

                    setProdutos(dados)
                    if (!termo) setCategorias(extrairCategorias(dados))
                })
                .catch(() => {
                    if (!cancelado) setErro("Não foi possível carregar os produtos.")
                })
                .finally(() => {
                    if (!cancelado) setLoading(false)
                })
        }, 300)

        return () => {
            cancelado = true
            clearTimeout(timer)
        }
    }, [busca, loja.slug])


    /* ==========================
       FILTROS
       Todo filtro recomeça a paginação — senão o visitante cai numa página
       4 que não existe mais depois de filtrar.
    ========================== */

    function mudarBusca(valor: string) {
        setBusca(valor)
        setPaginaAtual(1)
    }

    function mudarCategoria(categoria: string | null) {
        setCategoriaAtiva(categoria)
        setPaginaAtual(1)
    }

    function mudarOrdenacao(valor: Ordenacao) {
        setOrdenacao(valor)
        setPaginaAtual(1)
    }

    function limparFiltros() {
        setBusca("")
        setCategoriaAtiva(null)
        setPaginaAtual(1)
    }


    /* ==========================
       DERIVADOS
    ========================== */

    const atalhos = useMemo<Atalho[]>(() => {
        return categorias.map((categoria) => ({
            nome: categoria,
            imagem:
                produtos.find(
                    (produto) => produto.categoria?.trim() === categoria && produto.imagem_url,
                )?.imagem_url ?? "",
        }))
    }, [categorias, produtos])

    // Cada tamanho é um produto cadastrado à parte (mesmo nome). Agrupamos
    // antes de ordenar/paginar para a grade mostrar um card por peça, com o
    // cliente trocando de tamanho dentro do próprio card.
    const gruposEmOferta = useMemo(() => {
        return agruparPorNome(produtos)
            .filter((grupo) => desconto(representante(grupo.variantes)) > 0)
            .sort((a, b) => desconto(representante(b.variantes)) - desconto(representante(a.variantes)))
    }, [produtos])

    const visiveis = useMemo(() => {
        const lista = produtos.filter(
            (produto) => !categoriaAtiva || produto.categoria?.trim() === categoriaAtiva,
        )

        const grupos = agruparPorNome(lista)
        const ordenados = [...grupos]

        switch (ordenacao) {
            case "menor-preco":
                return ordenados.sort((a, b) => precoFinal(representante(a.variantes)) - precoFinal(representante(b.variantes)))
            case "maior-preco":
                return ordenados.sort((a, b) => precoFinal(representante(b.variantes)) - precoFinal(representante(a.variantes)))
            case "desconto":
                return ordenados.sort((a, b) => desconto(representante(b.variantes)) - desconto(representante(a.variantes)))
            case "nome":
                return ordenados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
            default:
                return ordenados
        }
    }, [produtos, categoriaAtiva, ordenacao])

    const totalPaginas = Math.max(1, Math.ceil(visiveis.length / ITENS_POR_PAGINA))

    // O catálogo pode encolher entre um carregamento e outro; a página fica
    // presa ao intervalo válido sem precisar de um efeito para corrigir.
    const pagina = Math.min(paginaAtual, totalPaginas)

    const gruposDaPagina = useMemo(() => {
        const inicio = (pagina - 1) * ITENS_POR_PAGINA
        return visiveis.slice(inicio, inicio + ITENS_POR_PAGINA)
    }, [visiveis, pagina])

    // Com busca ou categoria ligadas a página vira uma tela de resultado: o
    // material editorial do topo sai da frente.
    const filtrando = busca.trim() !== "" || categoriaAtiva !== null
    const mostrarVitrine = !filtrando && !loading && !erro

    function irParaGrade() {
        grade.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    /* ==========================
       O DESENHO DA HOME

       Quais seções aparecem e em que ordem é decisão do lojista, feita no
       editor do painel. O que chega é uma lista de blocos já validada pelo
       servidor; aqui cada tipo vira o componente que sempre existiu.
    ========================== */

    const blocos = loja.pagina && loja.pagina.length > 0 ? loja.pagina : LAYOUT_PADRAO

    /** Os produtos de uma prateleira, conforme a fonte que o lojista escolheu. */
    function gruposDaPrateleira(bloco: Bloco) {

        const quantidade = bloco.quantidade && bloco.quantidade > 0 ? bloco.quantidade : 8

        if (bloco.fonte === "categoria" && bloco.categoria) {
            return agruparPorNome(
                produtos.filter((produto) => produto.categoria?.trim() === bloco.categoria),
            ).slice(0, quantidade)
        }

        // "recentes" é a ordem em que o catálogo veio — o backend já entrega
        // do mais novo para o mais antigo.
        if (bloco.fonte === "recentes") {
            return agruparPorNome(produtos).slice(0, quantidade)
        }

        return gruposEmOferta.slice(0, quantidade)
    }

    /**
     * Um bloco vira componente.
     *
     * Recursiva por causa das seções: uma seção é um arranjo de colunas, e o
     * que vai dentro delas são estes mesmos blocos. A grade não passa por
     * aqui — ela é a página inteira, e tem lugar próprio no return.
     */
    function desenharBloco(bloco: Bloco): React.ReactNode {

        switch (bloco.tipo) {

            case "secao":
                return <BlocoSecao bloco={bloco} desenhar={desenharBloco} />

            case "banner":
                return <BannerSlider />

            // A faixa de selos ("compra segura", "acompanhe seu pedido"). Era
            // desenhada aqui mesmo, grudada no banner e escrita no código, sob
            // o argumento de que não é conteúdo que o lojista compõe. O
            // argumento não se sustentou: a promessa é da LOJA, e enquanto o
            // sistema a escrevia, toda loja prometia a mesma coisa — inclusive
            // a que não entrega nada disso. Agora é bloco, e cada cartão tem
            // dono (ver components/cartoes).
            case "cartoes":
                return <Cartoes bloco={bloco} />

            case "atalhos":
                return (
                    <Atalhos
                        atalhos={atalhos}
                        aoEscolher={(categoria) => {
                            mudarCategoria(categoria)
                            irParaGrade()
                        }}
                    />
                )

            case "prateleira":
                return (
                    <Prateleira
                        id={bloco.id}
                        titulo={bloco.titulo || "Destaques"}
                        grupos={gruposDaPrateleira(bloco)}
                    />
                )

            case "texto":
                return <BlocoTexto bloco={bloco} />

            case "faixa":
                return <BlocoFaixa bloco={bloco} />

            case "imagem":
                return <BlocoImagem bloco={bloco} />

            case "espaco":
                return <BlocoEspaco bloco={bloco} />

            // Tipo que esta versão da vitrine não conhece: não desenha nada,
            // em vez de quebrar a loja. Acontece se o layout for gravado por
            // uma versão mais nova do painel.
            default:
                return null
        }
    }


    /**
     * A grade de produtos, como variável: ela é um BLOCO do layout, e precisa
     * poder ser desenhada onde o lojista a puser — antes ou depois das
     * prateleiras, das faixas e do texto.
     */
    const secaoDaGrade = (
            <main id="grade" ref={grade} className="largura scroll-mt-[9.5rem] pb-10 pt-4 sm:scroll-mt-32 sm:pb-12">

                <div className="mb-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-[var(--linha)] pb-3">

                    <div className="min-w-0 flex-1">
                        <h1 className="titulo truncate">
                            {tituloDaGrade(busca, categoriaAtiva)}
                        </h1>

                        {!loading && !erro ? (
                            <p className="mt-0.5 text-[0.8rem] text-[var(--ink-2)]">
                                {visiveis.length}{" "}
                                {visiveis.length === 1 ? "produto encontrado" : "produtos encontrados"}
                            </p>
                        ) : null}
                    </div>

                    {/* "Ordenar por" escrito some no celular: o próprio
                        seletor já diz o que faz, e a palavra custava a linha
                        inteira ao lado do título do resultado. */}
                    <label className="flex shrink-0 items-center gap-2 text-[0.8rem] text-[var(--ink-2)]">
                        <span className="hidden sm:inline">Ordenar por</span>

                        <select
                            value={ordenacao}
                            onChange={(e) => mudarOrdenacao(e.target.value as Ordenacao)}
                            className="chip max-w-[52vw] cursor-pointer sm:max-w-none"
                        >
                            {ORDENACOES.map((opcao) => (
                                <option key={opcao.valor} value={opcao.valor}>
                                    {opcao.rotulo}
                                </option>
                            ))}
                        </select>
                    </label>

                </div>


                {loading ? (
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-4 xl:grid-cols-5">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="card">
                                <div className="aspect-square animate-pulse bg-[var(--placa)]" />
                                <div className="space-y-2 p-3">
                                    <div className="h-3 animate-pulse bg-[var(--placa)]" />
                                    <div className="h-3 w-2/3 animate-pulse bg-[var(--placa)]" />
                                    <div className="h-5 w-1/2 animate-pulse bg-[var(--placa)]" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}


                {!loading && erro ? (
                    <div className="flex flex-col items-center border border-[var(--linha)] px-5 py-10 text-center sm:p-12">
                        <p className="text-lg font-semibold text-[var(--ink)]">
                            Não foi possível carregar a vitrine
                        </p>

                        <p className="mt-1 text-[0.85rem] text-[var(--ink-2)]">{erro}</p>

                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="btn mt-5"
                        >
                            tentar de novo
                        </button>
                    </div>
                ) : null}


                {!loading && !erro && visiveis.length === 0 ? (
                    <div className="flex flex-col items-center border border-[var(--linha)] px-5 py-10 text-center sm:p-12">
                        <p className="text-lg font-semibold text-[var(--ink)]">Nada por aqui</p>

                        <p className="mt-1 max-w-sm text-[0.85rem] text-[var(--ink-2)]">
                            {mensagemVazio(busca, categoriaAtiva)}
                        </p>

                        {filtrando ? (
                            <button
                                type="button"
                                onClick={limparFiltros}
                                className="btn btn-claro mt-5"
                            >
                                ver a loja inteira
                            </button>
                        ) : null}
                    </div>
                ) : null}


                {!loading && !erro && visiveis.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-4 xl:grid-cols-5">
                            {gruposDaPagina.map((grupo) => (
                                <ProductCard key={grupo.nome} variantes={grupo.variantes} />
                            ))}
                        </div>

                        <Pagination
                            paginaAtual={pagina}
                            totalPaginas={totalPaginas}
                            aoMudarPagina={(destino) => {
                                setPaginaAtual(destino)
                                irParaGrade()
                            }}
                        />
                    </>
                ) : null}

            </main>
    )

    // Sem bloco de grade na página, a busca do cabeçalho não teria onde
    // mostrar resultado. Ela então aparece assim que alguém filtra: navegação
    // não pode deixar de funcionar por causa de uma escolha de layout.
    const temGrade = blocos.some((bloco) => bloco.tipo === "grade")

    return (

        <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">

            <Header
                busca={busca}
                aoBuscar={mudarBusca}
                categorias={categorias}
                categoriaAtiva={categoriaAtiva}
                aoEscolherCategoria={mudarCategoria}
            />

            {/* ==========================
                O QUE O LOJISTA MONTOU

                A ordem é a que ele deixou no editor. Os blocos editoriais
                (banner, atalhos, prateleiras, texto) somem quando alguém
                busca ou filtra — a página vira uma tela de resultado, e
                material de vitrine ali só empurra o resultado para baixo. A
                grade fica sempre, porque é ela o resultado.
            ========================== */}
            {blocos.map((bloco) => {

                if (bloco.tipo === "grade") {
                    return <Fragment key={bloco.id}>{secaoDaGrade}</Fragment>
                }

                if (!mostrarVitrine) return null

                return <Fragment key={bloco.id}>{desenharBloco(bloco)}</Fragment>
            })}

            {!temGrade && filtrando ? secaoDaGrade : null}


            <Footer />

        </div>

    )
}


/* ==========================
   AUXILIARES
========================== */

/** Categorias distintas do catálogo, em ordem alfabética de português. */
function extrairCategorias(produtos: Produto[]): string[] {
    const nomes = produtos
        .map((produto) => produto.categoria?.trim())
        .filter((nome): nome is string => Boolean(nome))

    return Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, "pt-BR"))
}

function tituloDaGrade(busca: string, categoria: string | null): string {
    if (busca.trim()) return `Resultados para "${busca.trim()}"`
    if (categoria) return categoria
    return "Todos os produtos"
}

function mensagemVazio(busca: string, categoria: string | null): string {
    if (busca.trim()) return `Não encontramos nada para "${busca.trim()}". Tente outra palavra.`
    if (categoria) return "Esta categoria está sem produtos no momento."
    return "O catálogo ainda não tem produtos publicados."
}
