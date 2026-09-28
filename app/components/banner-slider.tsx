"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { FiChevronLeft, FiChevronRight } from "react-icons/fi"
import type { Banner } from "@/app/type/type"
import { useLoja } from "@/app/loja/loja-context"
import { caminhoDaLoja } from "@/lib/caminhos"
import { linkSeguro } from "@/lib/link"

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
 * Vitrine de topo no formato de cartão do iFood: contida na largura da
 * página, cantos arredondados, setas discretas que só aparecem no hover e
 * bolinhas em pílula sobrepostas na base da arte. Passa sozinho, mas para no
 * hover e com "reduzir movimento". O conteúdo é o banner que o lojista
 * cadastra no painel.
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
    //
    // Passa por linkSeguro antes de qualquer coisa: o endereço vem do painel e
    // acaba num `href`, e `href="javascript:..."` executa no clique de quem
    // está comprando. O que não é caminho interno nem http(s) vira vazio, e
    // aí o botão simplesmente não aparece — um banner sem botão é melhor do
    // que um botão que faz outra coisa.
    const link = linkSeguro(banner.link)

    const destino = link.startsWith("/")
        ? caminhoDaLoja(loja.slug, link)
        : link

    const botao = link ? (
        <Link href={destino} className="btn mt-1 w-full max-w-[15rem] py-3 md:w-auto md:px-10">
            aproveite
        </Link>
    ) : null

    /* Quem escolhe entre os dois formatos é o lojista, e agora ele escolhe
       DECLARANDO: há dois botões na tela de banners do painel, e o que ele
       marca vem aqui no campo `formato`.
    
       A leitura anterior era por dedução — "não escreveu nada, então quer só
       a arte" —, e dedução obriga o lojista a descobrir sozinho que apagar o
       título muda o desenho da página. Ninguém descobre.
    
       O `||` que sobrou é a rede para o banner gravado antes da coluna
       existir: sem formato e sem texto nenhum, ele só pode ser arte. E sem
       imagem não há formato de arte possível — aí o texto ocupa a faixa
       sozinho, tenha o lojista marcado o que tiver. */
    const semTexto =
        Boolean(banner.imagem_url) &&
        (banner.formato === "imagem" ||
            (!banner.formato &&
                !banner.titulo.trim() &&
                !banner.descricao.trim() &&
                banner.valor <= 0))

    return (

        <section aria-label="Destaques" className="largura py-3 sm:py-4">

            {/* Estilo cartão: cantos arredondados, largura contida (a mesma
                margem da página) e sombra rasa — a moldura que o iFood dá aos
                banners de topo, em vez de uma faixa colorida sangrando de
                ponta a ponta. */}
            <div
                className="group relative overflow-hidden rounded-2xl shadow-sm sm:rounded-3xl"
                onMouseEnter={() => setPausado(true)}
                onMouseLeave={() => setPausado(false)}
            >

                {/* DOIS BANNERS NUM, e quem escolhe é o lojista — pelo que ele
                    preenche, sem caixinha de opção nenhuma.

                    SÓ IMAGEM: banner sem título, sem descrição e sem preço vira a
                    arte inteira. É o que um banner de campanha é: uma peça
                    fechada, já desenhada por quem fez a arte. Era justamente
                    isso que o formato anterior estragava — ele espremia a arte
                    numa coluna do meio e cercava de tipografia nossa dos dois
                    lados, e o resultado ficava feio mesmo com uma arte boa.

                    COM TEXTO: a arte ocupa metade e o texto mora na outra metade,
                    em painel próprio. Divisão, e não sobreposição: a foto vem do
                    lojista e pode ser clara, escura ou cheia de detalhe no meio —
                    texto por cima precisaria de um véu escurecendo justamente o
                    produto que a arte quer mostrar. Ao lado, o texto é legível
                    sobre qualquer arte, sem véu nenhum.

                    No celular as duas viram uma coluna: arte em cima, texto
                    embaixo. */}

                {semTexto ? (

                    <Link
                        href={destino || "#"}
                        aria-label={banner.titulo || "Destaque"}
                        /* Sem link cadastrado o banner não deve virar um clique
                           que não leva a lugar nenhum: aí ele é só a arte. */
                        className={`block ${link ? "" : "pointer-events-none"}`}
                    >
                        <img
                            src={banner.imagem_url}
                            alt={banner.titulo || ""}
                            className="aspect-[16/10] w-full object-cover sm:aspect-[21/8] md:aspect-[3/1]"
                        />
                    </Link>

                ) : (

                    <div className="grid grid-cols-1 items-stretch bg-[var(--palco)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">

                        {/* A arte. `object-cover` e altura cheia: a metade dela é
                            uma janela, e janela com barra branca em cima e embaixo
                            é o que denuncia imagem encaixada à força. */}
                        <div className="order-1 md:order-2">
                            {banner.imagem_url ? (
                                <img
                                    src={banner.imagem_url}
                                    alt={banner.titulo}
                                    className="h-full max-h-[20rem] w-full object-cover"
                                />
                            ) : null}
                        </div>

                        <div className="order-2 flex flex-col justify-center gap-3 px-5 py-7 sm:px-8 sm:py-9 md:order-1 md:py-12">

                            {percentual > 0 ? (
                                <span className="selo-etiqueta self-start text-[0.85rem]">
                                    {percentual}% OFF
                                </span>
                            ) : null}

                            {banner.titulo ? (
                                <p className="font-[family-name:var(--font-display)] text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--ink)] sm:text-[2.1rem] md:text-[2.5rem]">
                                    {banner.titulo}
                                </p>
                            ) : null}

                            {banner.descricao ? (
                                <p className="max-w-md text-[0.9rem] leading-relaxed text-[var(--ink-2)]">
                                    {banner.descricao}
                                </p>
                            ) : null}

                            {banner.valor > 0 ? (
                                <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                                    {percentual > 0 ? (
                                        <span className="preco-antigo">{formatarMoeda(banner.valor_antigo)}</span>
                                    ) : (
                                        <span className="text-sm text-[var(--ink-2)]">a partir de</span>
                                    )}

                                    <span className="preco-grande">{formatarMoeda(banner.valor)}</span>
                                </p>
                            ) : null}

                            {botao}
                        </div>

                    </div>
                )}

                {/* CONTROLES

                    Setas circulares discretas nas laterais, escondidas até o
                    mouse passar por cima — o padrão do carrossel do iFood.
                    No celular, sem espaço para lateral nenhuma, elas somem e
                    sobra só a régua de bolinhas, que aqui vira pílulas
                    sobrepostas na base da arte em vez de uma linha embaixo do
                    cartão. */}

                {total > 1 ? (
                    <>
                        <button
                            type="button"
                            onClick={() => avancar(-1)}
                            aria-label="Destaque anterior"
                            className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 md:flex"
                        >
                            <FiChevronLeft className="w-5" aria-hidden />
                        </button>

                        <button
                            type="button"
                            onClick={() => avancar(1)}
                            aria-label="Próximo destaque"
                            className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 md:flex"
                        >
                            <FiChevronRight className="w-5" aria-hidden />
                        </button>

                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 to-transparent"
                        />

                        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                            {banners.map((item, posicao) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setIndice(posicao)}
                                    aria-label={`Ir para o destaque ${posicao + 1}`}
                                    aria-current={posicao === atual ? "true" : undefined}
                                    className="flex h-5 w-6 items-center justify-center"
                                >
                                    <span
                                        aria-hidden
                                        className={`h-1.5 rounded-full transition-all ${
                                            posicao === atual ? "w-5 bg-white" : "w-1.5 bg-white/60"
                                        }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </>
                ) : null}

            </div>

        </section>

    )
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
                    Você compra o que existe na prateleira: cada produto anunciado é
                    separado e reservado assim que o pedido é feito.
                </p>

                <a href="#grade" className="btn-claro btn mt-2">
                    ver produtos
                </a>

            </div>
        </section>
    )
}
