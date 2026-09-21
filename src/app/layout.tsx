import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

/**
 * Poppins é a fonte de todo o produto — site público e painel.
 *
 * Antes o painel usava Geist e a landing, Poppins: duas famílias baixadas na
 * mesma sessão e duas linguagens visuais no mesmo produto. Unificar corta um
 * download e faz o painel parecer continuação do site, não outro sistema.
 * Para monoespaçado (protocolos, CNPJ) a pilha do sistema resolve sem baixar
 * nada.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ouvidoria",
  description: "Sistema de ouvidoria",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
