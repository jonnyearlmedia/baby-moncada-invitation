import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/site-config";

export const metadata: Metadata = {
  manifest: "/dashboard/manifest.webmanifest",
  appleWebApp: { capable: true, title: `${SITE_CONFIG.family.label.replace(" family", "")} Dashboard`, statusBarStyle: "default" },
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
