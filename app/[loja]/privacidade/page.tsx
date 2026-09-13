import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Header from "@/app/components/header/header"
import Footer from "@/app/components/footer/footer"
import { buscarLojaServidor } from "@/lib/loja"
import { caminhoDaLoja } from "@/lib/caminhos"
import { linkWhatsapp, telefoneLegivel } from "@/lib/contato"

/**
 * A política de privacidade da loja.
 *
 * Escrita por loja, e não uma página institucional do sistema, porque é a LOJA
 * quem responde por esses dados: ela é a controladora (LGPD, art. 5º, VI) —
 * foi ela que decidiu coletar endereço para entregar encomenda. Este sistema é
 * o operador, que trata os dados por conta dela.
 *
 * O texto descreve o que o sistema REALMENTE faz. Cada afirmação aqui
 * corresponde a uma linha de código: os cookies são só o de sessão porque não
 * há rastreador nenhum; o cartão não passa por aqui porque o pagamento
 * acontece na página do provedor; o pedido sobrevive à exclusão porque
 * Anonimizar (ver services/privacidade) mantém o registro da venda.
 *
 * Se um dia o sistema passar a fazer algo que este texto não descreve, é o
 * texto que vira mentira — e política de privacidade que não corresponde ao
 * sistema é pior do que não ter, porque é uma promessa escrita.
 */

export async function generateMetadata({ params }: PageProps<"/[loja]/privacidade">): Promise<Metadata> {

    const { loja: slug } = await params
    const loja = await buscarLojaServidor(slug)

    return {
        title: loja ? `Privacidade | ${loja.nome}` : "Privacidade",
        description: "Como esta loja trata os seus dados pessoais.",
    }
}

export default async function PrivacidadePage({ params }: PageProps<"/[loja]/privacidade">) {

    const { loja: slug } = await params
    const loja = await buscarLojaServidor(slug)

    if (!loja) notFound()

    const conversa = linkWhatsapp(
        loja.whatsapp,
        "Olá! Quero falar sobre os meus dados pessoais (LGPD).",
    )

    return (
        <div className="flex min-h-screen flex-1 flex-col bg-[var(--fundo)]">
            <Header />

            <main className="largura max-w-3xl py-10 sm:py-14">

                <p className="rotulo text-[var(--ink-3)]">{loja.nome}</p>

                <h1 className="mt-2 text-[1.6rem] font-light leading-tight text-[var(--ink)] sm:text-[2rem]">
                    Política de <strong className="font-bold">privacidade</strong>
                </h1>

                <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--ink-2)]">
                    Esta página explica quais dados seus a {loja.nome} guarda, por que os
                    guarda e o que você pode fazer a respeito. Está escrita na Lei Geral
                    de Proteção de Dados (Lei 13.709/2018).
                </p>

                <Secao titulo="Quem responde pelos seus dados">
                    <p>
                        A <strong>{loja.nome}</strong>
                        {loja.cnpj ? <> (CNPJ {loja.cnpj})</> : null} é a controladora dos
                        seus dados: é ela quem decide o que coletar e para quê. O sistema
                        que faz esta loja funcionar é o operador — ele trata os dados por
                        conta da loja e no limite do que ela determina.
                    </p>

                    <p>
                        Para falar sobre os seus dados, procure a loja:
                        {conversa ? (
                            <>
                                {" "}
                                <a href={conversa} target="_blank" rel="noopener noreferrer" className="link">
                                    WhatsApp {telefoneLegivel(loja.whatsapp)}
                                </a>
                            </>
                        ) : null}
                        {loja.telefone ? <> · telefone {loja.telefone}</> : null}
                        {loja.endereco ? <> · {loja.endereco}</> : null}
                        {!conversa && !loja.telefone && !loja.endereco ? (
                            <> pelos canais de atendimento da loja.</>
                        ) : null}
                    </p>
                </Secao>

                <Secao titulo="O que é coletado, e por quê">
                    <Tabela
                        linhas={[
                            ["Nome e e-mail", "Para criar sua conta, identificar seus pedidos e falar com você sobre eles.", "Execução do contrato (art. 7º, V)"],
                            ["Senha", "Para proteger o acesso à sua conta. Ela é guardada cifrada — nem a loja consegue lê-la.", "Execução do contrato"],
                            ["Telefone", "Para a loja te encontrar quando o entregador não acha o endereço ou falta combinar algo.", "Execução do contrato"],
                            ["Endereço de entrega", "Para entregar o que você comprou, e como prova de que a entrega aconteceu.", "Execução do contrato e obrigação legal"],
                            ["Pedidos e valores", "Para atender a compra, dar garantia e cumprir as obrigações fiscais da loja.", "Obrigação legal (art. 16, I)"],
                            ["Mensagens do chat", "Para atender você e manter o histórico da conversa.", "Execução do contrato"],
                            ["Avaliações", "Para mostrar na página do produto o que quem comprou achou.", "Consentimento — você escolhe avaliar"],
                        ]}
                    />
                </Secao>

                <Secao titulo="Com quem esses dados são compartilhados">
                    <p>
                        Com o <strong>provedor de pagamento</strong>, quando você paga: o
                        pagamento acontece na página segura dele, e por isso{" "}
                        <strong>nenhum dado do seu cartão passa por esta loja</strong> nem
                        fica guardado aqui. Ele recebe o valor, o número do pedido e o seu
                        e-mail.
                    </p>

                    <p>
                        Com quem <strong>entrega</strong>, quando o pedido vai para o seu
                        endereço — que precisa saber para onde ir.
                    </p>

                    <p>
                        Fora isso, seus dados não são vendidos, cedidos nem usados para
                        publicidade de terceiros.
                    </p>
                </Secao>

                <Secao titulo="Cookies">
                    <p>
                        Esta loja usa <strong>um cookie só</strong>: o que mantém você
                        conectado à sua conta. Ele é necessário para o site funcionar, não
                        acompanha você em outros sites e não alimenta anúncio nenhum. Não
                        há rastreador, pixel de rede social nem ferramenta de análise de
                        comportamento nesta vitrine.
                    </p>
                </Secao>

                <Secao titulo="Por quanto tempo">
                    <p>
                        Os dados da sua conta ficam enquanto ela existir. Os registros das
                        compras ficam pelo prazo que a lei exige da loja — mesmo depois de
                        você pedir a exclusão, como está explicado abaixo.
                    </p>
                </Secao>

                <Secao titulo="Os seus direitos">
                    <p>
                        A lei garante que você possa saber o que a loja tem sobre você,
                        corrigir, levar embora e pedir a exclusão (arts. 17 a 22). Nesta
                        loja, os dois primeiros estão a um clique:
                    </p>

                    <ul className="mt-3 space-y-2">
                        <li className="flex items-start gap-2.5">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink-3)]" aria-hidden />
                            <span>
                                <strong>Baixar seus dados</strong> — um arquivo com tudo o que
                                a loja guarda sobre você, em{" "}
                                <Link href={caminhoDaLoja(slug, "acompanhar")} className="link">
                                    Meus pedidos
                                </Link>
                                .
                            </span>
                        </li>

                        <li className="flex items-start gap-2.5">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink-3)]" aria-hidden />
                            <span>
                                <strong>Apagar seus dados</strong> — na mesma tela. Nome,
                                e-mail, telefone e conversas são removidos, e a sua conta
                                deixa de existir.
                            </span>
                        </li>
                    </ul>

                    <p className="mt-4">
                        <strong>O que a exclusão não apaga, e por quê:</strong> os pedidos
                        continuam registrados, sem ligação com você. A loja é obrigada a
                        guardar o histórico das vendas (art. 16, I, da LGPD ressalva o
                        cumprimento de obrigação legal), e é esse registro que sustenta
                        nota fiscal, garantia e eventual disputa. O que some é o que ligava
                        aqueles pedidos a uma pessoa.
                    </p>
                </Secao>

                <Secao titulo="Segurança">
                    <p>
                        O site inteiro trafega criptografado. A sua senha é guardada como
                        hash — não dá para voltar ao texto original. As credenciais de
                        pagamento da loja ficam cifradas, e cada loja do sistema enxerga só
                        os próprios dados: um cadastro nunca atravessa de uma para outra.
                    </p>
                </Secao>

                <p className="mt-10 border-t border-[var(--linha)] pt-5 text-[0.78rem] leading-relaxed text-[var(--ink-3)]">
                    Se algum ponto desta página não corresponder ao que acontece na
                    prática, fale com a loja: uma política que não descreve a realidade não
                    protege ninguém.
                </p>

                <Link href={caminhoDaLoja(slug)} className="link mt-6 inline-block text-[0.85rem]">
                    ← voltar à vitrine
                </Link>

            </main>

            <Footer />
        </div>
    )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <section className="mt-9 border-t border-[var(--linha)] pt-6">
            <h2 className="titulo">{titulo}</h2>

            <div className="mt-4 space-y-3 text-[0.88rem] leading-relaxed text-[var(--ink-2)]">
                {children}
            </div>
        </section>
    )
}

/** O que se coleta, por quê e com que base legal — três colunas, sem enfeite. */
function Tabela({ linhas }: { linhas: string[][] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[0.82rem]">
                <thead>
                    <tr className="border-b border-[var(--linha)] text-[0.7rem] uppercase tracking-[0.06em] text-[var(--ink-3)]">
                        <th className="py-2 pr-4 font-bold">Dado</th>
                        <th className="py-2 pr-4 font-bold">Para quê</th>
                        <th className="py-2 font-bold">Base legal</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-[var(--linha-suave)]">
                    {linhas.map(([dado, porque, base]) => (
                        <tr key={dado}>
                            <td className="py-2.5 pr-4 font-semibold text-[var(--ink)]">{dado}</td>
                            <td className="py-2.5 pr-4">{porque}</td>
                            <td className="py-2.5 text-[var(--ink-3)]">{base}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
