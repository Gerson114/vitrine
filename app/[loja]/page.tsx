import Vitrine from "@/app/components/vitrine"

/**
 * A home da loja é um Server Component fino: só lê o `?q=` da URL (o
 * formulário de busca do cabeçalho manda para cá quando o visitante está em
 * outra página, e funciona mesmo sem JavaScript) e entrega a vitrine, que é
 * client. Qual loja é esta já foi resolvido pelo layout de [loja].
 */
export default async function Home({ searchParams }: PageProps<"/[loja]">) {

    const parametros = await searchParams
    const q = parametros.q

    const buscaInicial = (Array.isArray(q) ? q[0] : q) ?? ""

    return <Vitrine buscaInicial={buscaInicial.slice(0, 100)} />
}
