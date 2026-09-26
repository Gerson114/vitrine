/**
 * Os cabeçalhos de segurança da vitrine, escritos UMA vez.
 *
 * Eles saem de dois lugares diferentes, e é por isso que este arquivo existe:
 *
 *  - o proxy (ver proxy.ts) responde por tudo o que é página e rota interna,
 *    e é ele que tem o nonce da requisição;
 *  - o `headers()` do next.config responde pelo que o matcher do proxy NÃO
 *    alcança — /_next/static, /_next/image, favicon.ico.
 *
 * Enquanto as duas listas eram escritas à mão, uma em cada arquivo, elas
 * divergiram sem ninguém notar: o `headers()` liberava a localização para a
 * própria página (`geolocation=(self)`, que é o que o seletor de unidades
 * precisa) e o proxy a proibia (`geolocation=()`) — e como o proxy é quem
 * responde pelas páginas, o botão "mais perto de mim" estava morto em
 * produção, sem erro nenhum na tela. Uma lista só não pode divergir de si
 * mesma.
 */

/**
 * O que o navegador pode fazer nas páginas da vitrine.
 *
 * Com nonce, `'strict-dynamic'` entra junto e o `'self'` de script-src passa a
 * ser IGNORADO pelo navegador — é assim que a política funciona: quem carrega
 * script é o script que já tem o nonce, e não a origem. Sem nonce (os
 * caminhos que o proxy não vê, que não são HTML) fica o `'self'` puro, sem
 * `'unsafe-inline'`: não há página ali para ter script inline.
 *
 * `'unsafe-inline'` em style-src é dívida conhecida e deliberada: as cores do
 * lojista chegam num ATRIBUTO style (ver app/[loja]/layout.tsx e lib/tema.ts),
 * e atributo não aceita nonce. Pôr o nonce aqui faria o navegador ignorar o
 * `'unsafe-inline'` e toda loja voltaria ao preto-e-branco de fábrica.
 */
export function politicaDeConteudo(nonce: string, dev: boolean): string {

    const script = nonce
        ? `'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`
        : "'self'"

    return [
        "default-src 'self'",
        `script-src ${script}`,
        "style-src 'self' 'unsafe-inline'",

        // A foto do produto costuma estar hospedada fora — o lojista cola a
        // URL. Imagem não executa código, e por isso é a permissão larga mais
        // barata. `blob:` é o que o next/image usa para o redimensionamento.
        "img-src 'self' https: data: blob:",

        // As fontes são servidas por nós: o next/font baixa a do Google na
        // construção da imagem e a guarda em /_next/static (ver
        // app/layout.tsx). Nada de font-src externo.
        "font-src 'self'",

        "connect-src 'self'",
        "media-src 'self' blob: data:",
        "object-src 'none'",
        "base-uri 'self'",

        // O formulário desta página só posta para ela mesma. É o que impede um
        // formulário injetado de mandar o endereço e o telefone do comprador
        // para outro servidor.
        "form-action 'self'",

        // Ninguém põe a vitrine dentro de um iframe: é assim que se monta uma
        // página falsa que parece a loja e captura o clique de comprar.
        "frame-ancestors 'none'",

        // Em desenvolvimento isto prenderia localhost em https no navegador.
        ...(dev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ")
}

/**
 * Todos os cabeçalhos de segurança de uma resposta.
 *
 * `nonce` vazio é o caso dos caminhos que o proxy não alcança. `dev` desliga
 * o HSTS e o upgrade para https, que em localhost prenderiam o navegador num
 * esquema que não existe ali.
 */
export function cabecalhosDeSeguranca(nonce: string, dev: boolean): Record<string, string> {

    const cabecalhos: Record<string, string> = {
        "Content-Security-Policy": politicaDeConteudo(nonce, dev),
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",

        // O endereço da página não vaza para terceiros: ele carrega o nome da
        // loja e, nas telas de pedido, o código dele.
        "Referrer-Policy": "strict-origin-when-cross-origin",

        // A localização fica liberada para a PRÓPRIA página: é o que faz o
        // seletor de unidades oferecer a loja mais perto de quem está olhando
        // (ver app/components/header/filiais.tsx). Câmera e microfone a
        // vitrine não usa.
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",

        // Isola a janela desta loja de qualquer coisa que ela abra — o retorno
        // do provedor de pagamento abre numa aba nova, e sem isto a página do
        // provedor mantém uma referência à vitrine (window.opener).
        "Cross-Origin-Opener-Policy": "same-origin",
    }

    // HSTS só em produção, e emitido também aqui (não só por quem termina o
    // TLS): um cabeçalho a mais é barato, e depender de a configuração do
    // Caddy estar certa para a loja não aceitar http é depender de duas
    // coisas em vez de uma.
    if (!dev) {
        cabecalhos["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    }

    return cabecalhos
}
