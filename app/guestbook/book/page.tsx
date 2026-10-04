import type { Metadata } from "next";
import { listGuestbookEntries } from "@/lib/guestbook-store";
import { SITE_CONFIG } from "@/lib/site-config";
import GuestbookBook from "./book-client";
import "./book.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `The Guestbook · ${SITE_CONFIG.siteName}`,
  description: `Every photo and note left for ${SITE_CONFIG.hosts.displayName}, and ${SITE_CONFIG.babyLabel}.`,
  robots: { index: false, follow: false },
};

export default async function GuestbookBookPage() {
  let entries = null;
  try {
    // Oldest first, so the book reads in the order guests signed.
    entries = (await listGuestbookEntries()).reverse();
  } catch (error) {
    console.error("guestbook_book_load_failed", error);
  }
  return <GuestbookBook entries={entries} />;
}
