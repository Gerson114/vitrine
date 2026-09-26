"use client"

import Link from "next/link"
import {
    FiClock,
    FiCreditCard,
    FiGift,
    FiHeadphones,
    FiLock,
    FiMapPin,
    FiPackage,
    FiRefreshCw,
    FiShield,
    FiStar,
    FiTag,
    FiTruck,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { useLoja, type Bloco, type CartaoDaLoja } from "@/app/loja/loja-context"
import { linkWhatsapp, telefoneLegivel } from "@/lib/contato"
import { linkSeguro } from "@/lib/link"

/**
 * A faixa de cartões logo abaixo do banner — o lugar onde as lojas respondem,
 * de uma vez, às perguntas que fazem alguém fechar a aba: dá para pagar como?
 * é seguro? e depois que eu comprar? tem gente do outro lado?
 *
 * Até aqui esta faixa era escrita no código, igual para todas as lojas. O
 * problema disso não era estética: era o sistema fazendo promessa no lugar do
 * lojista. "Troca em 30 dias" na vitrine de quem não troca é uma frase que o
 * cliente só descobre falsa no pior momento — e quando descobre, não desconfia
 * da frase, desconfia da loja.
 *
 * Agora cada cartão é do lojista, escrito por ele no editor da home. O que
 * continua nosso é o DESENHO (marcação, grade, ícones) e a lista fechada de
 * ícones: a chave "cadeado" vira um cadeado nosso, e não um endereço de imagem
 * que alguém escolheu.
 *
 * As etiquetas entre chaves são o outro lado disso. `{pagamentos}` vira a lista
 * real de meios que o provedor confirmou, `{telefone}` vira o telefone do
 * cadastro. É o que permite o cartão ser editável sem voltar a ser promessa: o
 * lojista escolhe as palavras em volta, e o dado continua saindo de quem o
 * conhece. Cartão cuja etiqueta não tem dado (loja sem pagamento on-line, sem
 * telefone) simplesmente não aparece — como antes.
 */

const ICONES: Record<string, IconType> = {
    cadeado: FiLock,
    cartao: FiCreditCard,
    caixa: FiPackage,
    fone: FiHeadphones,
    caminhao: FiTruck,
    troca: FiRefreshCw,
    relogio: FiClock,
    estrela: FiStar,
    presente: FiGift,
    mapa: FiMapPin,
    escudo: FiShield,
    etiqueta: FiTag,
}

export default function Cartoes({ bloco }: { bloco: Bloco }) {

    const loja = useLoja()

    /**
     * Troca as etiquetas pelo dado real desta loja.
     *
     * A etiqueta sem dado vira VAZIO, e não some deixando o resto da frase: é
     * o que permite ao cartão inteiro desaparecer quando a informação dele não
     * existe, em vez de anunciar "Aceitamos" sem dizer o quê.
     */
    function preencher(texto: string): string {

        const dados: Record<string, string> = {
            pagamentos: loja.aceita_pagamento ? (loja.metodos_pagamento ?? []).join(" · ") : "",
            loja: loja.nome ?? "",
            telefone: loja.telefone ? telefoneLegivel(loja.telefone) : "",
            whatsapp: linkWhatsapp(loja.whatsapp) ? telefoneLegivel(loja.whatsapp ?? "") : "",
            endereco: loja.endereco ?? "",
            horario: loja.horario ?? "",
        }

        return Object.entries(dados).reduce(
            (frase, [etiqueta, valor]) => frase.split(`{${etiqueta}}`).join(valor),
            texto,
        )
    }

    const cartoes = (bloco.cartoes ?? [])
        .map((cartao: CartaoDaLoja) => ({
            icone: ICONES[cartao.icone ?? ""] ?? FiStar,
            titulo: preencher(cartao.titulo ?? "").trim(),
            texto: preencher(cartao.texto ?? "").trim(),
            link: linkSeguro(cartao.link),
            tamanho: cartao.tamanho ?? "medio",
        }))
        // Cartão cujo título sumiu com a etiqueta vazia não tem o que dizer.
        .filter((cartao) => cartao.titulo !== "")

    if (cartoes.length === 0) return null

    return (

        <section aria-label={bloco.titulo || "Nossos serviços"} className="border-y border-[var(--linha)] bg-[var(--placa)]">

            <div className="largura grid grid-cols-2 gap-x-4 gap-y-4 py-4 sm:py-5 lg:grid-cols-4 lg:gap-x-6">

                {cartoes.map((cartao, indice) => {

                    const Icone = cartao.icone

                    // O tamanho é do CARTÃO, não da faixa inteira: a frase de
                    // uma promoção pede mais destaque que o selo de confiança
                    // ao lado dela, e os dois nascem do mesmo bloco.
                    const bolha = cartao.tamanho === "grande"
                        ? "h-11 w-11"
                        : cartao.tamanho === "pequeno"
                            ? "h-7 w-7"
                            : "h-9 w-9"

                    const iconeLargura = cartao.tamanho === "grande" ? "w-6" : cartao.tamanho === "pequeno" ? "w-4" : "w-5"

                    const tituloTamanho = cartao.tamanho === "grande"
                        ? "text-[0.95rem]"
                        : cartao.tamanho === "pequeno"
                            ? "text-[0.75rem]"
                            : "text-[0.82rem]"

                    const corpo = (
                        <>
                            <span className={`mt-0.5 flex ${bolha} shrink-0 items-center justify-center rounded-full bg-[var(--destaque)] text-[var(--sobre-destaque)]`}>
                                <Icone className={iconeLargura} aria-hidden />
                            </span>

                            <div className="min-w-0">
                                <p className={`font-bold leading-tight text-[var(--ink)] ${tituloTamanho}`}>
                                    {cartao.titulo}
                                </p>

                                {/* No celular a explicação sai: duas colunas de
                                    texto miúdo viram parede. O título sozinho já
                                    diz o essencial. */}
                                {cartao.texto ? (
                                    <p className="mt-0.5 hidden text-[0.75rem] leading-snug text-[var(--ink-2)] sm:block">
                                        {cartao.texto}
                                    </p>
                                ) : null}
                            </div>
                        </>
                    )

                    // A chave é o índice porque o cartão não tem id próprio — e
                    // dois cartões podem ter o mesmo título numa loja que ainda
                    // está escrevendo os dela.
                    return cartao.link ? (
                        <Link
                            key={indice}
                            href={cartao.link}
                            className="flex items-start gap-2.5 transition-opacity hover:opacity-80"
                        >
                            {corpo}
                        </Link>
                    ) : (
                        <div key={indice} className="flex items-start gap-2.5">
                            {corpo}
                        </div>
                    )
                })}

            </div>

        </section>

    )
}
