"use client";

/* eslint-disable @next/next/no-img-element -- guest photos are public storage URLs rendered at their native 4:5 size. */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GuestbookEntry } from "@/lib/guestbook";
import { FRAME_HEIGHT, FRAME_WIDTH } from "@/lib/guestbook-frames";
import { SITE_CONFIG } from "@/lib/site-config";

const NO_ENTRIES: GuestbookEntry[] = [];
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

// Page 0 is the cover, pages 1..n are the guests, and n + 1 is the closing page.
export default function GuestbookBook({ entries }: { entries: GuestbookEntry[] | null }) {
  const list = entries ?? NO_ENTRIES;
  const last = list.length + 1;
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [indexOpen, setIndexOpen] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((next: number) => {
    const target = Math.max(0, Math.min(last, next));
    setDirection(target >= page ? 1 : -1);
    setPage(target);
    setIndexOpen(false);
    window.scrollTo({ top: 0 });
  }, [last, page]);

  // Keep the page in the address bar, so a refresh or a shared link lands in the same spot.
  useEffect(() => {
    const fromHash = Number(/^#p(\d+)$/.exec(window.location.hash)?.[1]);
    if (!fromHash) return;
    const timer = window.setTimeout(() => setPage(Math.min(last, fromHash)), 0);
    return () => window.clearTimeout(timer);
  }, [last]);
  useEffect(() => {
    window.history.replaceState(null, "", page ? `#p${page}` : window.location.pathname);
  }, [page]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIndexOpen(false);
      if (indexOpen) return;
      if (event.key === "ArrowRight") go(page + 1);
      if (event.key === "ArrowLeft") go(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, indexOpen, page]);

  // Warm up the neighboring photos so turning a page never shows a blank frame.
  useEffect(() => {
    for (const entry of [list[page], list[page - 2]]) {
      if (entry?.photoUrl) new window.Image().src = entry.photoUrl;
    }
  }, [list, page]);

  function onTouchEnd(event: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? 1 : -1));
  }

  const entry = page >= 1 && page <= list.length ? list[page - 1] : null;
  const label = page === 0 ? "Cover" : entry ? `${page} of ${list.length}` : "The end";

  return <main className="bk-page">
    <div className="bk-sky" aria-hidden="true" />
    <header className="bk-topbar">
      <Link href="/guestbook">‹ Guestbook</Link>
      <button onClick={() => window.print()}>Print or save PDF</button>
    </header>

    {!entries && <p className="bk-empty">The guestbook couldn’t be loaded. Refresh to try again.</p>}
    {entries && <div className="bk-stage" onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={onTouchEnd}>
      <div key={page} className={`bk-turn ${direction === 1 ? "forward" : "back"}`}>
        {page === 0 && <Cover count={list.length} onOpen={() => go(1)} />}
        {entry && <Spread entry={entry} number={page} />}
        {page === last && <Closing entries={list} onRestart={() => go(0)} />}
      </div>
    </div>}

    {entries && page > 0 && <nav className="bk-nav" aria-label="Pages">
      <button onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous page">‹</button>
      <button className="bk-nav-label" onClick={() => setIndexOpen(true)} aria-haspopup="dialog">{label}<small>All guests</small></button>
      <button onClick={() => go(page + 1)} disabled={page === last} aria-label="Next page">›</button>
    </nav>}

    {indexOpen && <div className="bk-index" role="dialog" aria-modal="true" aria-label="All guests">
      <button className="bk-index-backdrop" onClick={() => setIndexOpen(false)} aria-label="Close" tabIndex={-1} />
      <div className="bk-index-sheet">
        <div className="bk-index-head">
          <h2>Everyone in the book</h2>
          <button onClick={() => setIndexOpen(false)} aria-label="Close">×</button>
        </div>
        <div className="bk-index-grid">
          {list.map((item, index) => <button key={item.id} onClick={() => go(index + 1)} aria-current={page === index + 1 ? "page" : undefined}>
            {item.photoUrl ? <img src={item.photoUrl} alt="" width={FRAME_WIDTH} height={FRAME_HEIGHT} loading="lazy" decoding="async" /> : <span className="bk-index-cover">No. {index + 1}</span>}
            <b>{item.name}</b>
          </button>)}
        </div>
      </div>
    </div>}

    {/* The whole book, one guest per sheet, for printing or saving as a PDF. */}
    {entries && <div className="bk-print" aria-hidden="true">
      <Cover count={list.length} />
      {list.map((item, index) => <Spread key={item.id} entry={item} number={index + 1} />)}
      <Closing entries={list} />
    </div>}
  </main>;
}

function Cover({ count, onOpen }: { count: number; onOpen?: () => void }) {
  return <section className="bk-sheet bk-cover">
    <p className="bk-kicker">{SITE_CONFIG.guestbook.airlineName} · Flight log</p>
    <h1>Dear <em>{SITE_CONFIG.babyLabel}</em></h1>
    <p className="bk-cover-script">love notes from your baby shower</p>
    <figure className="bk-cover-photo">
      <Image src="/guestbook-parents.jpg" alt={`${SITE_CONFIG.hosts.displayName} holding up the ultrasound of their baby boy`} width={1284} height={944} sizes="(max-width: 560px) 80vw, 420px" priority />
    </figure>
    <p className="bk-cover-meta">{SITE_CONFIG.event.dateLabel} · {count} {count === 1 ? "letter" : "letters"}</p>
    {onOpen && <button className="bk-open" onClick={onOpen}>Open the book</button>}
  </section>;
}

function Spread({ entry, number }: { entry: GuestbookEntry; number: number }) {
  const size = entry.message.length > 320 ? " long" : entry.message.length < 120 ? " short" : "";
  return <article className={`bk-sheet bk-spread${entry.photoUrl ? "" : " no-photo"}`}>
    {entry.photoUrl && <div className="bk-leaf bk-leaf-photo">
      <figure><img src={entry.photoUrl} alt={`${entry.name} at the shower`} width={FRAME_WIDTH} height={FRAME_HEIGHT} decoding="async" /></figure>
    </div>}
    <div className="bk-leaf bk-leaf-letter">
      <header><span>No. {String(number).padStart(2, "0")}</span><time dateTime={entry.createdAt}>{timeFormatter.format(new Date(entry.createdAt))}</time></header>
      <p className="bk-greeting">Dear {SITE_CONFIG.family.label},</p>
      <p className={`bk-message${size}`}>{entry.message}</p>
      <footer><span>{entry.signOff}</span><strong>{entry.name}</strong></footer>
    </div>
  </article>;
}

function Closing({ entries, onRestart }: { entries: GuestbookEntry[]; onRestart?: () => void }) {
  return <section className="bk-sheet bk-closing">
    <p className="bk-kicker">Arrivals</p>
    <h2>Signed with love by</h2>
    <ul className="bk-signatures">{entries.map((entry) => <li key={entry.id}>{entry.name}</li>)}</ul>
    <p className="bk-closing-note">Welcome to the world, little one. You were loved long before you landed.</p>
    {onRestart && <button className="bk-open ghost" onClick={onRestart}>Back to the cover</button>}
  </section>;
}
