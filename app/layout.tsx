import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pricefinder.md"),
  title: {
    default: "PriceFinder.md — Compară prețurile din Moldova",
    template: "%s | PriceFinder.md",
  },
  description: "Descoperă și compară prețurile produselor din magazinele și platformele din Republica Moldova. Găsește oferta potrivită înainte să cumperi.",
  applicationName: "PriceFinder.md",
  openGraph: {
    title: "PriceFinder.md — Cumpără mai inteligent",
    description: "Compară ofertele magazinelor din Republica Moldova într-un singur loc.",
    siteName: "PriceFinder.md",
    locale: "ro_MD",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ro"><body>{children}</body></html>;
}
