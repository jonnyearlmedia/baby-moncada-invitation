"use client";

import { Anton } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PHOTO_ALBUM_URL, REGISTRY_URL } from "@/lib/event-links";
import { BABY_NAME, SHOWER_PHOTO, type ThankYouPostcard } from "@/lib/thank-you";
import PeelCorner from "./peel-corner";
import "./thank-you.css";

const blockLetters = Anton({ weight: "400", subsets: ["latin"], variable: "--font-postcard-block" });

const JANELLE_X = 0.51;

const FLIP_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 21v-5h-5" /></svg>;

export default function ThankYouPostcardPage({ postcard }: { postcard: ThankYouPostcard }) {
  const [flipped, setFlipped] = useState(false);
  const [touched, setTouched] = useState(false);
  const [viewing, setViewing] = useState(false);
  const frontRef = useRef<HTMLElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  function flip() {
    setTouched(true);
    setFlipped((current) => !current);
  }

  const paragraphs = postcard.note.split(/\n\s*\n|\n/).map((line) => line.trim()).filter(Boolean);

  return <main className={`ty-page ${blockLetters.variable}`}>
    <div className="ty-shell">
      <header className="ty-topbar"><span>Moncada Airways</span><span>Flt JF926 · Arrived</span></header>
      <p className="ty-script">a little something for you ✈</p>
      <h1 className="ty-title">Thank you, <em>{postcard.greeting}</em></h1>

      <div className={`ty-card${flipped ? " flipped" : ""}${touched ? "" : " untouched"}`} role="button" tabIndex={0} aria-pressed={flipped} aria-label={flipped ? "Postcard, showing the note. Flip to the front." : "Postcard, showing the front. Flip to read the note."}
        onClick={flip} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); flip(); } }}>
        <div className="ty-card-inner">
          <section ref={frontRef} className="ty-face ty-front" aria-hidden={flipped} inert={flipped}>
            <div ref={paperRef} className="ty-front-paper">
            <div className="ty-scene" aria-hidden="true">
              <span className="ty-sun" />
              <span className="ty-cloud one" /><span className="ty-cloud two" /><span className="ty-cloud three" />
              <span className="ty-plane"><svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" /></svg></span>
              <span className="ty-hills" />
            </div>
            <p className="ty-greetings">Greetings from</p>
            <p className="ty-letters"><span>Baby</span><span>Moncada</span></p>
            {SHOWER_PHOTO && <button type="button" className="ty-print" aria-label="See the whole shower photo" onClick={(event) => { event.stopPropagation(); setViewing(true); }}>
              <Image src={SHOWER_PHOTO.src} alt="Everyone at the shower, with Janelle in the middle" width={SHOWER_PHOTO.width} height={SHOWER_PHOTO.height} sizes="(max-width: 480px) 86vw, 400px" priority />
              <span className="ty-print-caption">the whole crew · tap to see everyone</span>
            </button>}
            <p className="ty-front-foot">Rohnert Park, CA · 09.26.26</p>
            <span className="ty-tap">{FLIP_ICON}Tap or peel the corner</span>
            </div>
            <PeelCorner faceRef={frontRef} paperRef={paperRef} active={!flipped} onTouch={() => setTouched(true)} onPeeled={flip} />
          </section>

          <section className="ty-face ty-back" aria-hidden={!flipped} inert={!flipped}>
            <div className="ty-back-paper">
              <header className="ty-back-head">
                <div><span className="ty-postcard-label">Post card</span><span className="ty-postcard-sub">Moncada Airways · Flt JF926</span></div>
                <div className="ty-postage"><Stamp /><Postmark /></div>
              </header>
              <div className="ty-letter">
                <p className="ty-dear">Dear {postcard.greeting},</p>
                {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                <p className="ty-sign">Love,<br />Janelle, Fernando &amp; {BABY_NAME}</p>
              </div>
              <div className="ty-address">
                <span className="ty-address-label">To</span>
                <p className="ty-address-name">{postcard.addressee}</p>
                <p>c/o Moncada Airways</p>
                <p>Flight JF926 · Arrived</p>
                {postcard.gift && <p className="ty-gift"><span>With thanks for</span>{postcard.gift}</p>}
              </div>
              <p className="ty-back-hint">Tap the card to see the front</p>
            </div>
          </section>
        </div>
      </div>
      <button className="ty-flip-button" onClick={flip}>{FLIP_ICON}{flipped ? "See the front" : "Flip it to read your note"}</button>

      <p className="ty-links-label">Before you go</p>
      <nav className="ty-links" aria-label="More from the shower">
        <Link href="/guestbook">
          <span className="ty-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg></span>
          <span><strong>Sign the guestbook</strong><small>Missed it at the party? Add a photo and a note anytime.</small></span>
          <i aria-hidden="true">›</i>
        </Link>
        <a href={PHOTO_ALBUM_URL} target="_blank" rel="noopener noreferrer">
          <span className="ty-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg></span>
          <span><strong>Help us fill our album</strong><small>We’re putting together an album of our special night, and so many moments happened where we couldn’t see them. If you took any photos, we’d be so grateful if you added them. No Apple account needed.</small></span>
          <i aria-hidden="true">›</i>
        </a>
        <a href={REGISTRY_URL} target="_blank" rel="noopener noreferrer">
          <span className="ty-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13" /><path d="M12 8C10.5 4.5 6.5 3.5 6.5 6.2 6.5 8 12 8 12 8Zm0 0c1.5-3.5 5.5-4.5 5.5-1.8C17.5 8 12 8 12 8Z" /></svg></span>
          <span><strong>Our registry</strong><small>Celebrating with us was already more than enough. If you’d still like to send something for Adrian John, our registry is open on Amazon.</small></span>
          <i aria-hidden="true">›</i>
        </a>
      </nav>
      <footer className="ty-foot">Moncada Airways · Next stop: {BABY_NAME}</footer>
      {viewing && SHOWER_PHOTO && <PhotoViewer src={SHOWER_PHOTO.src} width={SHOWER_PHOTO.width} height={SHOWER_PHOTO.height} onClose={() => setViewing(false)} />}
    </div>
  </main>;
}

// The group photo, full screen at a height where faces read, swiped sideways
// to find everyone. It opens centered on Janelle, who stands just right of
// the middle of the frame.
function PhotoViewer({ src, width, height, onClose }: { src: string; width: number; height: number; onClose: () => void }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const centerOnJanelle = () => {
    const strip = stripRef.current;
    if (strip) strip.scrollLeft = strip.scrollWidth * JANELLE_X - strip.clientWidth / 2;
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return <div className="ty-viewer" role="dialog" aria-modal="true" aria-label="The whole shower photo">
    <button className="ty-viewer-close" onClick={onClose} aria-label="Close the photo">×</button>
    <div ref={stripRef} className="ty-viewer-strip">
      <Image src={src} alt="Everyone at the shower" width={width} height={height} sizes="200vw" quality={90} onLoad={() => requestAnimationFrame(centerOnJanelle)} />
    </div>
    <p className="ty-viewer-hint">Swipe to find everyone ⟷</p>
  </div>;
}

// A commemorative stamp: perforated edge, a little sky, and his name.
function Stamp() {
  const holes: [number, number][] = [];
  for (let x = 0; x <= 96; x += 8) holes.push([x, 0], [x, 120]);
  for (let y = 8; y < 120; y += 8) holes.push([0, y], [96, y]);
  return <svg className="ty-stamp" viewBox="-4 -4 104 128" role="img" aria-label={`Stamp reading ${BABY_NAME}, Forever`}>
    <defs>
      <mask id="ty-perf"><rect x="-4" y="-4" width="104" height="128" fill="#fff" />{holes.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="#000" />)}</mask>
      <linearGradient id="ty-stamp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#183e5d" /><stop offset=".7" stopColor="#2f6a93" /><stop offset="1" stopColor="#e8b768" /></linearGradient>
    </defs>
    <g mask="url(#ty-perf)">
      <rect x="0" y="0" width="96" height="120" fill="#fffdf8" />
      <rect x="7" y="7" width="82" height="106" fill="url(#ty-stamp-sky)" />
      <circle cx="66" cy="78" r="13" fill="#f2c46d" />
      <path d="M14 88c8-6 16-6 24 0 6-4 12-4 18 0H14Z" fill="#fffdf8" opacity=".9" />
      <path d="M50 60c6-5 13-5 19 0 4-3 9-3 13 0H50Z" fill="#fffdf8" opacity=".75" />
      <g transform="translate(26 40) rotate(-18)" fill="#fffdf8"><path d="M0 4 22 0 8 6 22 10Z" /><path d="M8 6 6 12" stroke="#fffdf8" strokeWidth="1.4" /></g>
      <rect x="7" y="92" width="82" height="21" fill="#183e5d" />
      <text x="48" y="19" textAnchor="middle" className="ty-stamp-mono" fontSize="5.4" fill="#f2c46d">MONCADA AIRWAYS</text>
      <text x="48" y="104" textAnchor="middle" className="ty-stamp-serif" fontSize="11.5" fill="#fffdf8">{BABY_NAME}</text>
      <text x="48" y="110.5" textAnchor="middle" className="ty-stamp-mono" fontSize="4.6" fill="#f2c46d">FOREVER · 2026</text>
    </g>
  </svg>;
}

// The round cancellation, with wavy lines trailing off to the left.
function Postmark() {
  return <svg className="ty-postmark" viewBox="0 0 150 90" aria-hidden="true">
    <defs>
      <path id="ty-pm-top" d="M42 45a33 33 0 0 1 66 0" />
      <path id="ty-pm-bottom" d="M40 45a35 35 0 0 0 70 0" />
    </defs>
    <g fill="none" stroke="currentColor">
      {[0, 10, 20].map((y) => <path key={y} d={`M0 ${35 + y}q8-6 16 0t16 0t16 0`} strokeWidth="2" />)}
      <circle cx="75" cy="45" r="38" strokeWidth="2.6" />
      <circle cx="75" cy="45" r="26" strokeWidth="1.4" />
    </g>
    <g fill="currentColor" className="ty-stamp-mono">
      <text fontSize="7.4"><textPath href="#ty-pm-top" startOffset="50%" textAnchor="middle">MONCADA AIRWAYS</textPath></text>
      <text fontSize="7.4"><textPath href="#ty-pm-bottom" startOffset="50%" textAnchor="middle">ROHNERT PARK CA</textPath></text>
      <text x="75" y="43" fontSize="10" textAnchor="middle">SEP 26</text>
      <text x="75" y="55" fontSize="9" textAnchor="middle">2026</text>
    </g>
  </svg>;
}
