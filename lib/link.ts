/**
 * Endereços que o lojista escreveu, conferidos antes de virarem `href`.
 *
 * O painel deixa o lojista pôr link em banner, em bloco da home, em cartão da
 * faixa e em peça do cabeçalho e do rodapé. O backend já recusa o que não é
 * caminho interno nem http(s) na gravação (ver services/paginas), e a
 * conferência é repetida aqui pelo motivo de sempre: é barata, e a vitrine não
 * deve depender de a validação do outro lado nunca ter uma brecha nem de o
 * dado nunca entrar pelo banco por outro caminho.
 *
 * O que se barra é `javascript:` num href — que executa no clique de quem está
 * comprando —, e também `data:` e `vbscript:`. O React avisa no console sobre
 * `javascript:` mas continua renderizando o link, então o aviso não é defesa.
 *
 * Esta função já existiu duas vezes, copiada em components/blocos.tsx e em
 * components/cartoes.tsx, e faltava nos outros três lugares que também põem
 * link do lojista na tela — o banner, o cabeçalho e o rodapé. Uma cópia por
 * arquivo é como uma delas fica de fora.
 */
export function linkSeguro(bruto?: string): string {

    const link = (bruto ?? "").trim()

    if (!link) return ""

    // "//outro-site.com" o navegador lê como domínio externo, não como
    // caminho — daí a segunda condição.
    if (link.startsWith("/") && !link.startsWith("//")) return link

    return /^https?:\/\//i.test(link) ? link : ""
}
