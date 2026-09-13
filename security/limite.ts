/**
 * Limite de requisições por origem — o freio que falta a uma vitrine aberta.
 *
 * A loja inteira é pública: qualquer um pede /api/produtos, tenta entrar numa
 * conta ou consulta um pedido por código. Sem freio, três coisas ficam de
 * graça para quem quiser: (1) força bruta de senha em /api/conta/entrar, (2)
 * varredura dos códigos de pedido, que são só seis dígitos, e (3) usar este
 * servidor como amplificador contra o backend — cada chamada aqui vira uma
 * chamada lá, e derrubar o backend derruba TODAS as lojas de uma vez.
 *
 * A contagem é uma janela fixa em memória do processo. Isso tem dois limites
 * que é melhor dizer do que descobrir depois:
 *
 *  - Ela vale por instância. Com o Next rodando em duas máquinas, cada uma
 *    conta a sua parte e o teto efetivo dobra. Para uma vitrine isso basta;
 *    quando houver mais de uma instância, a contagem deve mudar para um
 *    armazenamento compartilhado (Redis), mantendo esta mesma interface.
 *  - Ela não substitui proteção de rede. Inundação de verdade (dezenas de
 *    milhares de conexões, IPs espalhados) se para antes, na CDN ou no
 *    provedor. O que este arquivo impede é o abuso barato, de uma origem só,
 *    que é o que chega a um servidor sem nada na frente.
 */

interface Janela {
    /** Quando esta janela expira, em ms desde a época. */
    ate: number
    contagem: number
}

const janelas = new Map<string, Janela>()

/**
 * Teto de chaves guardadas. Sem ele o próprio limitador vira o alvo: basta
 * variar o IP falsificado a cada requisição para o Map crescer sem fim até o
 * processo morrer de memória — trocar uma negação de serviço por outra.
 */
const TETO_DE_CHAVES = 20_000

/** A varredura do que já venceu roda no máximo uma vez por minuto. */
const INTERVALO_DE_LIMPEZA = 60_000

let proximaLimpeza = 0

function limpar(agora: number): void {

    if (agora < proximaLimpeza) return

    proximaLimpeza = agora + INTERVALO_DE_LIMPEZA

    for (const [chave, janela] of janelas) {
        if (janela.ate <= agora) janelas.delete(chave)
    }

    // Se mesmo depois da varredura o Map continua estourado, é ataque e não
    // uso: zerar é preferível a crescer. O custo é que quem estava sendo
    // contado ganha uma janela nova — e a alternativa (recusar todo mundo)
    // seria fazer o trabalho do atacante por ele.
    if (janelas.size > TETO_DE_CHAVES) janelas.clear()
}

export interface Veredito {
    ok: boolean
    /** Quantos segundos faltam para a janela virar. Só importa quando !ok. */
    esperar: number
}

/**
 * Conta mais uma requisição desta chave e diz se ela passa.
 *
 * Janela fixa, e não deslizante, de propósito: guarda dois números por chave
 * em vez de uma lista de horários, e o pior caso (o dobro do teto na virada
 * de duas janelas) é irrelevante para o que se quer barrar aqui.
 */
export function limitar(chave: string, max: number, janelaMs: number): Veredito {

    const agora = Date.now()

    limpar(agora)

    const atual = janelas.get(chave)

    if (!atual || atual.ate <= agora) {
        janelas.set(chave, { ate: agora + janelaMs, contagem: 1 })
        return { ok: true, esperar: 0 }
    }

    atual.contagem += 1

    if (atual.contagem > max) {
        return { ok: false, esperar: Math.max(1, Math.ceil((atual.ate - agora) / 1000)) }
    }

    return { ok: true, esperar: 0 }
}

/**
 * Quantos proxies confiáveis existem na frente deste servidor.
 *
 * Zero (o padrão) quer dizer "ninguém": aí nenhum cabeçalho de encaminhamento
 * vale, porque exposto direto na internet ele é escrito por quem chama. Um é
 * só o Caddy; dois é Cloudflare + Caddy.
 */
const PROXIES_CONFIAVEIS = Number(process.env.TRUSTED_PROXY_COUNT ?? "0") || 0

/**
 * Quem está pedindo.
 *
 * Este endereço é a CHAVE do limite por IP, então errá-lo não é um detalhe:
 * se cada requisição puder inventar um endereço novo, o limite deixa de
 * existir — e foi assim que esta função começou, lendo o PRIMEIRO item do
 * X-Forwarded-For.
 *
 * O X-Forwarded-For é uma lista que cada salto ACRESCENTA NO FIM. A primeira
 * posição é a única que quem chama escreve à vontade: mandar
 * "X-Forwarded-For: 1.2.3.4" dava um endereço novo a cada tentativa, e o
 * teto de dez logins por dez minutos virava enfeite. Por isso a leitura é de
 * trás para frente — a última posição foi escrita pelo nosso próprio proxy e
 * é o que ele viu de verdade.
 *
 * Com Cloudflare na frente, o caminho mais curto e mais firme é o
 * CF-Connecting-IP: a Cloudflare o REESCREVE em toda requisição, então ele
 * não carrega nada que o visitante tenha escrito. Ele só vale, no entanto, se
 * a origem for inalcançável por fora da Cloudflare — senão qualquer um bate
 * direto no servidor com o cabeçalho que quiser. Daí ele depender de
 * TRUSTED_PROXY_COUNT estar declarado, e daí o firewall da VPS ter de aceitar
 * só as faixas da Cloudflare (ver deploy/PRODUCAO.md).
 */
export function origemDaRequisicao(headers: Headers): string {

    // Sem proxy declarado, nenhum cabeçalho de encaminhamento vale.
    if (PROXIES_CONFIAVEIS <= 0) return "sem-origem"

    const daCloudflare = headers.get("cf-connecting-ip")?.trim() ?? ""

    if (daCloudflare) return daCloudflare.slice(0, 45)

    const encaminhado = headers.get("x-forwarded-for") ?? ""
    const saltos = encaminhado.split(",").map((parte) => parte.trim()).filter(Boolean)

    // Lista mais curta do que o número de saltos declarados: ou alguém a
    // mandou pela metade, ou TRUSTED_PROXY_COUNT está maior do que a
    // realidade. Nos dois casos a posição que sobraria seria a primeira —
    // justamente a que quem chama escreve. Melhor cair no x-real-ip.
    if (saltos.length >= PROXIES_CONFIAVEIS) {
        return saltos[saltos.length - PROXIES_CONFIAVEIS].slice(0, 45)
    }

    const real = headers.get("x-real-ip")?.trim() ?? ""

    if (real) return real.slice(0, 45)

    // Quem não traz nada cai todo num balde só, e não ganha uma janela limpa
    // por requisição.
    return "sem-origem"
}

export interface Regra {
    /** Nome do balde. Rotas com o mesmo nome dividem a mesma contagem. */
    balde: string
    max: number
    janelaMs: number
}

const MINUTO = 60_000

/**
 * O teto de cada rota, do mais apertado para o mais folgado.
 *
 * Os números saem do uso real, não de um chute redondo: ninguém entra na
 * conta oito vezes em dez minutos sem estar chutando senha, e ninguém fecha
 * quinze pedidos em cinco minutos. Já a vitrine em si é folgada — uma pessoa
 * navegando dispara várias buscas por minuto, e um teto curto ali quebraria a
 * loja para quem só está comprando.
 */
export function regraDaRota(pathname: string, metodo = "GET"): Regra {

    // Escrever é mais caro do que ler, e é por onde se abusa: cada mensagem
    // de chat, avaliação ou cancelamento vira uma escrita no banco da loja. O
    // método entra na conta para a mesma rota poder ser folgada na leitura e
    // apertada na gravação.
    const escrevendo = metodo !== "GET" && metodo !== "HEAD"

    // Entrar e criar conta: é aqui que se chuta senha, e cada tentativa custa
    // um bcrypt no backend — caro para o servidor, barato para o atacante.
    if (pathname === "/api/conta/entrar" || pathname === "/api/conta/criar") {
        return { balde: "conta", max: 8, janelaMs: 10 * MINUTO }
    }

    // Consulta de pedido por código: seis dígitos são um milhão de
    // possibilidades, varredura de gente com paciência. Com este teto, tentar
    // metade do espaço leva séculos.
    if (pathname === "/api/pedido") {
        return { balde: "pedido-consulta", max: 10, janelaMs: 10 * MINUTO }
    }

    if (pathname === "/api/pedidos") {
        return { balde: "pedido-criar", max: 15, janelaMs: 5 * MINUTO }
    }

    if (pathname === "/api/pedido/verificar") {
        return { balde: "pedido-verificar", max: 20, janelaMs: 5 * MINUTO }
    }

    if (pathname === "/api/conta/sair") {
        return { balde: "sair", max: 20, janelaMs: 5 * MINUTO }
    }

    // O chat com a loja. A leitura é folgada porque a tela pergunta de cinco
    // em cinco segundos enquanto está aberta (doze por minuto, o dobro com
    // duas abas); a escrita é apertada porque cada mensagem grava no banco e
    // aparece na tela de quem atende.
    if (pathname === "/api/atendimento") {
        return escrevendo
            ? { balde: "chat-enviar", max: 30, janelaMs: 5 * MINUTO }
            : { balde: "chat-ler", max: 60, janelaMs: MINUTO }
    }

    // O aviso de "está digitando". Vem a cada duas teclas de intervalo
    // enquanto a pessoa escreve, então o teto é alto — e ainda assim existe,
    // porque a rota é pública e não pode ficar aberta a marteladas.
    if (pathname === "/api/atendimento/digitando") {
        return { balde: "chat-digitando", max: 90, janelaMs: MINUTO }
    }

    // Avaliar: uma por produto de cada pedido entregue. Ninguém de verdade
    // manda vinte em cinco minutos.
    if (pathname === "/api/avaliacoes" && escrevendo) {
        return { balde: "avaliar", max: 20, janelaMs: 5 * MINUTO }
    }

    // Direitos do titular (LGPD). Baixar os dados monta um dossiê inteiro no
    // backend — pedido caro, e ninguém legítimo pede de novo a cada segundo. A
    // exclusão acontece uma vez na vida da conta.
    if (pathname === "/api/meus-dados") {
        return escrevendo
            ? { balde: "dados-excluir", max: 5, janelaMs: 10 * MINUTO }
            : { balde: "dados-baixar", max: 6, janelaMs: 10 * MINUTO }
    }

    // Cancelar o próprio pedido: acontece uma vez, no máximo duas.
    if (pathname === "/api/pedido/cancelar") {
        return { balde: "pedido-cancelar", max: 10, janelaMs: 10 * MINUTO }
    }

    // Catálogo e banners: chamados a cada busca e a cada troca de categoria.
    if (pathname.startsWith("/api/")) {
        return { balde: "api", max: 90, janelaMs: MINUTO }
    }

    // Páginas. Cada uma custa uma renderização no servidor e ao menos uma
    // consulta ao backend, então o teto existe — só é largo o bastante para
    // não incomodar quem navega, nem uma casa inteira atrás do mesmo IP.
    return { balde: "pagina", max: 240, janelaMs: MINUTO }
}
