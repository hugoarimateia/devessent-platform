import type { Metadata, Viewport } from "next";
import { Inter, Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_CONFIG } from "@/config/site";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-orbitron",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0B0B0B",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.siteUrl),
  title:
    "DevEssent | Software House — Tecnologia essencial para negócios que evoluem",
  description: SITE_CONFIG.supportingCopy,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords: [
    "DevEssent",
    "Software House",
    "Desenvolvimento de Sites",
    "Sistemas sob Medida",
    "Landing Pages",
    "Catálogo Digital",
    "Agendamento Online",
    "Aplicações Web",
  ],
  openGraph: {
    title: "DevEssent — Tecnologia essencial para negócios que evoluem",
    description: SITE_CONFIG.supportingCopy,
    url: SITE_CONFIG.siteUrl,
    siteName: "DevEssent",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/images/astronaut-hero.png",
        width: 770,
        height: 504,
        alt: "DevEssent — Software House",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DevEssent — Software House",
    description: SITE_CONFIG.supportingCopy,
    images: ["/images/astronaut-hero.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.siteUrl,
  description: SITE_CONFIG.supportingCopy,
  logo: `${SITE_CONFIG.siteUrl}/brand/devessent-logo.png`,
  areaServed: "BR",
  knowsAbout: [
    "Desenvolvimento de Sites",
    "Landing Pages",
    "Sistemas Web sob Medida",
    "Plataformas Comerciais",
    "Automação de Processos",
    "Integrações de APIs",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${spaceGrotesk.variable} ${orbitron.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
      </head>
      <body className="de-space-backdrop flex min-h-screen flex-col">
        {children}
      </body>
    </html>
  );
}
