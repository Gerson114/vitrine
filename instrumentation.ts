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
        throw new Error(
            `servidor não subiu: ${problemas.length} problema(s) de configuração (NODE_ENV=production)`
        )
    }

    console.warn(
        "Rodando em desenvolvimento: os avisos acima não impedem a subida, mas em produção impediriam."
    )
}
