"use client"

import { useEffect, useState } from "react"
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
} from "react-icons/fi"
import { useCarrinho } from "@/app/cart/cart-context"
import { useLoja, useTexto } from "@/app/loja/loja-context"
import { useConta } from "@/app/conta/conta-context"
import { caminhoDaLoja } from "@/lib/caminhos"
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

    return (

        <header
            className={`sticky top-0 z-30 transition-shadow duration-200 ${
                rolado ? "shadow-[0_6px_20px_rgba(0,0,0,0.13)]" : ""
            }`}
        >

            {/* FAIXA DE CONFIANÇA
                Fina, discreta e — o que importa — verdadeira. É o primeiro
                lugar onde o visitante decide se está numa loja ou numa página
                improvisada, e por isso não leva promessa que a loja não fez:
                nada de frete grátis ou prazo de troca inventado. Só o que este
                sistema de fato garante, mais o CNPJ de quem vende.

                Some no celular: numa tela estreita ela roubaria a linha do
                logo e da busca, que são o que a pessoa veio usar. */}
            <div className="hidden border-b border-[color-mix(in_srgb,var(--sobre-destaque)_18%,transparent)] bg-[var(--destaque)] sm:block">
                {/* As garantias andam JUNTAS à esquerda, com um fio entre
                    elas, e o CNPJ vai para a direita. Espalhadas por 1300px de
                    barra elas pareciam três frases soltas caídas no topo — a
                    proximidade é o que as faz ler como uma lista de garantias
                    da loja. */}
                <div className="largura flex items-center justify-between gap-6 py-1.5 text-[0.72rem] tracking-[0.01em] text-[color-mix(in_srgb,var(--sobre-destaque)_82%,transparent)]">

                    <div className="flex items-center gap-3 lg:gap-4">

                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <FiLock className="w-3 shrink-0" aria-hidden />
                            Compra segura
                        </span>

                        <Fio />

                        <span className="hidden items-center gap-1.5 whitespace-nowrap md:flex">
                            <FiPackage className="w-3 shrink-0" aria-hidden />
                            Acompanhe seu pedido pela conta
                        </span>

                        <span className="hidden md:block"><Fio /></span>

                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <FiHome className="w-3 shrink-0" aria-hidden />
                            Mesmo estoque da loja física
                        </span>

                        {/* A troca de unidade fica na faixa de serviço, junto
                            das garantias da loja, e não perto da sacola: é uma
                            decisão que se toma ao CHEGAR, antes de escolher o
                            que comprar. Some sozinha na rede de uma loja só. */}
                        <span className="hidden md:block"><Fio /></span>

                        <span className="hidden md:block"><Filiais /></span>

                    </div>

                    {loja.cnpj ? (
                        <span className="num hidden whitespace-nowrap opacity-80 lg:inline">
                            CNPJ {loja.cnpj}
                        </span>
                    ) : null}

                </div>
            </div>

            {/* BARRA DA MARCA */}

            <div className="bg-[var(--destaque)]">

                {/* No celular vira duas linhas: marca e ícones em cima, busca
                    ocupando a largura inteira embaixo. É o arranjo que dá ao
                    campo de busca o tamanho que ele precisa ter numa tela de
                    360px sem espremer a marca nem os atalhos. */}
                <div className="largura flex flex-wrap items-center gap-x-3 gap-y-2.5 py-2.5 sm:gap-x-6 sm:gap-y-3 sm:py-3.5">

                    {/* O botão de três traços. Só no celular: da largura média
                        para cima os atalhos cabem escritos na própria barra, e
                        esconder atrás de um botão o que já está visível é
                        trabalho a mais para quem navega. */}
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

                    <Link
                        href={inicio}
                        aria-label={`${loja.nome} — página inicial`}
                        className="flex min-w-0 shrink items-center gap-2 transition-opacity hover:opacity-90 sm:shrink-0 sm:gap-2.5"
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
                                className="h-8 w-auto max-w-[9rem] object-contain sm:h-10 sm:max-w-[12rem]"
                            />
                        ) : (
                            <>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--sobre-destaque)] text-base font-bold text-[var(--destaque)] sm:h-10 sm:w-10 sm:text-lg">
                                    {loja.nome.trim().charAt(0).toUpperCase() || "M"}
                                </span>

                                {/* O espacejamento largo é a assinatura da
                                    marca, mas em tela estreita ele come a
                                    linha inteira: no celular fica apertado o
                                    bastante para o nome caber sem reticências
                                    e volta ao normal a partir de `sm`. */}
                                <span className="min-w-0 truncate text-[0.85rem] font-semibold uppercase tracking-[0.12em] text-[var(--sobre-destaque)] sm:max-w-[16rem] sm:text-[0.95rem] sm:tracking-[0.28em]">
                                    {loja.nome}
                                </span>
                            </>
                        )}
                    </Link>

                    {buscaControlada ? (
                        <div className="relative order-3 w-full min-w-0 flex-1 md:order-none md:w-auto md:max-w-[36rem]">
                            {campoBusca}
                        </div>
                    ) : (
                        <form
                            action={inicio}
                            className="relative order-3 w-full min-w-0 flex-1 md:order-none md:w-auto md:max-w-[36rem]"
                        >
                            {campoBusca}
                        </form>
                    )}

                    <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-4 lg:gap-5">

                        {/* Pedidos, conta e sair só existem escritos, e escritos
                            eles não cabem numa tela estreita. No celular quem
                            responde por eles é a gaveta; aqui na barra fica só a
                            sacola, que é o atalho que se usa no meio da compra. */}
                        <div className="hidden items-center gap-4 md:flex lg:gap-5">

                            <AcaoTopo
                                href={caminhoDaLoja(loja.slug, "acompanhar")}
                                icone={<FiPackage className="w-[1.3rem]" aria-hidden />}
                                acima="Acompanhe"
                                abaixo="Meus pedidos"
                            />

                            <Divisor />

                            {/* A conta é desta loja. Visitante lê o convite inteiro
                                ("entre ou cadastre-se"), que é o que faz alguém
                                criar conta; quem já tem lê o próprio nome e um
                                caminho para a área dele. */}
                            {conta ? (
                                <div className="flex items-center gap-1 md:gap-1.5">
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

                                    {/* Sair virou ícone. Escrito e sublinhado ao
                                        lado de "Minha conta", ele competia em
                                        peso com o próprio nome da pessoa — e
                                        sair é a ação que menos se usa da barra
                                        inteira. */}
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
                                <AcaoTopo
                                    href={caminhoDaLoja(loja.slug, "conta")}
                                    icone={<FiUser className="w-[1.3rem]" aria-hidden />}
                                    acima="Entre ou"
                                    abaixo="cadastre-se"
                                />
                            )}

                        </div>

                        {/* A sacola ganhou fundo próprio: é a ação que a
                            pessoa procura no meio da compra, e mais um ícone
                            branco em cima de azul, ao lado de outros dois, não
                            se acha de relance. */}
                        <button
                            type="button"
                            onClick={abrir}
                            aria-label="Abrir carrinho"
                            className="flex items-center gap-2.5 rounded-[var(--radius-md)] p-2 text-[var(--sobre-destaque)] transition-colors hover:bg-[color-mix(in_srgb,var(--sobre-destaque)_16%,transparent)] md:bg-[color-mix(in_srgb,var(--sobre-destaque)_12%,transparent)] md:px-3 md:py-2"
                        >
                            {/* O contador precisa de folga à direita: colado
                                no ícone ele encostava na palavra "Sacola" e os
                                três viravam um borrão. mr-1.5 reserva o espaço
                                que ele ocupa quando aparece. */}
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

                    </div>

                </div>

            </div>


            {/* RÉGUA DE DEPARTAMENTOS */}

            <nav
                aria-label="Categorias"
                className="relative border-b border-[var(--linha)] bg-[var(--fundo)] shadow-[var(--sombra-1)]"
            >

                <div className="largura flex items-stretch gap-1 sm:gap-3">

                    {/* O botão de departamentos.
                        Uma régua de categorias resolve enquanto são quatro;
                        com dez ela vira uma tira que rola para o lado, e o que
                        está no fim ninguém acha. O botão fixo dá um lugar só
                        onde está TUDO — que é o papel dele nas lojas grandes. */}
                    {/* Some no celular: lá a lista inteira de departamentos
                        vive na gaveta, e dois botões abrindo a mesma lista é
                        uma escolha a mais para quem tem menos tela. */}
                    {categorias && categorias.length > 0 && aoEscolherCategoria ? (
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
                    ) : null}

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

                </div>

                {/* O painel. Some ao escolher, ao clicar fora e no Esc — as
                    três saídas que a pessoa tenta, nessa ordem. */}
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
                            /* Uma loja com trinta categorias faria o painel
                                passar do fim da tela do celular, e o que
                                sobrasse ficaria inalcançável — o teto de altura
                                com rolagem própria é o que garante que dá para
                                chegar na última. */
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
