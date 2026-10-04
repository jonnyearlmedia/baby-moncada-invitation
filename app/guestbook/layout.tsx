import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/site-config";
import "./guestbook.css";

export const metadata: Metadata = {
  title: `Guestbook · ${SITE_CONFIG.siteName}`,
  description: `Leave ${SITE_CONFIG.hosts.displayName}, and ${SITE_CONFIG.babyLabel} a photo and a note.`,
  robots: { index: false, follow: false },
};

export default function GuestbookLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
