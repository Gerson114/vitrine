"use client"

/**
 * A última rede: o que aparece quando o erro derruba o próprio layout raiz.
 *
 * Sem este arquivo, uma falha ali entrega a página de erro de fábrica do
 * Next — em inglês, sem a cara da loja e sem caminho de volta. Em produção ela
 * não mostra o defeito (o Next esconde a mensagem de propósito, porque ela
 * carrega caminho de arquivo e nome de função), então a pessoa vê uma tela
 * cinza sem saber o que fazer.
 *
 * Por ser o boundary da raiz, ele substitui o layout inteiro — daí precisar
 * escrever o próprio <html> e <body>. E por isso mesmo não usa nenhuma
 * variável de tema: as cores vêm do layout de [loja], que é justamente o que
 * pode não existir quando este componente é chamado.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="pt-BR">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                    padding: "3rem 1.5rem",
                    textAlign: "center",
                    background: "#ffffff",
                    color: "#1a1a1a",
                    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                }}
            >
                <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#616161" }}>
                    Erro
                </p>

                <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 300, lineHeight: 1.2 }}>
                    <strong style={{ fontWeight: 700 }}>Algo</strong> deu errado
                </h1>

                <p style={{ margin: 0, maxWidth: "24rem", fontSize: "0.88rem", lineHeight: 1.6, color: "#616161" }}>
                    A página não conseguiu carregar. Tente de novo — e se continuar assim,
                    fale com a loja pelo WhatsApp ou pelo telefone que ela divulgou.
                </p>

                {/* Recarregar o boundary antes de oferecer o recomeço: a maior
                    parte destas falhas é uma resposta que não veio, e tentar de
                    novo resolve sem a pessoa perder de onde estava. */}
                <button
                    type="button"
                    onClick={() => reset()}
                    style={{
                        marginTop: "0.75rem",
                        padding: "0.7rem 1.75rem",
                        border: "none",
                        background: "#1a1a1a",
                        color: "#ffffff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    tentar de novo
                </button>
            </body>
        </html>
    )
}
