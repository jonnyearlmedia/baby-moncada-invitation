import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Caveat, Geist, Geist_Mono, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
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
  const title = "Baby Moncada Baby Shower · September 26, 2026";
  const description = "You’re invited to celebrate Janelle and Fernando at the Baby Moncada baby shower.";
  return {
    title,
    description,
    applicationName: "Baby Moncada",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Baby Moncada", statusBarStyle: "default" },
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    },
    openGraph: { title, description, type: "website", siteName: "Baby Moncada", images: [{ url: `${origin}/opengraph-image.png`, width: 1200, height: 630, alt: "Baby Moncada baby shower boarding pass invitation" }] },
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
