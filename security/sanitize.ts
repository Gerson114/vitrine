// Sanitização de entradas do usuário no front-end. Não substitui a
// sanitização do backend (lib/security/sanitize no projeto Go) — só reduz
// ruído antes de mandar pro servidor.

const TAG_RE = /<[^>]*>/g
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
const SPACE_RE = /\s+/g

/** Remove tags HTML, caracteres de controle e espaços redundantes. */
export function sanitizeText(input: string): string {
    if (!input) return ""

    return input
        .replace(TAG_RE, "")
        .replace(CONTROL_RE, "")
        .trim()
        .replace(SPACE_RE, " ")
}
