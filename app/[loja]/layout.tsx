import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CartProvider } from "@/app/cart/cart-context"
import CartDrawer from "@/app/components/cart/cart-drawer"
import ChatDaLoja from "@/app/components/atendimento/chat"
import { LojaProvider } from "@/app/loja/loja-context"
import { ContaProvider } from "@/app/conta/conta-context"
import { buscarLojaServidor } from "@/lib/loja"
import { clienteLogado } from "@/lib/conta"
import { estiloDoTema } from "@/lib/tema"

// Tudo o que é vitrine vive sob /[loja]: a loja é resolvida uma vez aqui, e
// as páginas abaixo já recebem o contexto pronto. Endereço que não existe
// (ou loja sem o plano com site) para neste layout, com 404 — nenhuma
// consulta de catálogo chega a ser feita.
export async function generateMetadata({ params }: LayoutProps<"/[loja]">): Promise<Metadata> {

    const { loja: slug } = await params
    const loja = await buscarLojaServidor(slug)

    if (!loja) {
        return { title: "Loja não encontrada" }
    }

    /* O ícone da aba desta loja.

       Sem ele, toda vitrine do sistema aparecia na aba com o mesmo ícone de
       fábrica do Next — e o cliente com quatro abas abertas não achava a loja
       em que estava comprando. O endereço vem do tema (ver a Aparência, no
       painel) e já chega resolvido: loja sem ícone próprio recebe a logo.

       `sizes: "any"` porque a imagem é do lojista e pode ter qualquer
       dimensão — é o que diz ao navegador para usá-la em qualquer lugar em
       vez de procurar um tamanho que não existe. */
    const favicon = (loja.tema?.favicon_url ?? "").trim()

    return {
        // Sem ramo no título: esta vitrine serve loja de roupa, de eletro, de
        // perfumaria e de parafuso, e "Moda, calçados e acessórios" na aba de
        // uma loja de ventilador é o detalhe que denuncia página feita em
        // série. O nome da loja basta — é o que ela é.
        title: `${loja.nome} | Loja oficial`,

        ...(favicon
            ? { icons: { icon: [{ url: favicon, sizes: "any" }], apple: favicon } }
            : {}),

        description: `Compre com segurança na ${loja.nome}. Confira os produtos disponíveis, formas de pagamento e acompanhe seu pedido.`,
    }
}

export default async function LojaLayout({ children, params }: LayoutProps<"/[loja]">) {

    const { loja: slug } = await params
    const loja = await buscarLojaServidor(slug)

    if (!loja) notFound()

    // Quem está logado NESTA vitrine, lido do cookie httpOnly aqui no
    // servidor. A tela inteira (cabeçalho, carrinho) precisa saber disso, e
    // o navegador não pode ler o cookie — daí resolver aqui e descer.
    const cliente = await clienteLogado(loja.slug)

    return (
        // O carrinho é guardado por loja (ver CartProvider): quem visita duas
        // vitrines diferentes tem duas sacolas, e uma nunca vaza na outra.
        <LojaProvider loja={loja}>
            <ContaProvider cliente={cliente}>
            <CartProvider loja={loja.slug}>

                {/* As cores do lojista entram aqui, e não numa folha de estilo
                    gerada: são quatro variáveis num `style`, resolvidas no
                    servidor junto com o resto da página. A loja já chega
                    pintada — sem o pisca de aparecer preto-e-branco e trocar
                    de cor depois que o CSS carrega. */}
                <div style={estiloDoTema(loja.tema) as React.CSSProperties}>
                    {children}
                    <CartDrawer />

                    {/* O atendimento fica em todas as páginas da vitrine, e
                        não numa página de contato: a dúvida que derruba a
                        venda aparece na página do produto e no carrinho, não
                        em quem já foi procurar onde reclamar. */}
                    <ChatDaLoja />
                </div>

            </CartProvider>
            </ContaProvider>
        </LojaProvider>
    )
}
