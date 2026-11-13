import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BRAND, DESCRIPTOR, SITE_URL } from "@/lib/seo/site";
import "./globals.css";

// Polices auto-hébergées (copiées de @fontsource) : aucun appel réseau à Google (RGPD).
// next/font/local : preload, font-display swap et police de repli aux métriques ajustées (pas de CLS au chargement).
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: "Arial",
});

const bricolage = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/bricolage-grotesque-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-bricolage",
  display: "swap",
  adjustFontFallback: "Arial",
});

const DEFAULT_TITLE = `${BRAND}, ${DESCRIPTOR}`;
const DEFAULT_DESCRIPTION =
  "Repéré mesure si ChatGPT, Gemini et Perplexity recommandent votre entreprise, montre pourquoi ils citent vos concurrents et fait le travail pour vous. Commerces, PME, e-commerce.";

export const metadata: Metadata = {
  // Jamais localhost : repli sur https://repere-ia.fr si NEXT_PUBLIC_SITE_URL manque (src/lib/seo/site.ts).
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: `%s | ${BRAND}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: BRAND,
  manifest: "/manifest.webmanifest",
  icons: {
    // favicon.ico est ajouté automatiquement (src/app/favicon.ico).
    icon: [{ url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: BRAND,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: BRAND, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3730A3",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-primary focus:shadow-lg"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
