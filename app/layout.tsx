import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Source Sans continua sendo a fonte do TEXTO: estreita, seca, feita para
// ser lida em tamanho pequeno — que é o que um card de produto é, quase
// inteiro. Nada de Geist, a fonte padrão do starter do Next.
const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

/**
 * A fonte dos TÍTULOS e dos PREÇOS.
 *
 * Duas famílias, e não uma, porque elas têm trabalhos diferentes. A vitrine
 * inteira era escrita numa grotesca neutra, e neutra é exatamente o que faz
 * uma loja parecer gerada por modelo: o visitante não consegue dizer se está
 * na loja da esquina ou num site montado em meia hora, porque a página não
 * tem voz nenhuma.
 *
 * A Bricolage Grotesque tem voz sem ser difícil de ler: é uma grotesca
 * moderna de contraste alto e terminações cortadas, desenhada para tamanho
 * grande. Ela aparece só onde o tamanho é grande — nome de seção, preço,
 * nome da loja —, e o corpo do texto continua na Source Sans. Misturar as
 * duas neste papel é o que dá ar de loja com identidade, e não de catálogo.
 *
 * Servida do nosso domínio: o next/font baixa a fonte na construção da
 * imagem e a guarda em /_next/static. Nada de fonts.googleapis.com em tempo
 * de visita — a CSP da vitrine fecha `font-src` em 'self' (ver
 * security/cabecalhos.ts) e uma fonte de fora simplesmente não carregaria.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

// Cada loja tem o próprio título, definido no layout de [loja]. O daqui só
// vale para as páginas fora de qualquer loja (a raiz e o 404 de endereço
// desconhecido).
export const metadata: Metadata = {
  title: "Vitrines",
  description: "Cada loja tem o seu endereço próprio.",
};

// Necessário para que o nonce de CSP gerado no proxy seja aplicado a cada
// requisição (páginas estáticas são geradas em build, sem acesso a ele).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${sourceSans.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
