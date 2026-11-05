import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PriceFinder.md — Compară prețurile din Moldova",
  description: "Compară ofertele magazinelor și platformelor din Republica Moldova."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ro"><body>{children}</body></html>;
}
