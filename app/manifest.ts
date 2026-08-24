import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baby Moncada Baby Shower",
    short_name: "Baby Moncada",
    description: "Janelle and Fernando’s Baby Moncada baby shower invitation.",
    start_url: "/",
    display: "standalone",
    background_color: "#dcecf4",
    theme_color: "#dcecf4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
