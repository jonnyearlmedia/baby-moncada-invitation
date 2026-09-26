"use client";

/* eslint-disable @next/next/no-img-element -- guest photos are public storage URLs shown as small moderation thumbnails. */

import { useCallback, useEffect, useState } from "react";
import type { GuestbookEntry } from "@/lib/guestbook";

export default function GuestbookModeration() {
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/guestbook", { cache: "no-store" });
    const body = await response.json() as { entries?: GuestbookEntry[]; error?: string };
    if (!response.ok || !body.entries) { setError(body.error ?? "Guestbook entries could not be loaded."); return; }
    setEntries(body.entries); setError("");
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  async function setHidden(entry: GuestbookEntry, hidden: boolean) {
    setBusy(entry.id); setError("");
    const response = await fetch("/api/admin/guestbook", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, hidden }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setError(body.error ?? "That change was not saved.");
    else setEntries((current) => current?.map((item) => item.id === entry.id ? { ...item, hidden } : item) ?? current);
    setBusy("");
  }

  const hiddenCount = entries?.filter((entry) => entry.hidden).length ?? 0;
  return <section className="admin-card guestbook-admin"><div className="section-heading"><div><p className="admin-kicker">Guestbook</p><h2>Photos and notes from the party</h2></div><span>{entries ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}${hiddenCount ? ` · ${hiddenCount} hidden` : ""}` : "Loading…"}</span></div>
    <p className="directory-help">Hidden entries disappear from the guestbook and the TV right away. Nothing is deleted, so you can bring one back.</p>
    <div className="copy-row"><a href="/guestbook" target="_blank" rel="noreferrer">Open guestbook</a><a href="/guestbook/tv" target="_blank" rel="noreferrer">Open TV mode</a></div>
    {error && <div className="admin-alert error" role="status">{error}</div>}
    {entries && !entries.length && <p className="empty-state">No entries yet.</p>}
    <div className="guestbook-admin-list">{entries?.map((entry) => <article key={entry.id} className={entry.hidden ? "hidden-entry" : ""}>
      {entry.photoUrl ? <img src={entry.photoUrl} alt="" width={1080} height={1350} loading="lazy" /> : <span aria-hidden="true">✎</span>}
      <div><strong>{entry.name}</strong><p>{entry.message}</p><time>{new Date(entry.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time></div>
      <button className={entry.hidden ? "admin-primary" : "admin-secondary"} disabled={busy === entry.id} onClick={() => void setHidden(entry, !entry.hidden)}>{entry.hidden ? "Show" : "Hide"}</button>
    </article>)}</div>
  </section>;
}
