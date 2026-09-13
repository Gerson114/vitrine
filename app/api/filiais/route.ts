import { API_BASE, erroDoBackend, safeParse, slugValido } from "@/lib/conta"

/**
 * As outras unidades da mesma rede desta loja.
 *
 * Não exige sessão: escolher em qual unidade comprar é a primeira decisão de
 * quem chega, e vem antes de existir cadastro.
 *
 * A posição do visitante é opcional e atravessa como veio, já conferida: com
 * ela o servidor devolve a lista da mais perto para a mais longe; sem ela, a
 * matriz primeiro e depois por nome. Coordenada torta não vira erro — a lista
 * de lojas serve de qualquer jeito, e derrubar a resposta por causa dela
 * tiraria do ar a troca de unidade inteira.
 */
export async function GET(request: Request) {
    try {
        const pedido = new URL(request.url)

        const loja = (pedido.searchParams.get("loja") ?? "").slice(0, 40)

        if (!slugValido(loja)) {
            return Response.json({ erro: "Loja não encontrada" }, { status: 404 })
        }

        const destino = new URL(`/public/loja/${loja}/filiais`, API_BASE)

        const lat = coordenada(pedido.searchParams.get("lat"), 90)
        const lon = coordenada(pedido.searchParams.get("lon"), 180)

        if (lat !== null && lon !== null) {
            destino.searchParams.set("lat", String(lat))
            destino.searchParams.set("lon", String(lon))
        }

        const response = await fetch(destino, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        })

        const texto = await response.text()
        const corpo = safeParse(texto)

        if (!response.ok) {
            return Response.json(
                { erro: erroDoBackend(corpo, "Não foi possível carregar as lojas") },
                { status: response.status }
            )
        }

        return Response.json(corpo ?? {}, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

/**
 * Lê uma coordenada da consulta, dentro do intervalo que ela pode ocupar.
 *
 * Devolve null para o que não é número ou está fora da faixa, e quem chama
 * então simplesmente não repassa a posição: a lista continua vindo, só que sem
 * ordenar por distância.
 */
function coordenada(bruto: string | null, limite: number): number | null {

    if (bruto === null) return null

    const numero = Number(bruto)

    if (!Number.isFinite(numero) || numero < -limite || numero > limite) {
        return null
    }

    return numero
}
