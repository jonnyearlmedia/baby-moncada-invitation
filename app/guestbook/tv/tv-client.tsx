"use client";

/* eslint-disable @next/next/no-img-element -- guest photos are public storage URLs rendered at their native 4:5 size. */

import { useEffect, useRef, useState } from "react";
import type { GuestbookEntry } from "@/lib/guestbook";
import { FRAME_HEIGHT, FRAME_WIDTH } from "@/lib/guestbook-frames";
import { SITE_CONFIG } from "@/lib/site-config";

const POLL_MS = 10_000;
const SLIDE_MS = 8_000;

export default function GuestbookTv() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [current, setCurrent] = useState<GuestbookEntry | null>(null);
  const seen = useRef(new Set<string>());
  const queue = useRef<GuestbookEntry[]>([]);
  const all = useRef<GuestbookEntry[]>([]);
  const cursor = useRef(0);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/guestbook", { cache: "no-store" });
        const body = await response.json() as { entries?: GuestbookEntry[] };
        if (!response.ok || !body.entries) return;
        const fresh = body.entries.filter((entry) => !seen.current.has(entry.id));
        if (seen.current.size > 0) queue.current.push(...fresh.reverse());
        for (const entry of body.entries) seen.current.add(entry.id);
        all.current = body.entries;
        setEntries(body.entries);
        setCurrent((shown) => shown ?? body.entries?.[0] ?? null);
      } catch { return; }
    }
    // Brand new entries jump the line; otherwise cycle through everything.
    function advance() {
      const next = queue.current.shift();
      if (next) { setCurrent(next); return; }
      if (!all.current.length) return;
      cursor.current = (cursor.current + 1) % all.current.length;
      setCurrent(all.current[cursor.current]);
    }
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), POLL_MS);
    const slide = window.setInterval(advance, SLIDE_MS);
    return () => { window.clearTimeout(first); window.clearInterval(poll); window.clearInterval(slide); };
  }, []);

  return <main className="gb-tv">
    <aside className="gb-tv-side">
      <p className="gb-script">sign the guestbook! ✈</p>
      <h1>{SITE_CONFIG.babyLabel}</h1>
      <p>Tap your phone on any tag around the room! Snap a pic, pick a frame, and leave {SITE_CONFIG.family.pluralLabel} some love.</p>
      <strong>{entries.length} {entries.length === 1 ? "entry" : "entries"}</strong>
    </aside>
    <section className="gb-tv-stage" aria-live="polite">
      {current ? <article key={current.id} className={`gb-tv-card${current.photoUrl ? "" : " no-photo"}`}>
        {current.photoUrl && <img src={current.photoUrl} alt={`${current.name} at the shower`} width={FRAME_WIDTH} height={FRAME_HEIGHT} />}
        <div><p>{current.message}</p><span>{current.signOff}</span><strong>{current.name}</strong></div>
      </article> : <p className="gb-tv-empty">The first entry will pop up right here!</p>}
    </section>
  </main>;
}
