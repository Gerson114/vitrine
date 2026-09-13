import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Source Sans é a fonte do site de referência (zattini.com.br) e é ela que
// dá o ar de loja de moda: estreita, seca, com pesos leves para as chamadas
// grandes. Nada de Geist — é a fonte padrão do starter do Next.
const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
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
      className={`${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
