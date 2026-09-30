import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ABARC Orario Counter",
  description: "La storia delle versioni dell'orario ABARC."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">ABARC <span>ORARIO COUNTER</span></Link>
          <nav><Link href="/">Contatore</Link><Link href="/cronologia">Cronologia</Link></nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer"><span>Una cosa sola doveva restare ferma.</span><a href="https://www.abarc.it/totem/">Fonte: ABARC</a></footer>
      </body>
    </html>
  );
}
