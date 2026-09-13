"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { FiMessageCircle, FiSend, FiX } from "react-icons/fi"
import { useLoja } from "@/app/loja/loja-context"
import { useConta } from "@/app/conta/conta-context"
import { caminhoDaLoja } from "@/lib/caminhos"

/**
 * O chat da loja: o cliente falando com o atendente sem sair da vitrine.
 *
 * Fica em todas as páginas, recolhido num botão de canto, porque a dúvida que
 * derruba uma venda não escolhe a hora: ela aparece na página do produto
 * ("serve na minha TV?"), no carrinho ("dá para retirar hoje?") e na tela do
 * pedido ("cadê?"). Um "fale conosco" escondido numa página de contato só é
 * achado por quem já estava disposto a procurar.
 *
 * Exige conta, e isso não é burocracia: é o que amarra a conversa a uma
 * pessoa — o mesmo fio continua amanhã, de outro aparelho, e o lojista sabe
 * com quem está falando e o que ela comprou. Visitante vê o convite para
 * entrar em vez de um campo que não manda nada.
 *
 * A tela se atualiza perguntando de tempos em tempos, e só enquanto está
 * aberta: manter uma conexão viva por cada visitante da vitrine seria caro
 * para o servidor e inútil para quem nem abriu o chat. O que ela pergunta é
 * "veio algo depois da mensagem X?", então a resposta normal é vazia.
 */

const INTERVALO = 5000

interface Mensagem {
    id: number
    autor: string
    texto: string
    criada_em: string
}

function horaDe(iso: string): string {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export default function ChatDaLoja() {

    const loja = useLoja()
    const cliente = useConta()

    const [aberto, setAberto] = useState(false)
    const [mensagens, setMensagens] = useState<Mensagem[]>([])
    const [texto, setTexto] = useState("")
    const [carregando, setCarregando] = useState(false)
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState("")

    // A loja está escrevendo agora? Vem na mesma resposta da atualização
    // automática — o backend guarda o aviso em memória por três segundos (ver
    // services/atendimento/digitando.go).
    const [lojaDigitando, setLojaDigitando] = useState(false)

    // Quando avisamos pela última vez que ESTA pessoa está digitando. O aviso
    // sai no máximo a cada dois segundos: mandar um por tecla seria uma
    // requisição por letra, e o servidor só precisa saber que ainda há alguém
    // escrevendo.
    const ultimoAviso = useRef(0)

    // O fim do fio, para rolar até lá. É o comportamento de qualquer
    // conversa: a mensagem nova aparece à vista, não abaixo da dobra.
    const fim = useRef<HTMLDivElement | null>(null)

    // O id da última mensagem que já está na tela. É o que transforma a
    // atualização automática numa pergunta barata.
    const ultimoID = useRef(0)

    const juntar = useCallback((novas: Mensagem[]) => {

        if (novas.length === 0) return

        setMensagens((atuais) => {

            // Conferir por id em vez de confiar na ordem de chegada: a
            // resposta do envio e a da atualização automática podem trazer a
            // mesma mensagem, e ela apareceria duas vezes no fio.
            const vistas = new Set(atuais.map((mensagem) => mensagem.id))
            const juntas = [...atuais, ...novas.filter((mensagem) => !vistas.has(mensagem.id))]

            return juntas
        })

        ultimoID.current = Math.max(ultimoID.current, ...novas.map((mensagem) => mensagem.id))
    }, [])

    const buscar = useCallback(async (incremental: boolean) => {

        const endereco = incremental && ultimoID.current > 0
            ? `/api/atendimento?loja=${encodeURIComponent(loja.slug)}&desde=${ultimoID.current}`
            : `/api/atendimento?loja=${encodeURIComponent(loja.slug)}`

        const resposta = await fetch(endereco, { cache: "no-store" })

        if (!resposta.ok) {
            // Silêncio na atualização automática: o fio que já está na tela
            // continua lá, e uma falha de rede não deve virar erro vermelho
            // por cima de uma conversa.
            if (!incremental) {
                const dados = await resposta.json().catch(() => null)
                setErro(
                    dados && typeof dados === "object" && "erro" in dados
                        ? String((dados as { erro: unknown }).erro)
                        : "Não foi possível abrir o atendimento.",
                )
            }
            return
        }

        const dados = await resposta.json().catch(() => null)
        const lista = (dados as { mensagens?: Mensagem[] } | null)?.mensagens ?? []

        if (!incremental) setMensagens([])

        juntar(lista)
        setLojaDigitando(Boolean((dados as { digitando?: boolean } | null)?.digitando))
        setErro("")

    }, [loja.slug, juntar])

    // Abrir carrega o fio inteiro; daí em diante só o que for chegando.
    useEffect(() => {

        if (!aberto || !cliente) return

        let vivo = true

        // Quem liga o "carregando" é o clique que abre o painel, e não este
        // efeito: mexer no estado no corpo de um efeito dispara uma segunda
        // renderização em cascata, e o abrir é justamente um evento — há
        // onde escrever isso sem efeito nenhum.
        ultimoID.current = 0

        buscar(false).finally(() => {
            if (vivo) setCarregando(false)
        })

        const relogio = setInterval(() => {
            void buscar(true)
        }, INTERVALO)

        return () => {
            vivo = false
            clearInterval(relogio)
        }
    }, [aberto, cliente, buscar])

    useEffect(() => {
        fim.current?.scrollIntoView({ behavior: "smooth" })
    }, [mensagens, lojaDigitando])

    /**
     * Avisa a loja de que esta pessoa está escrevendo.
     *
     * Estrangulado a um aviso a cada dois segundos, e disparado sem esperar
     * resposta: é informação descartável, e travar o que a pessoa digita por
     * causa dela seria inverter as prioridades. Falha em silêncio — o pior
     * desfecho é o atendente não ver as bolinhas.
     */
    function avisarQueDigita() {

        const agora = Date.now()

        if (agora - ultimoAviso.current < 2000) return

        ultimoAviso.current = agora

        void fetch("/api/atendimento/digitando", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loja: loja.slug }),
        }).catch(() => {})
    }

    async function enviar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        const conteudo = texto.trim()

        if (!conteudo || enviando) return

        setEnviando(true)
        setErro("")

        try {
            const resposta = await fetch("/api/atendimento", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ loja: loja.slug, texto: conteudo }),
            })

            const dados = await resposta.json().catch(() => null)

            if (!resposta.ok) {
                setErro(
                    dados && typeof dados === "object" && "erro" in dados
                        ? String((dados as { erro: unknown }).erro)
                        : "Não foi possível enviar a mensagem.",
                )
                return
            }

            const mensagem = (dados as { mensagem?: Mensagem } | null)?.mensagem

            if (mensagem) juntar([mensagem])

            setTexto("")
            ultimoAviso.current = 0

        } catch {
            setErro("Não foi possível enviar a mensagem.")
        } finally {
            setEnviando(false)
        }
    }

    return (
        <>
            {/* O botão. Sobe acima do rodapé e sai da frente quando o painel
                está aberto — no celular os dois juntos ocupariam meia tela. */}
            {!aberto ? (
                <button
                    type="button"
                    onClick={() => {
                        setAberto(true)
                        setCarregando(Boolean(cliente))
                    }}
                    aria-label="Falar com a loja"
                    className="nao-imprime fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[var(--destaque)] px-4 py-3 text-[0.82rem] font-bold text-[var(--sobre-destaque)] shadow-[var(--sombra-3)] transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
                >
                    <FiMessageCircle className="w-4" aria-hidden />
                    falar com a loja
                </button>
            ) : null}

            {aberto ? (
                <div className="nao-imprime fixed inset-x-0 bottom-0 z-40 flex h-[min(33rem,88dvh)] flex-col overflow-hidden border border-[var(--linha)] bg-[var(--fundo)] shadow-[var(--sombra-3)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[23.5rem] sm:rounded-[var(--radius-lg)]">

                    {/* O cabeçalho na cor da marca, com a inicial da loja e o
                        estado do atendimento. Em cinza claro, o chat parecia
                        uma caixa de aviso do navegador; é a marca em cima que
                        diz de quem é aquela janela. */}
                    <div className="flex items-center gap-2.5 bg-[var(--destaque)] px-4 py-3">

                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sobre-destaque)_20%,transparent)] text-[0.9rem] font-bold text-[var(--sobre-destaque)]">
                            {loja.nome.trim().charAt(0).toUpperCase() || "L"}
                        </span>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.88rem] font-bold text-[var(--sobre-destaque)]">
                                {loja.nome}
                            </p>

                            {/* O subtítulo vira o estado da conversa: quando o
                                atendente está escrevendo, é aqui que a pessoa
                                olha primeiro. */}
                            <p className="flex items-center gap-1.5 text-[0.72rem] text-[color-mix(in_srgb,var(--sobre-destaque)_78%,transparent)]">
                                {lojaDigitando ? (
                                    <>
                                        <span className="digitando" aria-hidden>
                                            <span /><span /><span />
                                        </span>
                                        digitando…
                                    </>
                                ) : (
                                    <>
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--verde)]" aria-hidden />
                                        Atendimento pelo site
                                    </>
                                )}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setAberto(false)}
                            aria-label="Fechar o atendimento"
                            className="-m-1 shrink-0 rounded-[var(--radius-md)] p-1 text-[var(--sobre-destaque)] transition-opacity hover:opacity-75"
                        >
                            <FiX className="w-5" aria-hidden />
                        </button>
                    </div>

                    {!cliente ? (
                        <div className="flex flex-1 flex-col justify-center px-5 text-center">
                            <p className="text-[0.85rem] leading-relaxed text-[var(--ink-2)]">
                                Entre na sua conta para falar com a loja. Assim a conversa
                                fica guardada e continua de onde parou, em qualquer
                                aparelho.
                            </p>

                            <Link
                                href={caminhoDaLoja(loja.slug, "conta")}
                                onClick={() => setAberto(false)}
                                className="btn mt-5 w-full py-3"
                            >
                                entrar ou criar conta
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">

                                {carregando && mensagens.length === 0 ? (
                                    <p className="text-center text-[0.78rem] text-[var(--ink-3)]">
                                        abrindo a conversa...
                                    </p>
                                ) : null}

                                {!carregando && mensagens.length === 0 ? (
                                    <p className="px-2 py-6 text-center text-[0.82rem] leading-relaxed text-[var(--ink-3)]">
                                        Escreva a sua dúvida. A loja responde por aqui, e você
                                        vê a resposta nesta mesma tela.
                                    </p>
                                ) : null}

                                {mensagens.map((mensagem) => {

                                    const minha = mensagem.autor === "cliente"

                                    return (
                                        <div
                                            key={mensagem.id}
                                            className={`flex ${minha ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[85%] px-3 py-2 text-[0.82rem] leading-relaxed shadow-[var(--sombra-1)] ${
                                                    minha
                                                        ? "rounded-[var(--radius-lg)] rounded-br-[2px] bg-[var(--destaque)] text-[var(--sobre-destaque)]"
                                                        : "rounded-[var(--radius-lg)] rounded-bl-[2px] bg-[var(--placa-forte)] text-[var(--ink)]"
                                                }`}
                                            >
                                                <p className="whitespace-pre-wrap break-words">{mensagem.texto}</p>

                                                <p
                                                    className={`num mt-1 text-[0.66rem] ${
                                                        minha ? "text-[var(--sobre-destaque)]/70" : "text-[var(--ink-3)]"
                                                    }`}
                                                >
                                                    {horaDe(mensagem.criada_em)}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* As bolinhas também no fio, e não só no
                                    cabeçalho: é ali embaixo, no lugar onde a
                                    resposta vai nascer, que o olho está
                                    esperando por ela. */}
                                {lojaDigitando ? (
                                    <div className="flex justify-start">
                                        <div className="rounded-[var(--radius-lg)] rounded-bl-[2px] bg-[var(--placa-forte)] px-3.5 py-3 text-[var(--ink-2)] shadow-[var(--sombra-1)]">
                                            <span className="digitando">
                                                <span /><span /><span />
                                            </span>
                                            <span className="sr-only">A loja está digitando</span>
                                        </div>
                                    </div>
                                ) : null}

                                <div ref={fim} />
                            </div>

                            {erro ? (
                                <p className="border-t border-[var(--linha)] bg-[var(--erro-fundo)] px-4 py-2 text-[0.75rem] text-[var(--vermelho)]">
                                    {erro}
                                </p>
                            ) : null}

                            <form onSubmit={enviar} className="flex items-end gap-2 border-t border-[var(--linha)] bg-[var(--placa)] p-3">
                                <label className="sr-only" htmlFor="mensagem-atendimento">
                                    Sua mensagem
                                </label>

                                <textarea
                                    id="mensagem-atendimento"
                                    value={texto}
                                    onChange={(e) => {
                                        setTexto(e.target.value)
                                        if (e.target.value.trim()) avisarQueDigita()
                                    }}
                                    onKeyDown={(e) => {
                                        // Enter envia, Shift+Enter quebra linha: é o que
                                        // o dedo já espera de qualquer chat.
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault()
                                            e.currentTarget.form?.requestSubmit()
                                        }
                                    }}
                                    rows={1}
                                    maxLength={2000}
                                    placeholder="Escreva sua mensagem"
                                    className="campo max-h-28 min-h-[2.75rem] flex-1 resize-none py-2.5"
                                />

                                <button
                                    type="submit"
                                    disabled={enviando || !texto.trim()}
                                    aria-label="Enviar mensagem"
                                    className="btn shrink-0 rounded-full px-3.5 py-3 disabled:opacity-50"
                                >
                                    <FiSend className="w-4" aria-hidden />
                                </button>
                            </form>
                        </>
                    )}

                </div>
            ) : null}
        </>
    )
}
