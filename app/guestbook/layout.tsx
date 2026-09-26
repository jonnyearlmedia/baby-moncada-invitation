import type { Metadata } from "next";
import "./guestbook.css";

export const metadata: Metadata = {
  title: "Guestbook · Baby Moncada",
  description: "Leave Janelle, Fernando, and Baby Moncada a photo and a note.",
  robots: { index: false, follow: false },
};

export default function GuestbookLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
