import { SITE_CONFIG } from "@/lib/site-config";

const sharedManifest = {
  description: `${SITE_CONFIG.hosts.displayName}’s ${SITE_CONFIG.siteName} baby shower.`,
  display: "standalone" as const,
  background_color: SITE_CONFIG.branding.backgroundColor,
  theme_color: SITE_CONFIG.branding.themeColor,
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function invitationManifest(slug: string) {
  const invitationPath = `/invite/${encodeURIComponent(slug)}`;

  return {
    ...sharedManifest,
    id: invitationPath,
    name: `${SITE_CONFIG.event.title} Invitation`,
    short_name: `${SITE_CONFIG.family.label.replace(" family", "")} Invite`,
    start_url: invitationPath,
    scope: "/",
  };
}

export function dashboardManifest() {
  return {
    ...sharedManifest,
    id: "/dashboard",
    name: `${SITE_CONFIG.siteName} Host Dashboard`,
    short_name: `${SITE_CONFIG.family.label.replace(" family", "")} Dashboard`,
    start_url: "/dashboard",
    scope: "/dashboard",
  };
}
