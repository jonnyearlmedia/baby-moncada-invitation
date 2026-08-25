import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/dashboard/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Moncada Dashboard", statusBarStyle: "default" },
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
