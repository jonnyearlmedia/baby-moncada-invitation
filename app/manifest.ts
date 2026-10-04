import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_CONFIG.event.title,
    short_name: SITE_CONFIG.siteName,
    description: `${SITE_CONFIG.hosts.displayName}’s ${SITE_CONFIG.siteName} baby shower invitation.`,
    start_url: "/",
    display: "standalone",
    background_color: SITE_CONFIG.branding.backgroundColor,
    theme_color: SITE_CONFIG.branding.themeColor,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
