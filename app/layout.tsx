import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Caveat, Geist, Geist_Mono, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { SITE_CONFIG } from "@/lib/site-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ticketSerif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-ticket-serif" });
const ticketMono = IBM_Plex_Mono({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-ticket-mono" });
const ticketScript = Caveat({ weight: "600", subsets: ["latin"], variable: "--font-ticket-script" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = `${SITE_CONFIG.event.title} · ${SITE_CONFIG.event.dateLabel}`;
  const description = `You’re invited to celebrate ${SITE_CONFIG.hosts.displayName} at the ${SITE_CONFIG.siteName} baby shower.`;
  return {
    title,
    description,
    applicationName: SITE_CONFIG.siteName,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: SITE_CONFIG.siteName, statusBarStyle: "default" },
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    },
    openGraph: { title, description, type: "website", siteName: SITE_CONFIG.siteName, images: [{ url: `${origin}/opengraph-image.png`, width: 1200, height: 630, alt: `${SITE_CONFIG.siteName} baby shower boarding pass invitation` }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/twitter-image.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ticketSerif.variable} ${ticketMono.variable} ${ticketScript.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
