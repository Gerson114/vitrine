"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useLoja } from "@/app/loja/loja-context"
import { caminhoDaLoja } from "@/lib/caminhos"

/**
 * Os cinco passos que cabem nesta tela.
 *
 * Entrar e criar conta dividem o espaço desde sempre, porque quem chega aqui
 * não sabe de antemão em qual dos dois casos está. Os três de baixo entraram
 * junto e pela mesma razão: mandar quem esqueceu a senha — ou quem precisa
 * digitar o código que acabou de chegar — para outra página é onde se perde a
 * venda no meio do checkout.
 */
type Modo = "criar" | "entrar" | "confirmar" | "esqueci" | "trocar"

/**
 * Entrar, criar conta, confirmar o e-mail e recuperar a senha.
 *
 * O formulário nunca vê o token: manda as credenciais à rota interna do Next,
 * que fala com o backend e guarda a sessão num cookie httpOnly. Daí o
 * router.refresh() no fim — é o servidor que precisa reler o cookie e
 * redesenhar a página já com a pessoa logada.
 *
 * Criar conta tem DOIS desfechos, e os dois são normais: com servidor de
 * e-mail configurado, a conta ainda não nasce — seis dígitos vão para a caixa
 * da pessoa e ela volta aqui para confirmar (é o que impede alguém de criar
 * conta com o e-mail de outro, e o que dá à loja um endereço que existe de
 * verdade). Sem servidor de e-mail, a conta nasce na hora, como antes.
 */
export default function FormularioConta({ voltarPara }: { voltarPara: string }) {

    const loja = useLoja()
    const router = useRouter()

    const [modo, setModo] = useState<Modo>("criar")
    const [nome, setNome] = useState("")
    const [email, setEmail] = useState("")
    const [senha, setSenha] = useState("")
    const [codigo, setCodigo] = useState("")
    const [erro, setErro] = useState("")
    const [recado, setRecado] = useState("")
    const [enviando, setEnviando] = useState(false)

    const criando = modo === "criar"
    const entrando = modo === "entrar"
    const naEntrada = criando || entrando

    /** Lê a resposta da rota interna, já com a mensagem de erro pronta. */
    async function chamar(rota: string, corpo: Record<string, unknown>) {

        const resposta = await fetch(rota, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loja: loja.slug, ...corpo }),
        })

        const dados = await resposta.json().catch(() => null)

        if (!resposta.ok) {
            throw new Error(
                dados && typeof dados === "object" && "erro" in dados
                    ? String((dados as { erro: unknown }).erro)
                    : "Não foi possível continuar.",
            )
        }

        return (dados ?? {}) as Record<string, unknown>
    }

    function entrarNaLoja() {
        router.replace(voltarPara)
        router.refresh()
    }

    async function enviar(e: React.FormEvent<HTMLFormElement>) {

        e.preventDefault()
        setErro("")
        setRecado("")
        setEnviando(true)

        try {
            switch (modo) {

                case "criar": {
                    const dados = await chamar("/api/conta/criar", {
                        nome: nome.trim(),
                        email: email.trim(),
                        password: senha,
                    })

                    // Sem sessão na resposta: o e-mail precisa ser confirmado.
                    if (dados.confirmar) {
                        setRecado(String(dados.mensagem ?? "Confira sua caixa de entrada."))
                        setModo("confirmar")
                        break
                    }

                    entrarNaLoja()
                    break
                }

                case "entrar": {
                    await chamar("/api/conta/entrar", { email: email.trim(), password: senha })
                    entrarNaLoja()
                    break
                }

                case "confirmar": {
                    await chamar("/api/conta/confirmar", { email: email.trim(), codigo })
                    entrarNaLoja()
                    break
                }

                case "esqueci": {
                    const dados = await chamar("/api/conta/senha", { email: email.trim() })
                    setRecado(String(dados.mensagem ?? "Se existir conta com este e-mail, o código já saiu."))
                    setModo("trocar")
                    break
                }

                case "trocar": {
                    await chamar("/api/conta/senha", {
                        acao: "redefinir",
                        email: email.trim(),
                        codigo,
                        senha,
                    })

                    // Volta para o login com o e-mail preenchido: o passo
                    // seguinte é entrar com a senha que ela acabou de escolher.
                    setModo("entrar")
                    setCodigo("")
                    setSenha("")
                    setRecado("Senha trocada. Entre com ela agora.")
                    break
                }
            }

        } catch (falha) {
            setErro(falha instanceof Error ? falha.message : "Não foi possível continuar.")
        } finally {
            setEnviando(false)
        }
    }

    function trocarModo(novo: Modo) {
        setModo(novo)
        setErro("")
        setRecado("")
    }

    const rotulo: Record<Modo, string> = {
        criar: "criar conta",
        entrar: "entrar",
        confirmar: "confirmar e criar conta",
        esqueci: "mandar o código",
        trocar: "trocar a senha",
    }

    return (
        <form onSubmit={enviar} className="mx-auto w-full max-w-sm">

            {naEntrada ? (
                <div className="mb-5 flex border border-[var(--linha)]">
                    <button
                        type="button"
                        onClick={() => trocarModo("criar")}
                        className={`flex-1 px-3 py-3 text-[0.8rem] font-semibold ${criando ? "bg-[var(--destaque)] text-[var(--sobre-destaque)]" : "text-[var(--ink-2)]"}`}
                    >
                        criar conta
                    </button>
                    <button
                        type="button"
                        onClick={() => trocarModo("entrar")}
                        className={`flex-1 px-3 py-3 text-[0.8rem] font-semibold ${entrando ? "bg-[var(--destaque)] text-[var(--sobre-destaque)]" : "text-[var(--ink-2)]"}`}
                    >
                        já tenho conta
                    </button>
                </div>
            ) : (
                <p className="mb-4 text-[0.9rem] font-bold text-[var(--ink)]">
                    {modo === "confirmar"
                        ? "Confirme seu e-mail"
                        : modo === "esqueci"
                            ? "Esqueceu a senha?"
                            : "Crie uma senha nova"}
                </p>
            )}

            {criando ? (
                <label className="mb-3 block">
                    <span className="rotulo text-[var(--ink-2)]">Nome</span>
                    <input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        maxLength={120}
                        autoComplete="name"
                        className="campo mt-1"
                    />
                </label>
            ) : null}

            <label className="mb-3 block">
                <span className="rotulo text-[var(--ink-2)]">E-mail</span>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={254}
                    autoComplete="email"
                    /* No passo do código o e-mail não muda: ele é o endereço
                       para onde o código foi, e trocá-lo aqui só produziria um
                       código que não confere. */
                    readOnly={modo === "confirmar" || modo === "trocar"}
                    className={`campo mt-1 ${modo === "confirmar" || modo === "trocar" ? "opacity-70" : ""}`}
                />
            </label>

            {modo === "confirmar" || modo === "trocar" ? (
                <label className="mb-3 block">
                    <span className="rotulo text-[var(--ink-2)]">Código de seis dígitos</span>
                    <input
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="000000"
                        className="campo mt-1 font-mono text-lg tracking-[0.35em]"
                    />
                </label>
            ) : null}

            {modo !== "confirmar" && modo !== "esqueci" ? (
                <label className="mb-4 block">
                    <span className="rotulo text-[var(--ink-2)]">
                        {modo === "trocar" ? "Senha nova" : "Senha"}
                    </span>
                    <input
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        minLength={8}
                        maxLength={72}
                        autoComplete={entrando ? "current-password" : "new-password"}
                        className="campo mt-1"
                    />
                    {criando || modo === "trocar" ? (
                        <span className="mt-1 block text-[0.72rem] text-[var(--ink-3)]">
                            No mínimo 8 caracteres. Evite senha óbvia ou que
                            contenha o seu e-mail — o servidor recusa.
                        </span>
                    ) : null}
                </label>
            ) : null}

            {entrando ? (
                <button
                    type="button"
                    onClick={() => trocarModo("esqueci")}
                    className="mb-4 block text-[0.75rem] font-semibold text-[var(--ink-2)] underline"
                >
                    esqueci minha senha
                </button>
            ) : null}

            {recado && !erro ? (
                <p className="mb-3 text-[0.8rem] leading-relaxed text-[var(--verde)]">{recado}</p>
            ) : null}

            {erro ? (
                <p className="mb-3 text-[0.8rem] text-[var(--coral)]">{erro}</p>
            ) : null}

            <button type="submit" disabled={enviando} className="btn w-full py-3.5">
                {enviando ? "enviando..." : rotulo[modo]}
            </button>

            {!naEntrada ? (
                <button
                    type="button"
                    onClick={() => trocarModo("entrar")}
                    className="mt-4 block w-full text-center text-[0.75rem] font-semibold text-[var(--ink-2)] underline"
                >
                    voltar
                </button>
            ) : null}

            {/* A LGPD manda avisar no momento da coleta (art. 9º): quem está
                digitando nome e e-mail agora tem direito de saber o que a loja
                faz com eles, e o aviso só cumpre isso se estiver aqui, não
                escondido três telas adiante. Aviso, não caixinha de aceite: a
                base legal é a execução do contrato, e pedir consentimento para
                algo que independe dele seria mentir sobre a escolha. */}
            <p className="mt-4 text-center text-[0.72rem] leading-relaxed text-[var(--ink-3)]">
                Sua conta vale nesta loja. Seus dados são tratados como descreve a{" "}
                <Link href={caminhoDaLoja(loja.slug, "privacidade")} className="link">
                    política de privacidade
                </Link>
                .
            </p>

        </form>
    )
}
