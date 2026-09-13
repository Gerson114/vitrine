"use client"

import { useState } from "react"
import { FiCheck, FiChevronDown, FiMapPin, FiNavigation } from "react-icons/fi"
import { useLoja } from "@/app/loja/loja-context"
import { caminhoDaLoja } from "@/lib/caminhos"

/**
 * Uma unidade da rede, do jeito que a vitrine a mostra.
 *
 * `distancia_km` só vem quando o visitante deixou o navegador dizer onde está
 * E aquela loja tem ponto no mapa cadastrado. Ausente quer dizer "não dá para
 * dizer" — e aí a tela não promete proximidade nenhuma.
 */
interface Filial {
    nome: string
    slug: string
    endereco?: string
    horario?: string
    telefone?: string
    atual: boolean
    distancia_km?: number
}

/**
 * O seletor de loja da vitrine: a mesma rede, o endereço que o cliente
 * escolher.
 *
 * Por que ele existe: a rede é uma empresa só aos olhos de quem compra. Quem
 * cai na página de uma unidade e mora do outro lado da cidade precisa poder ir
 * para a dele sem descobrir o endereço por adivinhação — e sem sair do site
 * para procurar no buscador, que é onde ele encontra o concorrente.
 *
 * Trocar de unidade é uma NAVEGAÇÃO de verdade, e não uma troca de estado: cada
 * loja tem o seu estoque, os seus preços e o seu carrinho, e o endereço no
 * navegador é o que diz de qual delas é a página. Trocar por baixo deixaria o
 * cliente com um carrinho de uma unidade e a vitrine de outra.
 *
 * A lista só é buscada quando o cliente abre o seletor, e a localização só é
 * pedida quando ele clica em "mais perto de mim". Pedir a posição na chegada
 * gastaria a única pergunta que o navegador faz — e a maioria responde "não"
 * a uma janela que aparece sozinha antes de a pessoa saber para quê.
 */
export default function Filiais() {

    const loja = useLoja()

    const [aberto, setAberto] = useState(false)
    const [filiais, setFiliais] = useState<Filial[]>([])
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState("")
    const [ordenadoPorDistancia, setOrdenado] = useState(false)

    async function buscar(posicao?: GeolocationCoordinates) {

        setCarregando(true)
        setErro("")

        try {
            const endereco = new URL("/api/filiais", window.location.origin)
            endereco.searchParams.set("loja", loja.slug)

            if (posicao) {
                endereco.searchParams.set("lat", String(posicao.latitude))
                endereco.searchParams.set("lon", String(posicao.longitude))
            }

            const resposta = await fetch(endereco, { headers: { Accept: "application/json" } })
            const dados = (await resposta.json()) as { filiais?: Filial[]; erro?: string }

            if (!resposta.ok) {
                throw new Error(dados.erro ?? "Não foi possível carregar as lojas")
            }

            setFiliais(dados.filiais ?? [])
            setOrdenado(Boolean(posicao))

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível carregar as lojas")
        } finally {
            setCarregando(false)
        }
    }

    function abrir() {

        const proximo = !aberto
        setAberto(proximo)

        if (proximo && filiais.length === 0) void buscar()
    }

    /**
     * Ordena pela distância de quem está olhando.
     *
     * O navegador recusa a posição em três casos — a pessoa negou, o
     * dispositivo não sabe, ou a página não está em HTTPS — e nos três a lista
     * continua servindo. Por isso a falha só apaga a promessa de ordem, em vez
     * de virar um erro vermelho no meio do seletor.
     */
    function ordenarPorPerto() {

        if (!navigator.geolocation) {
            setErro("Seu navegador não sabe dizer onde você está.")
            return
        }

        setCarregando(true)

        navigator.geolocation.getCurrentPosition(
            (posicao) => void buscar(posicao.coords),
            () => {
                setCarregando(false)
                setErro("Não deu para saber onde você está. A lista continua abaixo.")
            },
            { timeout: 8000, maximumAge: 5 * 60 * 1000 },
        )
    }

    // Uma loja só na conta: o seletor seria um menu de um item, que é ruído no
    // lugar mais disputado da página. A busca já aconteceu, então isto some
    // depois de abrir uma vez — e nunca aparece para quem tem loja única.
    if (filiais.length === 1 && !carregando) return null

    return (
        <div className="relative">

            <button
                type="button"
                onClick={abrir}
                aria-expanded={aberto}
                aria-haspopup="menu"
                className="flex items-center gap-1.5 whitespace-nowrap transition-opacity hover:opacity-80"
            >
                <FiMapPin className="w-3 shrink-0" aria-hidden />
                <span>{loja.nome}</span>
                <FiChevronDown className="w-3 shrink-0" aria-hidden />
            </button>

            {aberto && (
                <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-2 w-[19rem] overflow-hidden border border-[#E1E1E1] bg-white text-[#1A1A1A] shadow-lg"
                >
                    <div className="flex items-center justify-between gap-2 border-b border-[#E1E1E1] px-3 py-2">
                        <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#616161]">
                            Nossas lojas
                        </span>

                        <button
                            type="button"
                            onClick={ordenarPorPerto}
                            className="flex items-center gap-1 text-[0.72rem] font-semibold text-[#1A1A1A] underline underline-offset-2"
                        >
                            <FiNavigation className="w-3 shrink-0" aria-hidden />
                            Mais perto de mim
                        </button>
                    </div>

                    {carregando && (
                        <p className="px-3 py-4 text-center text-[0.8rem] text-[#616161]">
                            Carregando...
                        </p>
                    )}

                    {erro && !carregando && (
                        <p className="px-3 py-2 text-[0.75rem] text-[#8E1F0B]">{erro}</p>
                    )}

                    {!carregando && filiais.map((filial) => (
                        <a
                            key={filial.slug}
                            href={caminhoDaLoja(filial.slug, "/")}
                            role="menuitem"
                            className={`flex items-start gap-2 border-b border-[#F1F1F1] px-3 py-2.5 last:border-b-0 ${
                                filial.atual ? "bg-[#F7F7F7]" : "hover:bg-[#F7F7F7]"
                            }`}
                        >
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-[0.85rem] font-semibold">
                                    {filial.nome}
                                    {filial.atual && (
                                        <FiCheck className="w-3.5 shrink-0" aria-hidden />
                                    )}
                                </span>

                                {filial.endereco && (
                                    <span className="mt-0.5 block text-[0.75rem] text-[#616161]">
                                        {filial.endereco}
                                    </span>
                                )}

                                {filial.horario && (
                                    <span className="mt-0.5 block text-[0.72rem] text-[#8A8A8A]">
                                        {filial.horario}
                                    </span>
                                )}
                            </span>

                            {/* A distância só aparece quando o servidor a
                                calculou. Uma unidade sem ponto no mapa fica sem
                                o número em vez de receber um chute. */}
                            {filial.distancia_km !== undefined && (
                                <span className="shrink-0 whitespace-nowrap text-[0.72rem] font-semibold text-[#616161]">
                                    {formatarDistancia(filial.distancia_km)}
                                </span>
                            )}
                        </a>
                    ))}

                    {ordenadoPorDistancia && !carregando && filiais.length > 0 && (
                        <p className="border-t border-[#E1E1E1] px-3 py-2 text-[0.7rem] text-[#8A8A8A]">
                            Em linha reta, da mais perto para a mais longe.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

/**
 * A distância como se diz em voz alta: metros abaixo de um quilômetro, e uma
 * casa decimal daí em diante.
 *
 * "0,3 km" é um número que ninguém usa para dizer onde fica uma loja — a
 * pessoa diz "300 m". E "12,4 km" basta: a segunda casa decimal seria precisão
 * inventada, já que a conta é em linha reta e não pela rua.
 */
function formatarDistancia(km: number): string {

    if (km < 1) return `${Math.round(km * 1000)} m`

    return `${km.toFixed(1).replace(".", ",")} km`
}
