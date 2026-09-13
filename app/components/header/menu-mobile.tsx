"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    FiChevronRight,
    FiGrid,
    FiHome,
    FiLock,
    FiLogOut,
    FiPackage,
    FiShoppingBag,
    FiX,
} from "react-icons/fi"
import { useCarrinho } from "@/app/cart/cart-context"
import { useLoja } from "@/app/loja/loja-context"
import { useConta } from "@/app/conta/conta-context"
import { caminhoDaLoja } from "@/lib/caminhos"
import { sairDaConta } from "./sair"

interface MenuMobileProps {
    aberto: boolean
    aoFechar: () => void
    categorias?: string[]
    categoriaAtiva?: string | null
    aoEscolherCategoria?: (categoria: string | null) => void
}

/**
 * A gaveta do celular.
 *
 * Numa tela de 360px não cabem os quatro atalhos da barra do computador com
 * seus dois rótulos cada: o que cabia eram ícones mudos espremidos com um
 * "sair" sublinhado no meio, e ninguém adivinha qual sacola, qual pessoinha,
 * qual caixinha. A gaveta troca isso por um lugar só, aberto pelo botão de
 * três traços, onde cada destino aparece escrito por extenso.
 *
 * A ordem aqui não é decorativa. Primeiro quem a pessoa é (o bloco da conta,
 * que é o que ela veio conferir), depois o que ela tem nesta loja (pedidos e
 * sacola), depois o catálogo, e por último o que raramente se usa — sair e a
 * faixa de garantias que no computador mora lá em cima.
 */
export default function MenuMobile({
    aberto,
    aoFechar,
    categorias,
    categoriaAtiva = null,
    aoEscolherCategoria,
}: MenuMobileProps) {

    const loja = useLoja()
    const conta = useConta()
    const { totalItens, abrir } = useCarrinho()
    const router = useRouter()

    // Esc fecha, como em qualquer painel sobreposto — e sem isso quem navega
    // por teclado fica preso atrás da cortina.
    useEffect(() => {
        if (!aberto) return

        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key === "Escape") aoFechar()
        }

        window.addEventListener("keydown", aoTeclar)
        return () => window.removeEventListener("keydown", aoTeclar)
    }, [aberto, aoFechar])

    // Com a gaveta aberta, o dedo que rola dentro dela chegava ao fim da
    // lista e continuava rolando a LOJA atrás. Trancar o body enquanto ela
    // vive resolve; o valor anterior volta ao fechar para não atropelar o
    // `overflow-x: clip` que a folha de estilo põe no body.
    useEffect(() => {
        if (!aberto) return

        const anterior = document.body.style.overflow
        document.body.style.overflow = "hidden"

        return () => {
            document.body.style.overflow = anterior
        }
    }, [aberto])

    if (!aberto) return null

    const inicio = caminhoDaLoja(loja.slug)

    async function sair() {
        aoFechar()
        await sairDaConta(loja.slug)
        router.refresh()
    }

    function escolher(categoria: string | null) {
        aoEscolherCategoria?.(categoria)
        aoFechar()
    }

    return (

        <div className="fixed inset-0 z-50 md:hidden">

            <button
                type="button"
                aria-label="Fechar menu"
                onClick={aoFechar}
                className="absolute inset-0 cursor-default bg-black/40"
            />

            {/* h-dvh e não h-full: no celular a barra de endereço aparece e
                some, e com altura em 100% o fim da gaveta — onde está o sair —
                ficava escondido atrás dela. */}
            <aside
                id="menu-mobile"
                className="gaveta-esq absolute left-0 top-0 flex h-dvh w-[min(20rem,86vw)] flex-col bg-[var(--fundo)] shadow-xl"
            >

                {/* CABEÇALHO DA GAVETA — a marca de novo, porque a cortina
                    cobre o topo e sem ela a gaveta não parece ser desta loja. */}
                <div className="flex shrink-0 items-center justify-between gap-3 bg-[var(--destaque)] px-4 py-3.5">

                    <span className="min-w-0 truncate text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-[var(--sobre-destaque)]">
                        {loja.nome}
                    </span>

                    <button
                        type="button"
                        onClick={aoFechar}
                        aria-label="Fechar menu"
                        className="-m-2 shrink-0 p-2 text-[var(--sobre-destaque)] transition-opacity hover:opacity-75"
                    >
                        <FiX className="w-5" aria-hidden />
                    </button>

                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">

                    {/* QUEM É A PESSOA
                        Logada, lê o próprio nome e o e-mail da conta — é assim
                        que ela confere que está na conta certa, que é metade do
                        motivo de abrir esse menu. Visitante lê o convite
                        inteiro, com botão de verdade: "entre" escrito pequeno
                        ao lado de um ícone não faz ninguém criar conta. */}
                    <div className="border-b border-[var(--linha)] bg-[var(--placa)] px-4 py-4">

                        {conta ? (
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[var(--destaque)] text-base font-bold text-[var(--sobre-destaque)]">
                                    {conta.nome.trim().charAt(0).toUpperCase() || "?"}
                                </span>

                                <span className="min-w-0 leading-tight">
                                    <span className="block truncate text-[0.95rem] font-semibold text-[var(--ink)]">
                                        Olá, {conta.nome.split(" ")[0]}
                                    </span>
                                    <span className="block truncate text-[0.78rem] text-[var(--ink-2)]">
                                        {conta.email}
                                    </span>
                                </span>
                            </div>
                        ) : (
                            <>
                                <p className="text-[0.95rem] font-semibold text-[var(--ink)]">
                                    Sua conta nesta loja
                                </p>
                                <p className="mt-1 text-[0.8rem] leading-snug text-[var(--ink-2)]">
                                    Entre para acompanhar seus pedidos sem código para decorar.
                                </p>

                                <Link
                                    href={caminhoDaLoja(loja.slug, "conta")}
                                    onClick={aoFechar}
                                    className="btn mt-3 inline-block"
                                >
                                    entrar ou criar conta
                                </Link>
                            </>
                        )}

                    </div>

                    {/* O QUE A PESSOA TEM AQUI */}
                    <nav aria-label="Minha conta" className="px-4 pt-3">

                        <p className="rotulo text-[var(--ink-3)]">Minha conta</p>

                        <ul className="mt-1">

                            <li>
                                <LinhaMenu
                                    href={caminhoDaLoja(loja.slug, "acompanhar")}
                                    aoClicar={aoFechar}
                                    icone={<FiPackage className="w-[1.15rem]" aria-hidden />}
                                    rotulo="Meus pedidos"
                                    apoio="Acompanhe o andamento"
                                />
                            </li>

                            <li>
                                <LinhaMenu
                                    aoClicar={() => { aoFechar(); abrir() }}
                                    icone={<FiShoppingBag className="w-[1.15rem]" aria-hidden />}
                                    rotulo="Sacola"
                                    apoio={`${totalItens} ${totalItens === 1 ? "item" : "itens"}`}
                                    contador={totalItens}
                                />
                            </li>

                            <li>
                                <LinhaMenu
                                    href={inicio}
                                    aoClicar={aoFechar}
                                    icone={<FiHome className="w-[1.15rem]" aria-hidden />}
                                    rotulo="Início"
                                    apoio="Voltar para a vitrine"
                                />
                            </li>

                        </ul>

                    </nav>

                    {/* O CATÁLOGO
                        Só existe onde a página sabe filtrar (a vitrine). Nas
                        outras, o caminho para o catálogo é o "Início" acima —
                        listar departamentos que não filtram nada seria uma
                        lista de botões mortos. */}
                    {categorias && categorias.length > 0 && aoEscolherCategoria ? (
                        <div className="mt-4 px-4">

                            <p className="rotulo flex items-center gap-1.5 text-[var(--ink-3)]">
                                <FiGrid className="w-3.5 shrink-0" aria-hidden />
                                Departamentos
                            </p>

                            <ul className="mt-1">

                                <li>
                                    <LinhaCategoria
                                        rotulo="Ver tudo"
                                        ativo={categoriaAtiva === null}
                                        aoClicar={() => escolher(null)}
                                    />
                                </li>

                                {categorias.map((categoria) => (
                                    <li key={categoria}>
                                        <LinhaCategoria
                                            rotulo={categoria}
                                            ativo={categoriaAtiva === categoria}
                                            aoClicar={() => escolher(categoria)}
                                        />
                                    </li>
                                ))}

                            </ul>

                        </div>
                    ) : null}

                    {conta ? (
                        <div className="mt-4 border-t border-[var(--linha)] px-4 pt-2">
                            <button
                                type="button"
                                onClick={sair}
                                className="flex min-h-12 w-full items-center gap-3 py-2 text-left text-[0.9rem] text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]"
                            >
                                <FiLogOut className="w-[1.15rem] shrink-0" aria-hidden />
                                Sair da conta
                            </button>
                        </div>
                    ) : null}

                    {/* A FAIXA DE CONFIANÇA
                        No computador ela mora no alto; no celular não cabia lá
                        e sumia inteira. Aqui embaixo ela volta — inclusive o
                        CNPJ, que é o sinal mais direto de que há empresa
                        registrada por trás da página. */}
                    <div className="mt-4 border-t border-[var(--linha)] bg-[var(--placa)] px-4 py-4 text-[0.76rem] leading-relaxed text-[var(--ink-2)]">

                        <p className="flex items-center gap-2">
                            <FiLock className="w-3.5 shrink-0" aria-hidden />
                            Compra segura
                        </p>

                        <p className="mt-1.5 flex items-center gap-2">
                            <FiHome className="w-3.5 shrink-0" aria-hidden />
                            Mesmo estoque da loja física
                        </p>

                        {loja.cnpj ? (
                            <p className="num mt-2 text-[0.72rem] text-[var(--ink-3)]">
                                CNPJ {loja.cnpj}
                            </p>
                        ) : null}

                    </div>

                </div>

            </aside>

        </div>

    )
}

/**
 * Uma linha da gaveta: ícone, o destino escrito e, embaixo, uma frase curta
 * dizendo o que se encontra lá. `min-h-12` não é enfeite — é o alvo mínimo
 * que um dedo acerta sem mirar.
 *
 * Vira link quando tem `href` e botão quando não tem (a sacola abre uma
 * gaveta, não navega): botão que parece link é o que quebra "abrir em nova
 * aba" e a navegação por teclado.
 */
function LinhaMenu({
    href,
    aoClicar,
    icone,
    rotulo,
    apoio,
    contador,
}: {
    href?: string
    aoClicar: () => void
    icone: React.ReactNode
    rotulo: string
    apoio: string
    contador?: number
}) {

    const conteudo = (
        <>
            <span className="relative shrink-0 text-[var(--ink)]">
                {icone}

                {contador && contador > 0 ? (
                    <span className="num absolute -right-2.5 -top-2 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[0.6rem] font-bold text-white">
                        {contador > 99 ? "99+" : contador}
                    </span>
                ) : null}
            </span>

            <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.9rem] font-semibold text-[var(--ink)]">
                    {rotulo}
                </span>
                <span className="block truncate text-[0.75rem] text-[var(--ink-3)]">
                    {apoio}
                </span>
            </span>

            <FiChevronRight className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
        </>
    )

    const classe = "flex min-h-12 w-full items-center gap-3.5 border-b border-[var(--linha-suave)] py-2.5 text-left transition-colors hover:bg-[var(--placa)]"

    if (href) {
        return (
            <Link href={href} onClick={aoClicar} className={classe}>
                {conteudo}
            </Link>
        )
    }

    return (
        <button type="button" onClick={aoClicar} className={classe}>
            {conteudo}
        </button>
    )
}

/** Uma categoria dentro da gaveta. */
function LinhaCategoria({
    rotulo,
    ativo,
    aoClicar,
}: {
    rotulo: string
    ativo: boolean
    aoClicar: () => void
}) {

    return (
        <button
            type="button"
            onClick={aoClicar}
            aria-current={ativo ? "true" : undefined}
            className={`flex min-h-12 w-full items-center justify-between gap-2 border-b border-[var(--linha-suave)] py-2 text-left text-[0.88rem] capitalize transition-colors ${
                ativo
                    ? "font-semibold text-[var(--destaque)]"
                    : "text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
        >
            <span className="truncate">{rotulo}</span>
            <FiChevronRight className="w-3.5 shrink-0 opacity-50" aria-hidden />
        </button>
    )
}
