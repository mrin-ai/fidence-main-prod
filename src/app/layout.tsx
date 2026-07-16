import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Web3Providers } from "@/components/providers/web3-providers";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import "./landing.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.payagent.co"),
  title: {
    default: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
    template: "%s · PayAgent",
  },
  description:
    "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
  applicationName: "PayAgent",
  authors: [{ name: "PayAgent" }],
  creator: "PayAgent",
  publisher: "PayAgent",
  keywords: [
    "PayAgent",
    "crypto payments",
    "payment links",
    "AI agent payments",
    "USDC",
    "merchant payments",
    "LCX",
  ],
  alternates: {
    canonical: "/",
    languages: { "en-US": "/", "x-default": "/" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    title: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
    description:
      "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
    url: "https://www.payagent.co",
    siteName: "PayAgent",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.payagent.co/payagent-og.png",
        width: 1200,
        height: 630,
        alt: "PayAgent – Instant Crypto Payments",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@lcx",
    creator: "@lcx",
    title: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
    description:
      "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
    images: ["https://www.payagent.co/payagent-og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
    shortcut: "/favicon/favicon.ico",
  },
  manifest: "/favicon/site.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookie = (await headers()).get("cookie");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "PayAgent",
              url: "https://www.payagent.co",
              description:
                "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
              publisher: {
                "@type": "Organization",
                name: "PayAgent",
                url: "https://www.payagent.co",
                logo: "https://www.payagent.co/favicon/favicon.svg",
              },
            }),
          }}
        />
        <Web3Providers cookie={cookie}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors closeButton />
        </Web3Providers>
      </body>
    </html>
  );
}
