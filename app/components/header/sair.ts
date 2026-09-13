"use client"

/**
 * Encerra a sessão desta loja.
 *
 * Vive fora do header porque quem oferece "sair" são dois lugares — a barra
 * do computador e a gaveta do celular — e sessão pela metade (uma tela
 * apagando o cookie de um jeito, a outra de outro) é o tipo de divergência
 * que só aparece em produção.
 *
 * A saída passa pelo servidor: é lá que a sessão morre de verdade, porque o
 * cookie é httpOnly e o backend invalida os tokens da conta. Quem chama
 * ainda precisa de um `router.refresh()` depois, para o servidor redesenhar
 * a página já como visitante.
 */
export async function sairDaConta(slug: string): Promise<void> {
    await fetch("/api/conta/sair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loja: slug }),
    }).catch(() => null)
}
