"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { FiChevronLeft, FiChevronRight } from "react-icons/fi"
import type { Banner } from "@/app/type/type"
import { useLoja } from "@/app/loja/loja-context"
import { caminhoDaLoja } from "@/lib/caminhos"

function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function percentualDesconto(banner: Banner): number {
    if (!banner.valor_antigo || banner.valor_antigo <= banner.valor) return 0
    return Math.round((1 - banner.valor / banner.valor_antigo) * 100)
}

interface RespostaBanners {
    banners: Banner[]
}

const INTERVALO_AUTOPLAY_MS = 6000

/**
 * Vitrine de topo no formato da referência: palco claro sangrando de ponta a
 * ponta, chamada à esquerda, foto ao centro e o desconto em corpo enorme à
 * direita. Passa sozinho, mas para no hover e com "reduzir movimento".
 * O conteúdo é o banner que o lojista cadastra no painel.
 */
export default function BannerSlider() {

    const loja = useLoja()

    const [banners, setBanners] = useState<Banner[]>([])
    const [indice, setIndice] = useState(0)
    const [pausado, setPausado] = useState(false)
    const timer = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        fetch(`/api/banner?loja=${encodeURIComponent(loja.slug)}`, { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : { banners: [] }))
            .then((dados: RespostaBanners) => {
                setBanners(Array.isArray(dados.banners) ? dados.banners : [])
            })
            .catch(() => setBanners([]))
    }, [loja.slug])

    const total = banners.length

    const avancar = useCallback((passo: number) => {
        setIndice((atual) => (atual + passo + total) % total)
    }, [total])

    useEffect(() => {
        if (total <= 1 || pausado) return
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

        timer.current = setInterval(() => avancar(1), INTERVALO_AUTOPLAY_MS)

        return () => {
            if (timer.current) clearInterval(timer.current)
        }
    }, [avancar, pausado, total])

    // Sem banner cadastrado, a home caía do menu direto numa fileira miúda de
    // miniaturas — a página começava sem começar, e é isso que faz uma loja
    // parecer improvisada. Uma abertura desenhada dá topo à página mesmo antes
    // de o lojista subir a primeira arte.
    if (total === 0) return <Abertura />

    // O lojista pode apagar um banner enquanto a página está aberta: o resto
    // garante que o índice nunca aponte para um slide que não existe mais.
    const atual = indice % total
    const banner = banners[atual]
    const percentual = percentualDesconto(banner)

    // O lojista cadastra o link como caminho relativo ("/produto/108") ou
    // como endereço completo. O relativo é do site dele, então ganha o
    // prefixo da loja; o absoluto vai como está.
    const destino = banner.link.startsWith("/")
        ? caminhoDaLoja(loja.slug, banner.link)
        : banner.link

    const botao = banner.link ? (
        <Link href={destino} className="btn mt-4 w-full max-w-[15rem] py-3 md:w-auto md:px-10">
            aproveite
        </Link>
    ) : null

    return (

        <section
            aria-label="Destaques"
            className="relative bg-[var(--palco)]"
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
        >

            <div className="largura grid min-h-[17rem] grid-cols-1 items-center gap-3 py-7 sm:gap-4 md:min-h-[24rem] md:grid-cols-[1fr_1.1fr_0.9fr] md:py-0">

                <div className="order-2 md:order-none">
                    <p className="text-[1.6rem] font-light leading-[1.05] text-[var(--ink)] sm:text-[2rem] md:text-[2.6rem]">
                        <strong className="font-bold">{primeiraPalavra(banner.titulo)}</strong>
                        {restoDoTitulo(banner.titulo)}
                    </p>

                    {banner.descricao ? (
                        <p className="mt-2 max-w-xs text-[0.85rem] leading-relaxed text-[var(--ink-2)] sm:mt-3 sm:text-[0.9rem]">
                            {banner.descricao}
                        </p>
                    ) : null}
                </div>

                <div className="order-1 flex h-36 items-center justify-center sm:h-44 md:order-none md:h-[19rem]">
                    {banner.imagem_url ? (
                        <img
                            src={banner.imagem_url}
                            alt={banner.titulo}
                            className="h-full w-full object-contain"
                        />
                    ) : null}
                </div>

                <div className="order-3 md:order-none">
                    {percentual > 0 ? (
                        <>
                            <p className="text-sm text-[var(--ink-2)]">com até</p>

                            <p className="flex items-start text-[var(--ink)]">
                                <span className="num text-[2.75rem] font-bold leading-[0.85] tracking-tight sm:text-[3.5rem] md:text-[4.5rem]">
                                    {percentual}
                                </span>
                                <span className="mt-1 text-lg font-bold leading-none md:text-2xl">
                                    %<br />off
                                </span>
                            </p>

                            <p className="preco-antigo mt-2">{formatarMoeda(banner.valor_antigo)}</p>
                            <p className="num text-2xl font-bold text-[var(--ink)]">{formatarMoeda(banner.valor)}</p>
                        </>
                    ) : banner.valor > 0 ? (
                        <>
                            <p className="text-sm text-[var(--ink-2)]">a partir de</p>

                            <p className="num text-[2rem] font-bold leading-none text-[var(--ink)] sm:text-[2.5rem] md:text-[3.2rem]">
                                {formatarMoeda(banner.valor)}
                            </p>
                        </>
                    ) : null}

                    {botao}
                </div>

            </div>


            {/* CONTROLES

                Duas montagens, porque as duas telas pedem coisas diferentes.
                No desktop, as setas ficam nas laterais da faixa, onde há
                margem sobrando e o mouse já as procura. No celular não há
                margem nenhuma: seta flutuando no meio da faixa cai em cima do
                título, da foto ou do botão. Ali elas descem para uma régua
                própria embaixo, junto das bolinhas — que também viram alvo de
                24px, porque um ponto de 8px é ponto que o dedo erra. */}

            {total > 1 ? (
                <>
                    <button
                        type="button"
                        onClick={() => avancar(-1)}
                        aria-label="Destaque anterior"
                        className="absolute left-6 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow-sm transition-colors hover:bg-white md:flex"
                    >
                        <FiChevronLeft className="w-5" aria-hidden />
                    </button>

                    <button
                        type="button"
                        onClick={() => avancar(1)}
                        aria-label="Próximo destaque"
                        className="absolute right-6 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow-sm transition-colors hover:bg-white md:flex"
                    >
                        <FiChevronRight className="w-5" aria-hidden />
                    </button>

                    <div className="flex items-center justify-center gap-1 pb-4 md:absolute md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:pb-0">

                        <button
                            type="button"
                            onClick={() => avancar(-1)}
                            aria-label="Destaque anterior"
                            className="flex h-9 w-9 items-center justify-center text-[var(--ink-2)] md:hidden"
                        >
                            <FiChevronLeft className="w-5" aria-hidden />
                        </button>

                        {banners.map((item, posicao) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setIndice(posicao)}
                                aria-label={`Ir para o destaque ${posicao + 1}`}
                                aria-current={posicao === atual ? "true" : undefined}
                                className="flex h-8 w-6 items-center justify-center"
                            >
                                <span
                                    aria-hidden
                                    className={`h-2 w-2 rounded-full transition-colors ${
                                        posicao === atual ? "bg-[var(--destaque)]" : "bg-black/25"
                                    }`}
                                />
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => avancar(1)}
                            aria-label="Próximo destaque"
                            className="flex h-9 w-9 items-center justify-center text-[var(--ink-2)] md:hidden"
                        >
                            <FiChevronRight className="w-5" aria-hidden />
                        </button>

                    </div>
                </>
            ) : null}

        </section>

    )
}

function primeiraPalavra(texto: string): string {
    return texto.split(" ")[0]
}

function restoDoTitulo(texto: string): string {
    const resto = texto.split(" ").slice(1).join(" ")
    return resto ? ` ${resto}` : ""
}

/**
 * A abertura da loja quando ainda não há banner.
 *
 * Não inventa promessa nenhuma: diz o nome da loja e o que ela é. A força vem
 * do desenho — um bloco alto, na cor de destaque escolhida pelo lojista, com a
 * tipografia grande que uma vitrine de verdade tem no topo.
 */
function Abertura() {

    const loja = useLoja()

    return (
        <section className="relative overflow-hidden bg-[var(--destaque)]">

            {/* Duas manchas claras em diagonal. É o suficiente para o bloco não
                parecer um retângulo chapado, e não depende de imagem nenhuma —
                que é o ponto: precisa funcionar em loja que ainda não subiu
                arte alguma. */}
            <span
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rotate-12 bg-[color-mix(in_srgb,var(--sobre-destaque)_8%,transparent)]"
            />
            <span
                aria-hidden
                className="pointer-events-none absolute -bottom-32 right-40 h-72 w-72 rotate-12 bg-[color-mix(in_srgb,var(--sobre-destaque)_5%,transparent)]"
            />

            <div className="largura relative flex flex-col items-start gap-3 py-10 sm:gap-4 sm:py-14 md:py-20">

                <span className="rotulo text-[color-mix(in_srgb,var(--sobre-destaque)_70%,transparent)]">
                    Loja oficial
                </span>

                <h1 className="max-w-2xl text-[1.7rem] font-light leading-[1.15] text-[var(--sobre-destaque)] sm:text-[2rem] md:text-[2.75rem]">
                    {/* capitalize porque o lojista digita o nome como quiser
                        ("maria"), e um nome em caixa baixa num título de 44px
                        é o que separa uma loja de uma página de teste. */}
                    <strong className="font-bold capitalize">{loja.nome}</strong>
                    <span className="block text-[color-mix(in_srgb,var(--sobre-destaque)_82%,transparent)]">
                        o mesmo estoque da loja física, aqui.
                    </span>
                </h1>

                <p className="max-w-md text-[0.9rem] leading-relaxed text-[color-mix(in_srgb,var(--sobre-destaque)_72%,transparent)]">
                    Você compra o que existe na prateleira: cada peça anunciada está
                    separada e reservada assim que o pedido é feito.
                </p>

                <a href="#grade" className="btn-claro btn mt-2">
                    ver produtos
                </a>

            </div>
        </section>
    )
}
