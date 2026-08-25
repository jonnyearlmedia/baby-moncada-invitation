const sharedManifest = {
  description: "Janelle and Fernando’s Baby Moncada baby shower.",
  display: "standalone" as const,
  background_color: "#dcecf4",
  theme_color: "#dcecf4",
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
    name: "Baby Moncada Baby Shower Invitation",
    short_name: "Moncada Invite",
    start_url: invitationPath,
    scope: "/",
  };
}

export function dashboardManifest() {
  return {
    ...sharedManifest,
    id: "/dashboard",
    name: "Baby Moncada Host Dashboard",
    short_name: "Moncada Dashboard",
    start_url: "/dashboard",
    scope: "/dashboard",
  };
}
