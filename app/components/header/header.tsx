"use client"

import { Fragment, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FiPackage, FiSearch, FiShoppingBag, FiUser, FiX,
    FiLock,
    FiHome,
    FiGrid,
    FiMenu,
    FiLogOut,
    FiChevronDown,
    FiChevronRight,
    FiTruck,
    FiHeadphones,
    FiCreditCard,
    FiRefreshCw,
    FiClock,
    FiStar,
    FiGift,
    FiShield,
    FiTag,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { useCarrinho } from "@/app/cart/cart-context"
import { useLoja, useTexto } from "@/app/loja/loja-context"
import type { FaixaDoTopo, PecaDaMoldura } from "@/app/loja/loja-context"
import { useConta } from "@/app/conta/conta-context"
import { caminhoDaLoja } from "@/lib/caminhos"
import { linkSeguro } from "@/lib/link"
import MenuMobile from "./menu-mobile"
import Filiais from "./filiais"
import { sairDaConta } from "./sair"

interface HeaderProps {
    /** Busca controlada — só a vitrine passa isso; nas outras páginas o
     *  campo vira um formulário que leva de volta para a home com `?q=`. */
    busca?: string
    aoBuscar?: (valor: string) => void
    categorias?: string[]
    categoriaAtiva?: string | null
    aoEscolherCategoria?: (categoria: string | null) => void
}

/**
 * Topo em três faixas, no arranjo das grandes lojas de departamento
 * brasileiras (a referência aqui é a Havan): a faixa fina de serviço, a
 * barra da marca com a busca no meio e o bloco de conta/sacola à direita,
 * e embaixo a régua de departamentos aberta pelo botão fixo.
 *
 * O que faz esse arranjo passar credibilidade não é enfeite: é a busca ser
 * o maior elemento da tela (numa loja de departamento é por ela que se
 * compra), a conta e a sacola dizerem em duas linhas o que fazem em vez de
 * serem dois ícones mudos, e a faixa de cima carregar só garantia que a
 * loja de fato dá — inclusive o CNPJ, que é o sinal mais direto de que há
 * empresa registrada por trás da página.
 *
 * Tudo é pintado pelas variáveis do tema (--destaque / --sobre-destaque),
 * então a loja que escolheu azul recebe este mesmo topo em azul.
 */
export default function Header({
    busca,
    aoBuscar,
    categorias,
    categoriaAtiva = null,
    aoEscolherCategoria,
}: HeaderProps) {

    const { totalItens, abrir } = useCarrinho()
    const conta = useConta()

    // As palavras desta loja. "Departamentos" é de loja de departamento; a de
    // bairro diz "Categorias", e agora pode dizer (ver loja-context.useTexto).
    const t = useTexto()
    const [menuAberto, setMenuAberto] = useState(false)

    // A gaveta do celular. Separada do painel de departamentos porque as duas
    // podem existir na mesma página e abrir uma tem de fechar a outra — duas
    // camadas sobrepostas ao mesmo tempo é como se perde a saída.
    const [gavetaAberta, setGavetaAberta] = useState(false)

    // Esc fecha o painel. É o atalho que quem navega por teclado tenta
    // primeiro, e sem ele o painel vira uma armadilha de foco.
    useEffect(() => {
        if (!menuAberto) return

        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuAberto(false)
        }

        window.addEventListener("keydown", aoTeclar)
        return () => window.removeEventListener("keydown", aoTeclar)
    }, [menuAberto])

    // O topo é grudado. Parado no alto da página ele não precisa de sombra;
    // por cima do conteúdo rolando, precisa — sem ela as duas camadas se
    // misturam e o topo parece ter vazado para dentro da página.
    const [rolado, setRolado] = useState(false)

    useEffect(() => {
        const aoRolar = () => setRolado(window.scrollY > 4)

        aoRolar()
        window.addEventListener("scroll", aoRolar, { passive: true })
        return () => window.removeEventListener("scroll", aoRolar)
    }, [])

    const router = useRouter()

    // Sair passa pelo servidor (ver `sair.ts`); o refresh depois é o que faz
    // o servidor redesenhar a página já como visitante.
    async function sair() {
        await sairDaConta(loja.slug)
        router.refresh()
    }
    const loja = useLoja()

    // O logo, quando o lojista apontou um. Vazio cai na inicial + nome.
    const logo = loja.tema?.logo_url?.trim() ?? ""
    const buscaControlada = typeof aoBuscar === "function"

    // Toda ligação do topo é relativa à loja atual: a marca leva à home
    // dela, e a busca sem JavaScript volta para a home dela também.
    const inicio = caminhoDaLoja(loja.slug)

    const campoBusca = (
        <>
            <label htmlFor="busca" className="sr-only">
                Buscar produtos
            </label>

            <input
                id="busca"
                name="q"
                type="text"
                /* No celular isso troca a tecla "enter" pela lupa e abre o
                   teclado já no modo de busca — é o que o dedo espera de um
                   campo que ocupa uma linha inteira do topo. */
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                defaultValue={buscaControlada ? undefined : ""}
                value={buscaControlada ? busca ?? "" : undefined}
                onChange={buscaControlada ? (e) => aoBuscar!(e.target.value) : undefined}
                placeholder={t("topo.busca", "O que você procura hoje?")}
                maxLength={100}
                /* A borda clara é o que separa o campo da barra quando a loja
                   escolhe um destaque claro: sem ela, campo branco em barra
                   branca some. Vem do --sobre-destaque, então acompanha o
                   tema sozinha. */
                className="campo h-11 border-[color-mix(in_srgb,var(--sobre-destaque)_28%,transparent)] pl-3.5 pr-16 text-[1rem] sm:pl-4 sm:pr-20 sm:text-[0.9rem]"
            />

            {buscaControlada && busca ? (
                <button
                    type="button"
                    onClick={() => aoBuscar!("")}
                    aria-label="Limpar busca"
                    className="absolute right-[3.25rem] top-1/2 -translate-y-1/2 p-1 text-[var(--ink-3)] transition-colors hover:text-[var(--ink)] sm:right-[3.75rem]"
                >
                    <FiX className="w-4" aria-hidden />
                </button>
            ) : null}

            {/* Buscar é um botão de verdade, não um ícone solto dentro do
                campo: num catálogo grande a busca é o caminho principal, e
                ela tem de parecer clicável de longe. */}
            <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-px top-px flex h-[calc(2.75rem-2px)] w-12 items-center justify-center rounded-r-[var(--radius-md)] bg-[var(--destaque)] text-[var(--sobre-destaque)] transition-opacity hover:opacity-85 sm:w-14"
            >
                <FiSearch className="w-[1.15rem]" aria-hidden />
            </button>
        </>
    )

    /* ------------------------------------------------------------------
       A MOLDURA

       As faixas do topo, as peças de cada uma e a ordem delas vêm do
       editor do painel (ver services/paginas/moldura.go). O que chega aqui
       é dado — "sacola", "busca grande", "selo com ícone de cadeado" —,
       nunca marcação: quem desenha cada peça continua sendo este arquivo,
       revisado uma vez.

       Sem moldura na resposta, cai no padrão escrito logo abaixo. Isso só
       acontece com um servidor mais velho que esta vitrine, no meio de um
       deploy — e nesse minuto a loja aparece com o topo de sempre em vez
       de aparecer sem topo nenhum.
       ------------------------------------------------------------------ */
    const faixas = loja.moldura?.cabecalho?.faixas?.length
        ? loja.moldura.cabecalho.faixas
        : FAIXAS_DE_FABRICA

    /** Em que telas a peça existe. É o que substitui posicionamento livre. */
    function aparicaoDa(peca: PecaDaMoldura): string {

        if (peca.aparicao === "so-desktop") return "hidden md:flex"
        if (peca.aparicao === "so-celular") return "flex md:hidden"

        return "flex"
    }

    /* Uma peça do topo, desenhada pelo tipo dela.

       O switch é exaustivo de propósito e termina em null: peça de um tipo
       que esta vitrine ainda não conhece simplesmente não aparece, em vez
       de derrubar a página. É o que permite o servidor ganhar uma peça
       nova antes de a vitrine ser publicada. */
    function Peca({ peca }: { peca: PecaDaMoldura }) {

        const aparicao = aparicaoDa(peca)

        switch (peca.tipo) {

            case "marca":
                return (
                    <Link
                        href={inicio}
                        aria-label={`${loja.nome} — página inicial`}
                        className={`${aparicao} min-w-0 shrink items-center gap-2 transition-opacity hover:opacity-90 sm:shrink-0 sm:gap-2.5`}
                    >
                        {/* Com logo, a marca é a imagem e mais nada: repetir o
                            nome escrito ao lado dela é o erro clássico de
                            cabeçalho de loja. O nome continua na página pelo
                            title, e a imagem leva o alt. Sem logo, a inicial
                            recortada e o nome, como sempre foi. */}
                        {logo ? (
                            <img
                                src={logo}
                                alt={loja.nome}
                                className={peca.tamanho === "grande"
                                    ? "h-10 w-auto max-w-[12rem] object-contain sm:h-14 sm:max-w-[16rem]"
                                    : "h-8 w-auto max-w-[9rem] object-contain sm:h-10 sm:max-w-[12rem]"}
                            />
                        ) : (
                            <>
                                <span className="font-[family-name:var(--font-display)] flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--sobre-destaque)] text-base font-bold text-[var(--destaque)] sm:h-10 sm:w-10 sm:text-lg">
                                    {loja.nome.trim().charAt(0).toUpperCase() || "M"}
                                </span>

                                {/* O espacejamento largo é a assinatura da
                                    marca, mas em tela estreita ele come a
                                    linha inteira: no celular fica apertado o
                                    bastante para o nome caber sem reticências
                                    e volta ao normal a partir de `sm`. */}
                                <span className="font-[family-name:var(--font-display)] min-w-0 truncate text-[0.9rem] font-semibold uppercase tracking-[0.1em] text-[var(--sobre-destaque)] sm:max-w-[16rem] sm:text-[1.02rem] sm:tracking-[0.22em]">
                                    {loja.nome}
                                </span>
                            </>
                        )}
                    </Link>
                )

            case "busca": {

                /* A busca é o único elemento que MUDA de lugar entre o
                   celular e o desktop: lá ela desce para uma linha própria
                   (order-3, largura inteira), aqui ela fica entre a marca e
                   os atalhos. Por isso ela carrega as próprias classes de
                   layout em vez de herdá-las da área — a área do centro é
                   `contents`, e some da conta do flex. */
                const larguraDaBusca = peca.tamanho === "grande" ? "md:max-w-[36rem]" : "md:max-w-[22rem]"

                return buscaControlada ? (
                    <div className={`relative order-3 w-full min-w-0 flex-1 md:order-none md:w-auto ${larguraDaBusca}`}>
                        {campoBusca}
                    </div>
                ) : (
                    <form
                        action={inicio}
                        className={`relative order-3 w-full min-w-0 flex-1 md:order-none md:w-auto ${larguraDaBusca}`}
                    >
                        {campoBusca}
                    </form>
                )
            }

            case "pedidos":
                return (
                    <span className={aparicao}>
                        <AcaoTopo
                            href={caminhoDaLoja(loja.slug, "acompanhar")}
                            icone={<FiPackage className="w-[1.3rem]" aria-hidden />}
                            acima="Acompanhe"
                            abaixo="Meus pedidos"
                        />
                    </span>
                )

            case "conta":
                /* A conta é desta loja. Visitante lê o convite inteiro
                   ("entre ou cadastre-se"), que é o que faz alguém criar
                   conta; quem já tem lê o próprio nome e um caminho para a
                   área dele. */
                return conta ? (
                    <div className={`${aparicao} items-center gap-1 md:gap-1.5`}>
                        <Link
                            href={caminhoDaLoja(loja.slug, "conta")}
                            className="flex items-center gap-2.5 rounded-[var(--radius-md)] p-2 text-[var(--sobre-destaque)] transition-opacity hover:opacity-80 md:px-1 md:py-0"
                        >
                            <FiUser className="w-[1.3rem] shrink-0" aria-hidden />

                            <span className="hidden leading-tight md:block">
                                <span className="block max-w-[10rem] truncate text-[0.7rem] opacity-75">
                                    Olá, {conta.nome.split(" ")[0]}
                                </span>
                                <span className="block text-[0.82rem] font-semibold">
                                    {t("topo.conta", "Minha conta")}
                                </span>
                            </span>
                        </Link>

                        {/* Sair virou ícone. Escrito e sublinhado ao lado de
                            "Minha conta", ele competia em peso com o próprio
                            nome da pessoa — e sair é a ação que menos se usa
                            da barra inteira. */}
                        <button
                            type="button"
                            onClick={sair}
                            aria-label="Sair da conta"
                            title="Sair"
                            className="hidden rounded-[var(--radius-md)] p-2 text-[var(--sobre-destaque)] opacity-70 transition-opacity hover:opacity-100 md:block"
                        >
                            <FiLogOut className="w-[1.05rem]" aria-hidden />
                        </button>
                    </div>
                ) : (
                    <span className={aparicao}>
                        <AcaoTopo
                            href={caminhoDaLoja(loja.slug, "conta")}
                            icone={<FiUser className="w-[1.3rem]" aria-hidden />}
                            acima="Entre ou"
                            abaixo="cadastre-se"
                        />
                    </span>
                )

            case "sacola":
                /* A sacola ganhou fundo próprio: é a ação que a pessoa
                   procura no meio da compra, e mais um ícone branco em cima
                   de azul, ao lado de outros dois, não se acha de relance. */
                return (
                    <button
                        type="button"
                        onClick={abrir}
                        aria-label="Abrir carrinho"
                        className={`${aparicao} items-center gap-2.5 rounded-[var(--radius-md)] p-2 text-[var(--sobre-destaque)] transition-colors hover:bg-[color-mix(in_srgb,var(--sobre-destaque)_16%,transparent)] md:bg-[color-mix(in_srgb,var(--sobre-destaque)_12%,transparent)] md:px-3 md:py-2`}
                    >
                        {/* O contador precisa de folga à direita: colado no
                            ícone ele encostava na palavra "Sacola" e os três
                            viravam um borrão. */}
                        <span className={`relative shrink-0 ${totalItens > 0 ? "mr-1.5" : ""}`}>
                            <FiShoppingBag className="w-[1.3rem]" aria-hidden />

                            {totalItens > 0 ? (
                                <span className="num absolute -right-2.5 -top-2 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full border border-[var(--destaque)] bg-[var(--coral)] px-1 text-[0.62rem] font-bold text-white">
                                    {totalItens > 99 ? "99+" : totalItens}
                                </span>
                            ) : null}
                        </span>

                        <span className="hidden text-left leading-tight md:block">
                            <span className="num block text-[0.7rem] opacity-75">
                                {totalItens} {totalItens === 1 ? "item" : "itens"}
                            </span>
                            <span className="block text-[0.82rem] font-semibold">
                                Sacola
                            </span>
                        </span>
                    </button>
                )

            case "selo":
                return (
                    <span className={`${aparicao} items-center gap-1.5 whitespace-nowrap`}>
                        <IconeDaPeca chave={peca.icone} />
                        {peca.texto}
                    </span>
                )

            case "texto":
                return <span className={`${aparicao} items-center whitespace-nowrap`}>{peca.texto}</span>

            case "link": {
                // O endereço vem do editor de moldura do painel e termina num
                // `href`: passa por linkSeguro, senão "javascript:..." aqui
                // executaria no clique de quem está comprando. Sem endereço
                // utilizável a peça não é desenhada.
                const destino = linkSeguro(peca.link)

                return destino ? (
                    <Link
                        href={destino}
                        className={`${aparicao} items-center gap-1.5 whitespace-nowrap transition-opacity hover:opacity-80`}
                    >
                        <IconeDaPeca chave={peca.icone} />
                        {peca.texto || destino}
                    </Link>
                ) : null
            }

            case "cnpj":
                return loja.cnpj ? (
                    <span className={`num ${aparicao} whitespace-nowrap opacity-80`}>
                        CNPJ {loja.cnpj}
                    </span>
                ) : null

            case "filiais":
                return <span className={aparicao}><Filiais /></span>

            case "departamentos":
                /* Uma régua de categorias resolve enquanto são quatro; com
                   dez ela vira uma tira que rola para o lado, e o que está no
                   fim ninguém acha. O botão fixo dá um lugar só onde está
                   TUDO — que é o papel dele nas lojas grandes.

                   Some no celular: lá a lista inteira vive na gaveta, e dois
                   botões abrindo a mesma lista é uma escolha a mais para quem
                   tem menos tela. */
                return categorias && categorias.length > 0 && aoEscolherCategoria ? (
                    <div className="relative hidden shrink-0 sm:block">
                        <button
                            type="button"
                            onClick={() => setMenuAberto((aberto) => !aberto)}
                            aria-expanded={menuAberto}
                            aria-controls="painel-departamentos"
                            /* O rótulo escrito some no celular por falta de
                               largura, mas o botão não pode ficar mudo para
                               quem usa leitor de tela — daí o aria-label. */
                            aria-label={t("topo.departamentos", "Departamentos")}
                            className="flex h-full items-center gap-2 bg-[var(--destaque)] px-3.5 text-[0.85rem] font-bold tracking-[0.01em] text-[var(--sobre-destaque)] transition-opacity hover:opacity-90 sm:px-5"
                        >
                            <FiGrid className="w-[1.05rem] shrink-0" aria-hidden />

                            <span className="hidden sm:inline">{t("topo.departamentos", "Departamentos")}</span>

                            <FiChevronDown
                                className={`w-4 shrink-0 transition-transform duration-200 ${
                                    menuAberto ? "rotate-180" : ""
                                }`}
                                aria-hidden
                            />
                        </button>
                    </div>
                ) : null

            default:
                return null
        }
    }

    /* Uma área de uma faixa: esquerda, centro ou direita.

       O fio entre as peças é da faixa de serviço e só dela: ali as garantias
       andam JUNTAS e o fio é o que as faz ler como uma lista, em vez de três
       frases soltas caídas no topo. */
    function Area({ pecas, comFio, comDivisor, className }: {
        pecas?: PecaDaMoldura[]
        comFio?: boolean

        /* O fio alto da barra da marca, entre dois atalhos escritos.
           Não entra antes da sacola: ela tem fundo próprio, e um fio colado
           num bloco com fundo lê como falha de desenho, não como separação. */
        comDivisor?: boolean

        className: string
    }) {

        if (!pecas || pecas.length === 0) return null

        return (
            <div className={className}>
                {pecas.map((peca, i) => (
                    <Fragment key={peca.id || `${peca.tipo}-${i}`}>
                        {comFio && i > 0 ? <Fio /> : null}

                        {comDivisor && i > 0 && ESCRITAS.has(peca.tipo) && ESCRITAS.has(pecas[i - 1].tipo)
                            ? <Divisor />
                            : null}

                        <Peca peca={peca} />
                    </Fragment>
                ))}
            </div>
        )
    }

    return (

        <header
            className={`sticky top-0 z-30 transition-shadow duration-200 ${
                rolado ? "shadow-[0_6px_20px_rgba(0,0,0,0.13)]" : ""
            }`}
        >

            {faixas.map((faixa) => {

                if (!faixa.ligada) return null

                /* FAIXA DE SERVIÇO
                   Fina, discreta e — o que importa — verdadeira. É o primeiro
                   lugar onde o visitante decide se está numa loja ou numa
                   página improvisada.

                   Some no celular: numa tela estreita ela roubaria a linha do
                   logo e da busca, que são o que a pessoa veio usar. */
                if (faixa.tipo === "servico") {
                    return (
                        <div
                            key={faixa.id}
                            className={`hidden border-b border-[color-mix(in_srgb,var(--sobre-destaque)_18%,transparent)] sm:block ${fundoDaFaixa(faixa.fundo)}`}
                        >
                            <div className="largura flex items-center justify-between gap-6 py-1.5 text-[0.72rem] tracking-[0.01em] text-[color-mix(in_srgb,var(--sobre-destaque)_82%,transparent)]">

                                <Area
                                    pecas={faixa.esquerda}
                                    comFio
                                    className="flex items-center gap-3 lg:gap-4"
                                />

                                <Area pecas={faixa.centro} comFio className="flex items-center gap-3" />
                                <Area pecas={faixa.direita} comFio className="flex items-center gap-3" />

                            </div>
                        </div>
                    )
                }

                /* BARRA DA MARCA
                   No celular vira duas linhas: marca e ícones em cima, busca
                   ocupando a largura inteira embaixo. É o arranjo que dá ao
                   campo de busca o tamanho que ele precisa ter numa tela de
                   360px sem espremer a marca nem os atalhos. */
                if (faixa.tipo === "marca") {
                    return (
                        <div key={faixa.id} className={fundoDaFaixa(faixa.fundo)}>
                            <div className="largura flex flex-wrap items-center gap-x-3 gap-y-2.5 py-2.5 sm:gap-x-6 sm:gap-y-3 sm:py-3.5">

                                {/* O botão de três traços fica fora da moldura:
                                    ele não é decoração do topo, é a única
                                    entrada do menu no celular. Deixá-lo
                                    arrastável seria deixar o lojista trancar a
                                    navegação da própria loja sem perceber. */}
                                <button
                                    type="button"
                                    onClick={() => { setMenuAberto(false); setGavetaAberta(true) }}
                                    aria-label="Abrir menu"
                                    aria-expanded={gavetaAberta}
                                    aria-controls="menu-mobile"
                                    className="-ml-2 shrink-0 p-2 text-[var(--sobre-destaque)] transition-opacity hover:opacity-80 md:hidden"
                                >
                                    <FiMenu className="w-[1.4rem]" aria-hidden />
                                </button>

                                <Area pecas={faixa.esquerda} className="flex min-w-0 shrink items-center gap-3 sm:shrink-0" />

                                {/* `contents` em vez de uma caixa: assim as peças
                                    do centro continuam sendo filhas diretas da
                                    barra, e o `flex-1` da busca cresce contra a
                                    barra inteira — dentro de uma caixa ele
                                    cresceria contra a caixa, e os atalhos da
                                    direita seriam empurrados para o fim da
                                    linha. */}
                                <Area pecas={faixa.centro} className="contents" />

                                <Area
                                    pecas={faixa.direita}
                                    comDivisor
                                    className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-4 lg:gap-5"
                                />

                            </div>
                        </div>
                    )
                }

                /* RÉGUA DE DEPARTAMENTOS */
                return (
                    <nav
                        key={faixa.id}
                        aria-label="Categorias"
                        className="relative border-b border-[var(--linha)] bg-[var(--fundo)] shadow-[var(--sombra-1)]"
                    >

                        <div className="largura flex items-stretch gap-1 sm:gap-3">

                            <Area pecas={faixa.esquerda} className="flex items-stretch gap-1 sm:gap-3" />

                            <div className="trilho flex flex-1 items-stretch gap-0.5 sm:gap-1">

                                {categorias && aoEscolherCategoria ? (
                                    <>
                                        <ItemNav
                                            rotulo="Todos"
                                            ativo={categoriaAtiva === null}
                                            aoClicar={() => aoEscolherCategoria(null)}
                                        />

                                        {categorias.map((categoria) => (
                                            <ItemNav
                                                key={categoria}
                                                rotulo={categoria}
                                                ativo={categoriaAtiva === categoria}
                                                aoClicar={() => aoEscolherCategoria(categoria)}
                                            />
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            href={inicio}
                                            className="flex shrink-0 items-center border-b-2 border-transparent px-3 py-3 text-[0.85rem] font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--placa)] hover:text-[var(--destaque)] sm:py-2.5 sm:text-[0.88rem]"
                                        >
                                            Todos os produtos
                                        </Link>

                                        <Link
                                            href={caminhoDaLoja(loja.slug, "acompanhar")}
                                            className="flex shrink-0 items-center border-b-2 border-transparent px-3 py-3 text-[0.85rem] font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--placa)] hover:text-[var(--destaque)] sm:py-2.5 sm:text-[0.88rem]"
                                        >
                                            Acompanhar pedido
                                        </Link>
                                    </>
                                )}

                            </div>

                            <Area pecas={faixa.direita} className="flex items-center gap-3" />

                        </div>

                        {/* O painel. Some ao escolher, ao clicar fora e no Esc —
                            as três saídas que a pessoa tenta, nessa ordem. */}
                        {menuAberto && categorias && aoEscolherCategoria ? (
                            <>
                                <button
                                    type="button"
                                    aria-label="Fechar departamentos"
                                    onClick={() => setMenuAberto(false)}
                                    className="fixed inset-0 z-10 cursor-default bg-black/20"
                                />

                                <div
                                    id="painel-departamentos"
                                    /* Uma loja com trinta categorias faria o
                                        painel passar do fim da tela do celular, e
                                        o que sobrasse ficaria inalcançável — o
                                        teto de altura com rolagem própria é o que
                                        garante que dá para chegar na última. */
                                    className="absolute inset-x-0 top-full z-20 max-h-[70vh] overflow-y-auto overscroll-contain border-b border-[var(--linha)] bg-[var(--fundo)] shadow-lg"
                                >
                                    <div className="largura py-4 sm:py-5">
                                        <p className="rotulo mb-3 text-[var(--ink-2)]">{t("topo.todos_departamentos", "Todos os departamentos")}</p>

                                        <div className="grid grid-cols-1 gap-x-6 gap-y-0 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                                            <ItemPainel
                                                rotulo="Ver tudo"
                                                ativo={categoriaAtiva === null}
                                                aoClicar={() => { aoEscolherCategoria(null); setMenuAberto(false) }}
                                            />

                                            {categorias.map((categoria) => (
                                                <ItemPainel
                                                    key={categoria}
                                                    rotulo={categoria}
                                                    ativo={categoriaAtiva === categoria}
                                                    aoClicar={() => { aoEscolherCategoria(categoria); setMenuAberto(false) }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}

                    </nav>
                )
            })}

            <MenuMobile
                aberto={gavetaAberta}
                aoFechar={() => setGavetaAberta(false)}
                categorias={categorias}
                categoriaAtiva={categoriaAtiva}
                aoEscolherCategoria={aoEscolherCategoria}
            />

        </header>

    )
}

/** As peças da barra da marca que são atalho escrito, e por isso levam fio. */
const ESCRITAS = new Set(["pedidos", "conta", "link", "texto"])

/**
 * O fundo de uma faixa, na opção que o lojista escolheu.
 *
 * Lista fechada e traduzida aqui, e não uma classe vinda do painel: cor
 * arbitrária chegando do editor seria CSS de terceiro dentro da página do
 * comprador, que é o que o modelo de peças existe para impedir.
 */
function fundoDaFaixa(fundo?: string): string {

    if (fundo === "claro") return "bg-[var(--fundo)] text-[var(--ink)]"
    if (fundo === "escuro") return "bg-[var(--ink)] text-[var(--fundo)]"

    return "bg-[var(--destaque)]"
}

/**
 * O ícone de uma peça, pela CHAVE que o painel mandou.
 *
 * Chave desconhecida não desenha nada, em vez de quebrar a linha: a peça
 * continua legível pelo texto dela.
 */
function IconeDaPeca({ chave }: { chave?: string }) {

    const Desenho = ICONES_DA_PECA[chave ?? ""]

    if (!Desenho) return null

    return <Desenho className="w-3 shrink-0" aria-hidden />
}

const ICONES_DA_PECA: Record<string, IconType> = {
    cadeado: FiLock,
    caixa: FiPackage,
    mapa: FiHome,
    caminhao: FiTruck,
    fone: FiHeadphones,
    cartao: FiCreditCard,
    troca: FiRefreshCw,
    relogio: FiClock,
    estrela: FiStar,
    presente: FiGift,
    escudo: FiShield,
    etiqueta: FiTag,
}

/**
 * O topo de fábrica, igual ao que o servidor manda quando a loja nunca mexeu
 * nele (ver CabecalhoPadrao em services/paginas/moldura.go).
 *
 * A cópia existe para um caso só: servidor mais velho que esta vitrine, no
 * meio de um deploy. Nesse minuto a loja aparece com o topo de sempre, em vez
 * de aparecer sem topo nenhum.
 */
const FAIXAS_DE_FABRICA: FaixaDoTopo[] = [
    {
        id: "servico", tipo: "servico", ligada: true, fundo: "destaque",
        esquerda: [
            { id: "selo-seguro", tipo: "selo", icone: "cadeado", texto: "Compra segura" },
            { id: "selo-pedido", tipo: "selo", icone: "caixa", texto: "Acompanhe seu pedido pela conta", aparicao: "so-desktop" },
            { id: "selo-estoque", tipo: "selo", icone: "mapa", texto: "Mesmo estoque da loja física" },
            { id: "filiais", tipo: "filiais", aparicao: "so-desktop" },
        ],
        direita: [{ id: "cnpj", tipo: "cnpj" }],
    },
    {
        id: "marca", tipo: "marca", ligada: true, fundo: "destaque",
        esquerda: [{ id: "marca", tipo: "marca", tamanho: "normal" }],
        centro: [{ id: "busca", tipo: "busca", tamanho: "grande" }],
        direita: [
            { id: "pedidos", tipo: "pedidos", aparicao: "so-desktop" },
            { id: "conta", tipo: "conta", aparicao: "so-desktop" },
            { id: "sacola", tipo: "sacola" },
        ],
    },
    {
        id: "navegacao", tipo: "navegacao", ligada: true, fundo: "claro",
        esquerda: [{ id: "departamentos", tipo: "departamentos" }],
    },
]

/**
 * Um atalho do canto direito da barra: ícone e, da largura média para cima,
 * duas linhas — a de cima diz o contexto, a de baixo nomeia o destino. É o
 * arranjo das lojas de departamento, e existe porque ícone sozinho obriga a
 * pessoa a adivinhar (ou a passar o mouse) para saber onde vai cair.
 */
function AcaoTopo({
    href,
    icone,
    acima,
    abaixo,
}: {
    href: string
    icone: React.ReactNode
    acima: string
    abaixo: string
}) {

    return (

        <Link
            href={href}
            className="flex items-center gap-2.5 text-[var(--sobre-destaque)] transition-opacity hover:opacity-80"
        >
            <span className="shrink-0">{icone}</span>

            <span className="hidden leading-tight md:block">
                <span className="block text-[0.7rem] opacity-75">{acima}</span>
                <span className="block text-[0.82rem] font-semibold">{abaixo}</span>
            </span>
        </Link>

    )
}

/** O ponto separador da faixa de garantias do topo. */
function Fio() {
    return (
        <span
            aria-hidden
            className="h-3 w-px bg-[color-mix(in_srgb,var(--sobre-destaque)_30%,transparent)]"
        />
    )
}

/** O fio vertical entre dois atalhos da barra. Só aparece onde há rótulo. */
function Divisor() {

    return (
        <span
            aria-hidden
            className="hidden h-8 w-px bg-[color-mix(in_srgb,var(--sobre-destaque)_22%,transparent)] md:block"
        />
    )
}

function ItemNav({
    rotulo,
    ativo,
    aoClicar,
}: {
    rotulo: string
    ativo: boolean
    aoClicar: () => void
}) {

    return (

        // A categoria aberta fica marcada por um fio grosso na cor da marca,
        // e não só por negrito: numa régua de dez departamentos, negrito
        // sozinho some entre os vizinhos. O fundo que acende no hover é o que
        // dá ao item o tamanho de um alvo — antes o clique valia só sobre as
        // letras.
        <button
            type="button"
            onClick={aoClicar}
            aria-current={ativo ? "true" : undefined}
            className={`flex shrink-0 items-center border-b-[3px] px-3 py-3 text-[0.85rem] font-semibold capitalize transition-colors sm:py-2.5 sm:text-[0.88rem] ${
                ativo
                    ? "border-[var(--destaque)] text-[var(--destaque)]"
                    : "border-transparent text-[var(--ink-2)] hover:bg-[var(--placa)] hover:text-[var(--destaque)]"
            }`}
        >
            {rotulo}
        </button>

    )
}

/** Uma categoria dentro do painel de departamentos. */
function ItemPainel({ rotulo, ativo, aoClicar }: {
    rotulo: string
    ativo: boolean
    aoClicar: () => void
}) {
    return (
        <button
            type="button"
            onClick={aoClicar}
            aria-current={ativo ? "true" : undefined}
            className={`flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-sm)] border-b border-[var(--linha-suave)] px-2 py-2 text-left text-[0.88rem] capitalize transition-colors ${
                ativo
                    ? "font-bold text-[var(--destaque)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--placa)] hover:text-[var(--destaque)]"
            }`}
        >
            <span className="truncate">{rotulo}</span>
            <FiChevronRight className="w-3.5 shrink-0 opacity-50" aria-hidden />
        </button>
    )
}
