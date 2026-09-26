"use client"

import Link from "next/link"
import { FiClock, FiMapPin, FiMessageCircle, FiPackage, FiPhone, FiShield, FiUser } from "react-icons/fi"
import { useLoja, useTexto } from "@/app/loja/loja-context"
import type { ColunaDoRodape, PecaDaMoldura } from "@/app/loja/loja-context"
import { caminhoDaLoja } from "@/lib/caminhos"
import { linkWhatsapp, telefoneLegivel } from "@/lib/contato"
import { linkSeguro } from "@/lib/link"

/**
 * O rodapé é onde uma loja on-line brasileira ganha ou perde a confiança.
 *
 * A régua aqui foi: só entra o que é VERDADE sobre esta loja. Nada de "frete
 * grátis acima de R$ 199", "troca em 30 dias" ou selo de segurança comprado —
 * promessa que a loja não fez, escrita por nós, é a pior coisa que se pode pôr
 * numa vitrine. Quando o cliente descobre que não vale, ele não desconfia da
 * frase: desconfia da loja.
 *
 * Sobra pouco, e o pouco é forte: o CNPJ (que prova que há uma empresa
 * registrada), o meio de pagamento que ela de fato aceita, e o caminho para
 * acompanhar o pedido.
 *
 * A faixa de três garantias que abria o rodapé saiu: o que ela dizia — dados
 * protegidos, pagamento direto para a loja, pedido registrado na conta — já
 * está dito onde importa, na página do produto (ao lado do botão de comprar) e
 * na coluna "Como você paga" logo abaixo. Repetido no rodapé, virava discurso.
 */
export default function Footer() {

    const loja = useLoja()

    // Os títulos das colunas, nas palavras da loja (ver loja-context.useTexto).
    const t = useTexto()
    const ano = new Date().getFullYear()

    // A coluna de contato só existe se houver contato: metade dela preenchida
    // e metade vazia é o tipo de rodapé que denuncia página de vitrine
    // montada em série.
    const conversa = linkWhatsapp(loja.whatsapp)
    const temContato = Boolean(conversa || loja.telefone || loja.endereco || loja.horario)

    /* ------------------------------------------------------------------
       A MOLDURA

       As colunas do rodapé, o título de cada uma e a ordem delas vêm do
       editor do painel (ver services/paginas/moldura.go). O que chega aqui
       é dado — "coluna contato", "coluna larga" —, nunca marcação.

       Sem moldura na resposta, cai no padrão de fábrica logo abaixo: é o
       rodapé de quatro colunas que a vitrine sempre desenhou, e é o que
       aparece no minuto de um deploy em que o servidor está mais velho que
       esta vitrine.
       ------------------------------------------------------------------ */
    const rodape = loja.moldura?.rodape
    const colunas = rodape?.colunas?.length ? rodape.colunas : COLUNAS_DE_FABRICA
    const barra = rodape?.barra?.length ? rodape.barra : BARRA_DE_FABRICA

    if (rodape && rodape.ligado === false) return null

    /* Uma coluna do rodapé, desenhada pelo tipo das peças dentro dela.

       Coluna que ficaria vazia não é desenhada: metade preenchida e metade
       em branco é o tipo de rodapé que denuncia vitrine montada em série. É
       a mesma regra que já escondia a coluna de contato numa loja sem
       telefone. */
    function Coluna({ coluna }: { coluna: ColunaDoRodape }) {

        const pecas = (coluna.pecas ?? []).filter((peca) => temConteudo(peca.tipo))

        if (pecas.length === 0) return null

        return (
            <div>
                {coluna.titulo ? (
                    <p className="rotulo text-[var(--ink-2)]">{coluna.titulo}</p>
                ) : null}

                {pecas.map((peca) => (
                    <PecaDoRodape key={peca.id || peca.tipo} peca={peca} />
                ))}
            </div>
        )
    }

    /** Uma coluna só vale a pena quando a loja tem o que pôr nela. */
    function temConteudo(tipo: string): boolean {

        if (tipo === "contato") return temContato

        return true
    }

    function PecaDoRodape({ peca }: { peca: PecaDaMoldura }) {

        switch (peca.tipo) {

            case "sobre":
                return (
                    <>
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--destaque)] text-base font-bold text-[var(--sobre-destaque)]">
                                {loja.nome.trim().charAt(0).toUpperCase() || "L"}
                            </span>

                            <span className="min-w-0 truncate text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink)] sm:text-[0.95rem] sm:tracking-[0.28em]">
                                {loja.nome}
                            </span>
                        </div>

                        {/* Genérico de propósito: esta vitrine serve loja de
                            roupa, de eletro e de qualquer outra coisa, e um
                            texto sobre "peças de vestuário" numa loja de
                            ventilador é o tipo de detalhe que denuncia página
                            montada em série. */}
                        <p className="mt-3 max-w-xs text-[0.82rem] leading-relaxed text-[var(--ink-2)]">
                            {peca.texto || "O que está aqui é o que existe no estoque da loja. Preço e disponibilidade são os mesmos do balcão."}
                        </p>

                        {loja.cnpj ? (
                            <p className="num mt-4 text-[0.75rem] text-[var(--ink-3)]">
                                CNPJ {loja.cnpj}
                            </p>
                        ) : null}
                    </>
                )

            case "links":
                return (
                    <ul className="mt-3 space-y-1 text-[0.82rem]">
                        <li>
                            <Link href={caminhoDaLoja(loja.slug, "acompanhar")} className="link flex min-h-9 items-center gap-2">
                                <FiPackage className="w-3.5" aria-hidden />
                                Meus pedidos
                            </Link>
                        </li>
                        <li>
                            <Link href={caminhoDaLoja(loja.slug, "conta")} className="link flex min-h-9 items-center gap-2">
                                <FiUser className="w-3.5" aria-hidden />
                                {t("topo.conta", "Minha conta")}
                            </Link>
                        </li>
                        <li>
                            <Link href={caminhoDaLoja(loja.slug)} className="link flex min-h-9 items-center">
                                Ver todos os produtos
                            </Link>
                        </li>
                    </ul>
                )

            case "contato":
                return (
                    <ul className="mt-3 space-y-2 text-[0.82rem]">

                        {conversa ? (
                            <li>
                                <a
                                    href={conversa}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link flex min-h-9 items-center gap-2"
                                >
                                    <FiMessageCircle className="w-3.5 shrink-0" aria-hidden />
                                    {telefoneLegivel(loja.whatsapp)}
                                </a>
                            </li>
                        ) : null}

                        {loja.telefone ? (
                            <li className="flex min-h-9 items-center gap-2 text-[var(--ink-2)]">
                                <FiPhone className="w-3.5 shrink-0" aria-hidden />
                                {loja.telefone}
                            </li>
                        ) : null}

                        {loja.endereco ? (
                            <li className="flex items-start gap-2 leading-relaxed text-[var(--ink-2)]">
                                <FiMapPin className="mt-1 w-3.5 shrink-0" aria-hidden />
                                {loja.endereco}
                            </li>
                        ) : null}

                        {loja.horario ? (
                            <li className="flex items-start gap-2 leading-relaxed text-[var(--ink-2)]">
                                <FiClock className="mt-1 w-3.5 shrink-0" aria-hidden />
                                {loja.horario}
                            </li>
                        ) : null}

                    </ul>
                )

            case "pagamento":
                return loja.aceita_pagamento ? (
                    <>
                        {/* O que ESTA loja aceita, vindo do provedor que ela
                            conectou — e não uma lista fixa. */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(loja.metodos_pagamento ?? []).map((forma) => (
                                <span
                                    key={forma}
                                    className="rounded-[var(--radius-sm)] border border-[var(--linha)] bg-[var(--fundo)] px-2.5 py-1.5 text-[0.75rem] font-bold text-[var(--ink-2)] shadow-[var(--sombra-1)]"
                                >
                                    {forma}
                                </span>
                            ))}
                        </div>

                        {/* Dito com todas as letras porque é o que mais
                            tranquiliza quem está com o cartão na mão: o dado do
                            cartão não passa por esta loja nem por este
                            sistema. */}
                        <p className="mt-3 flex items-start gap-2 text-[0.75rem] leading-relaxed text-[var(--ink-3)]">
                            <FiShield className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                            O pagamento acontece no ambiente do provedor. Seus dados
                            de cartão não passam por esta loja.
                        </p>
                    </>
                ) : (
                    <p className="mt-3 text-[0.82rem] text-[var(--ink-2)]">
                        Esta loja combina o pagamento direto com você depois do pedido.
                    </p>
                )

            case "texto":
                return (
                    <p className="mt-3 max-w-xs text-[0.82rem] leading-relaxed text-[var(--ink-2)]">
                        {peca.texto}
                    </p>
                )

            default:
                return null
        }
    }

    // Quantas colunas o grid tem, e qual delas é a larga. Calculado a partir
    // do que SOBROU depois de esconder as vazias: um grid de quatro com três
    // colunas dentro deixa um buraco do tamanho de uma coluna no rodapé.
    const visiveis = colunas.filter((coluna) =>
        (coluna.pecas ?? []).some((peca) => temConteudo(peca.tipo)))

    /* A grade do rodapé, escolhida entre classes ESCRITAS.
    
       Tailwind precisa ver a classe no código para gerá-la, então nada de
       montar "md:grid-cols-[...]" com o que veio do banco: a classe sairia
       do build e o rodapé desabaria numa coluna. A primeira coluna larga é
       o arranjo de sempre — a da marca respira, as outras são listas. */
    const grade = GRADES[`${visiveis[0]?.largura === "larga" ? "larga-" : ""}${visiveis.length}`]
        ?? "md:grid-cols-4"

    return (

        <footer className="mt-auto border-t border-[var(--linha)] bg-[var(--placa)]">

            <div className={`largura grid gap-7 py-8 sm:grid-cols-2 sm:gap-8 sm:py-10 ${grade}`}>
                {visiveis.map((coluna) => (
                    <Coluna key={coluna.id || coluna.titulo} coluna={coluna} />
                ))}
            </div>

            {/* A barra final, na cor da marca.
                Um rodapé que termina no mesmo branco da página não termina —
                a faixa escura é o que fecha a loja, e é onde as lojas grandes
                põem razão social, CNPJ e as políticas. */}
            <div className="bg-[var(--destaque)] text-[color-mix(in_srgb,var(--sobre-destaque)_78%,transparent)]">
                <div className="largura flex flex-wrap items-center gap-x-3 gap-y-1 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[0.72rem] leading-relaxed">

                    {barra.map((peca) => {

                        if (peca.tipo === "copyright") {
                            return (
                                <p key={peca.id || "copyright"}>
                                    © {ano} {loja.nome}
                                    {loja.cnpj ? ` · CNPJ ${loja.cnpj}` : ""} · Preços e estoque sujeitos a
                                    alteração sem aviso prévio.
                                </p>
                            )
                        }

                        /* A LGPD exige que o titular saiba como os dados dele
                           são tratados, e "saber" só vale se o caminho estiver
                           à mão: rodapé, em toda página da loja. O servidor
                           devolve esta peça mesmo que o lojista a arraste para
                           fora (ver ValidarRodape). */
                        if (peca.tipo === "privacidade") {
                            return (
                                <Link
                                    key={peca.id || "privacidade"}
                                    href={caminhoDaLoja(loja.slug, "privacidade")}
                                    className="font-semibold text-[var(--sobre-destaque)] underline underline-offset-4 transition-opacity hover:opacity-80"
                                >
                                    Privacidade
                                </Link>
                            )
                        }

                        // linkSeguro pelo mesmo motivo do cabeçalho: o
                        // endereço vem do editor de moldura e termina num
                        // `href`, e "javascript:..." ali executaria no clique.
                        const destino = peca.tipo === "link" ? linkSeguro(peca.link) : ""

                        if (destino) {
                            return (
                                <Link
                                    key={peca.id || destino}
                                    href={destino}
                                    className="font-semibold text-[var(--sobre-destaque)] underline underline-offset-4 transition-opacity hover:opacity-80"
                                >
                                    {peca.texto || destino}
                                </Link>
                            )
                        }

                        if (peca.tipo === "texto") {
                            return <p key={peca.id || peca.texto}>{peca.texto}</p>
                        }

                        return null
                    })}

                </div>
            </div>

        </footer>

    )
}

/**
 * As grades possíveis do rodapé, escritas por extenso.
 *
 * A chave é a contagem de colunas visíveis, com "larga-" na frente quando a
 * primeira é a larga — que é o arranjo de sempre: a coluna da marca respira,
 * as outras são listas curtas.
 */
const GRADES: Record<string, string> = {
    "2": "md:grid-cols-2",
    "3": "md:grid-cols-3",
    "4": "md:grid-cols-4",
    "5": "md:grid-cols-5",
    "larga-2": "md:grid-cols-[1.5fr_1fr]",
    "larga-3": "md:grid-cols-[1.5fr_1fr_1fr]",
    "larga-4": "md:grid-cols-[1.4fr_1fr_1fr_1fr]",
    "larga-5": "md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]",
}

/**
 * O rodapé de fábrica, igual ao que o servidor manda quando a loja nunca
 * mexeu nele (ver RodapePadrao em services/paginas/moldura.go).
 *
 * A cópia existe para um caso só: servidor mais velho que esta vitrine, no
 * meio de um deploy.
 */
const COLUNAS_DE_FABRICA: ColunaDoRodape[] = [
    { id: "sobre", largura: "larga", pecas: [{ id: "sobre", tipo: "sobre" }] },
    { id: "pedido", titulo: "Seu pedido", pecas: [{ id: "links-pedido", tipo: "links" }] },
    { id: "contato", titulo: "Fale com a loja", pecas: [{ id: "contato", tipo: "contato" }] },
    { id: "pagamento", titulo: "Formas de pagamento", pecas: [{ id: "pagamento", tipo: "pagamento" }] },
]

const BARRA_DE_FABRICA: PecaDaMoldura[] = [
    { id: "copyright", tipo: "copyright" },
    { id: "privacidade", tipo: "privacidade" },
]
