"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { caminhoDaLoja } from "@/lib/caminhos"

/**
 * Os direitos do titular, como dois botões.
 *
 * A LGPD garante acesso, portabilidade e eliminação (arts. 17 a 22). Garantia
 * que só existe num e-mail que alguém precisa ler e atender vira promessa; aqui
 * ela é um clique, e o sistema executa.
 *
 * A exclusão é destrutiva e não tem volta, então pede confirmação num segundo
 * passo — e o segundo passo diz, antes do clique, exatamente o que some e o
 * que fica. Ninguém deve descobrir depois que os pedidos continuaram
 * registrados: isso é obrigação fiscal da loja, não letra miúda.
 */
export default function MeusDados({ slug }: { slug: string }) {

    const router = useRouter()
    const [ocupado, setOcupado] = useState<"" | "baixar" | "excluir">("")
    const [confirmando, setConfirmando] = useState(false)
    const [erro, setErro] = useState("")

    async function baixar() {

        setErro("")
        setOcupado("baixar")

        try {
            const resposta = await fetch(`/api/meus-dados?loja=${encodeURIComponent(slug)}`)

            if (!resposta.ok) {
                const dados = await resposta.json().catch(() => null)
                setErro(dados?.erro ?? "Não foi possível reunir os seus dados")
                return
            }

            const arquivo = await resposta.blob()
            const endereco = URL.createObjectURL(arquivo)
            const link = document.createElement("a")

            link.href = endereco
            link.download = "meus-dados.json"
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(endereco)

        } catch {
            setErro("Não foi possível reunir os seus dados")
        } finally {
            setOcupado("")
        }
    }

    async function excluir() {

        setErro("")
        setOcupado("excluir")

        try {
            const resposta = await fetch("/api/meus-dados", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ loja: slug }),
            })

            const dados = await resposta.json().catch(() => null)

            if (!resposta.ok) {
                setErro(dados?.erro ?? "Não foi possível concluir a exclusão")
                setOcupado("")
                return
            }

            // A conta não existe mais; a sessão já caiu no servidor.
            router.replace(caminhoDaLoja(slug))
            router.refresh()

        } catch {
            setErro("Não foi possível concluir a exclusão")
            setOcupado("")
        }
    }

    return (
        <section className="mt-10 border-t border-[var(--linha)] pt-6">

            <h2 className="titulo">Meus dados</h2>

            <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--ink-2)]">
                Você pode ver tudo o que esta loja guarda sobre você, levar embora
                numa cópia e pedir que seja apagado. É o que a{" "}
                <a href={caminhoDaLoja(slug, "privacidade")} className="link">
                    política de privacidade
                </a>{" "}
                descreve.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                    type="button"
                    onClick={baixar}
                    disabled={ocupado !== ""}
                    className="btn-claro"
                >
                    {ocupado === "baixar" ? "reunindo…" : "baixar meus dados"}
                </button>

                {!confirmando ? (
                    <button
                        type="button"
                        onClick={() => { setErro(""); setConfirmando(true) }}
                        disabled={ocupado !== ""}
                        className="btn-claro text-[var(--vermelho)]"
                    >
                        apagar meus dados
                    </button>
                ) : null}
            </div>

            {confirmando ? (
                <div className="mt-4 max-w-2xl border border-[var(--vermelho)] bg-[var(--erro-fundo)] p-4">

                    <p className="text-[0.85rem] font-bold text-[var(--ink)]">
                        Apagar seus dados desta loja?
                    </p>

                    <ul className="mt-3 space-y-1.5 text-[0.82rem] leading-relaxed text-[var(--ink-2)]">
                        <li>
                            <strong>Some:</strong> seu nome, e-mail, telefone, endereço de
                            contato e as conversas com a loja. Sua conta deixa de existir e
                            você sai agora.
                        </li>
                        <li>
                            <strong>Fica:</strong> o registro das compras, sem ligação com
                            você. A loja é obrigada a guardar o histórico de vendas para nota
                            fiscal e garantia.
                        </li>
                        <li>
                            <strong>Não tem volta:</strong> para comprar de novo, você cria
                            uma conta nova.
                        </li>
                    </ul>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                        <button
                            type="button"
                            onClick={excluir}
                            disabled={ocupado !== ""}
                            className="btn bg-[var(--vermelho)] text-white"
                        >
                            {ocupado === "excluir" ? "apagando…" : "sim, apagar"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setConfirmando(false)}
                            disabled={ocupado !== ""}
                            className="btn-claro"
                        >
                            cancelar
                        </button>
                    </div>
                </div>
            ) : null}

            {erro ? (
                <p role="alert" className="mt-3 text-[0.82rem] text-[var(--vermelho)]">
                    {erro}
                </p>
            ) : null}

        </section>
    )
}
