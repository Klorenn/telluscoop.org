import type { Metadata, Viewport } from "next";
import { Figtree, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { isProductionIndexable, SITE } from "@/lib/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["500"], display: "swap", preload: false });

const indexable = isProductionIndexable;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s | Tellus Cooperative" },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: "Tellus Cooperative — RSS" }] },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    title: SITE.title,
    description: SITE.description,
    url: "/",
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE.twitter,
    title: SITE.title,
    description: SITE.description,
    images: [SITE.ogImage],
  },
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#101010", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${figtree.variable} ${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:rounded">
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
