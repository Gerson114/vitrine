// Gancho de subida do Next: roda uma vez, antes de o servidor atender a
// primeira requisição (ver node_modules/next/dist/docs → instrumentation).
//
// Serve para uma coisa só: conferir a configuração antes de a vitrine existir
// para alguém. É o par do que o backend Go faz no main (ver
// lib/security/ambiente) e do que o painel já fazia — e a falta dele aqui era
// como API_URL=http://localhost:8080, correta na máquina de quem desenvolve,
// podia ir junto para produção sem nada reclamar.

import { conferir, ehProducao } from "@/security/ambiente"

export function register() {

    const problemas = conferir()

    if (problemas.length === 0) return

    const marca = ehProducao() ? "ERRO DE SEGURANÇA" : "AVISO DE SEGURANÇA"

    for (const problema of problemas) {
        console.error(`${marca}: ${problema.variavel}: ${problema.mensagem} (correção: ${problema.correcao})`)
    }

    if (ehProducao()) {

        // Derruba a subida de propósito. Uma vitrine fora do ar é um problema
        // visível, que alguém conserta em minutos; uma vitrine no ar falando
        // com o serviço errado é um problema invisível.
        //
        // Encerrar o processo, e não só lançar: o Next CAPTURA o que este
        // gancho lança, escreve "An error occurred while loading instrumentation
        // hook" e continua escutando a porta, respondendo 500 a tudo. Um
        // container assim passa por um healthcheck de TCP e fica de pé
        // indefinidamente servindo erro — que é o "problema invisível" que este
        // arquivo existe para não deixar acontecer. Código de saída diferente de
        // zero é o que o Docker e o Compose leem como "subiu errado".
        const mensagem =
            `servidor não subiu: ${problemas.length} problema(s) de configuração (NODE_ENV=production)`

        console.error(mensagem)

        // Este arquivo é empacotado para os DOIS runtimes, porque existe um
        // proxy (ver proxy.ts) e ele roda no Edge, onde não há `process.exit`.
        // Daí a conferência do runtime — e daí a leitura por Reflect.get: com a
        // chamada escrita direto, o empacotador a encontra na análise estática e
        // reclama de API do Node no bundle do Edge, mesmo dentro deste `if`.
        if (process.env.NEXT_RUNTIME === "nodejs") {

            const encerrar = Reflect.get(process, "exit") as ((codigo: number) => never) | undefined

            encerrar?.(1)
        }

        // No Edge, onde não se pode encerrar o processo, lançar é o que existe.
        throw new Error(mensagem)
    }

    console.warn(
        "Rodando em desenvolvimento: os avisos acima não impedem a subida, mas em produção impediriam."
    )
}
