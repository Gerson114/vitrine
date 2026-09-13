import Link from "next/link"
import type { Bloco } from "@/app/loja/loja-context"

/**
 * Os blocos editoriais da home — os que o lojista escreve, e não os que
 * mostram produto.
 *
 * Cada um recebe DADO e desenha com marcação nossa. Nada aqui usa
 * `dangerouslySetInnerHTML`, e é o ponto inteiro do editor: o lojista escolhe
 * o texto, o alinhamento e o tom; a marcação é a mesma para todo mundo,
 * revisada uma vez. Um texto com `<script>` dentro aparece na tela como o
 * texto literal `<script>`, que é exatamente o que se quer.
 *
 * Os endereços de link e de imagem já vêm conferidos do servidor (ver
 * services/paginas: só caminho interno ou http(s) de verdade, nunca
 * "javascript:"). A conferência é repetida aqui mesmo assim — é barata, e
 * um dia esta função pode ser chamada de outro lugar.
 */

/** Aceita só caminho interno ou http(s). Devolve vazio no resto. */
function linkSeguro(bruto?: string): string {

    const link = (bruto ?? "").trim()

    if (!link) return ""

    // "//outro-site.com" o navegador lê como domínio externo, não como
    // caminho — daí a segunda condição.
    if (link.startsWith("/") && !link.startsWith("//")) return link

    return /^https?:\/\//i.test(link) ? link : ""
}

/** Um bloco de texto da loja: título e parágrafo. */
export function BlocoTexto({ bloco }: { bloco: Bloco }) {

    if (!bloco.titulo && !bloco.texto) return null

    const centro = bloco.alinhamento === "centro"

    return (
        <section className={`largura py-8 sm:py-10 ${centro ? "text-center" : ""}`}>
            {bloco.titulo ? (
                <h2 className={`titulo ${centro ? "inline-block" : ""}`}>{bloco.titulo}</h2>
            ) : null}

            {bloco.texto ? (
                <p
                    className={`mt-3 whitespace-pre-line text-[0.92rem] leading-relaxed text-[var(--ink-2)] ${
                        centro ? "mx-auto max-w-2xl" : "max-w-2xl"
                    }`}
                >
                    {bloco.texto}
                </p>
            ) : null}
        </section>
    )
}

/**
 * Uma faixa de chamada, com botão.
 *
 * O tom "destaque" usa a cor que o lojista escolheu no tema — e só ela: cor
 * livre por bloco produziria, mais cedo do que tarde, texto preto em fundo
 * preto na loja de alguém.
 */
export function BlocoFaixa({ bloco }: { bloco: Bloco }) {

    if (!bloco.titulo && !bloco.texto) return null

    const destaque = bloco.tom === "destaque"
    const link = linkSeguro(bloco.link)

    return (
        <section className="largura py-6 sm:py-8">
            <div
                className={`flex flex-col items-center gap-3 px-6 py-8 text-center sm:px-10 sm:py-10 ${
                    destaque
                        ? "bg-[var(--destaque)] text-[var(--sobre-destaque)]"
                        : "bg-[var(--placa)] text-[var(--ink)]"
                }`}
            >
                {bloco.titulo ? (
                    <p className="text-[1.15rem] font-bold leading-tight sm:text-[1.4rem]">
                        {bloco.titulo}
                    </p>
                ) : null}

                {bloco.texto ? (
                    <p
                        className={`max-w-xl text-[0.88rem] leading-relaxed ${
                            destaque ? "opacity-90" : "text-[var(--ink-2)]"
                        }`}
                    >
                        {bloco.texto}
                    </p>
                ) : null}

                {link && bloco.botao_texto ? (
                    <Link
                        href={link}
                        className={`mt-2 px-6 py-2.5 text-[0.85rem] font-semibold transition-colors ${
                            destaque
                                ? "bg-[var(--sobre-destaque)] text-[var(--destaque)] hover:opacity-90"
                                : "bg-[var(--destaque)] text-[var(--sobre-destaque)] hover:opacity-90"
                        }`}
                    >
                        {bloco.botao_texto}
                    </Link>
                ) : null}
            </div>
        </section>
    )
}

/** Uma imagem de largura inteira, com link opcional. */
export function BlocoImagem({ bloco }: { bloco: Bloco }) {

    if (!bloco.imagem_url) return null

    const link = linkSeguro(bloco.link)

    const imagem = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={bloco.imagem_url}
            alt={bloco.alt ?? ""}
            loading="lazy"
            className="h-auto w-full object-cover"
        />
    )

    return (
        <section className="largura py-4 sm:py-6">
            {link ? <Link href={link}>{imagem}</Link> : imagem}
        </section>
    )
}

/**
 * Uma seção com colunas: o container.
 *
 * É o que permite pôr dois textos lado a lado, ou uma imagem ao lado de uma
 * chamada. No celular as colunas viram uma embaixo da outra — sempre, e sem
 * o lojista precisar pensar nisso: quatro colunas numa tela de 360px não são
 * quatro colunas, são quatro tiras ilegíveis.
 *
 * Recebe `desenhar` de quem chama porque uma coluna pode ter prateleira de
 * produtos dentro, e prateleira depende do catálogo — que mora no Vitrine.
 * Assim a seção cuida do arranjo e não precisa saber o que há em cada bloco.
 */
export function BlocoSecao({
    bloco,
    desenhar,
}: {
    bloco: Bloco
    desenhar: (filho: Bloco) => React.ReactNode
}) {

    const colunas = bloco.colunas ?? []

    if (colunas.length === 0) return null

    const fundo =
        bloco.fundo === "destaque"
            ? "bg-[var(--destaque)] text-[var(--sobre-destaque)]"
            : bloco.fundo === "claro"
                ? "bg-[var(--placa)]"
                : ""

    // "total" sangra até a borda da tela; "normal" respeita a coluna de
    // conteúdo do resto da loja.
    const largura = bloco.largura === "total" ? "w-full px-4 sm:px-6" : "largura"

    const grade =
        colunas.length >= 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : colunas.length === 3
                ? "sm:grid-cols-2 lg:grid-cols-3"
                : colunas.length === 2
                    ? "sm:grid-cols-2"
                    : ""

    return (
        <section className={`${fundo} ${bloco.fundo && bloco.fundo !== "nenhum" ? "py-8 sm:py-10" : "py-2"}`}>
            <div className={largura}>

                {bloco.titulo ? (
                    <h2 className="titulo mb-5">{bloco.titulo}</h2>
                ) : null}

                <div className={`grid grid-cols-1 gap-6 ${grade}`}>
                    {colunas.map((coluna, indice) => (
                        <div key={indice} className="min-w-0 space-y-4">
                            {coluna.map((filho) => (
                                <div key={filho.id}>{desenhar(filho)}</div>
                            ))}
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}

/** Um respiro entre dois blocos. */
export function BlocoEspaco({ bloco }: { bloco: Bloco }) {

    const altura =
        bloco.altura === "grande" ? "h-16 sm:h-24" : bloco.altura === "pequeno" ? "h-4 sm:h-6" : "h-8 sm:h-12"

    return <div className={altura} aria-hidden />
}
