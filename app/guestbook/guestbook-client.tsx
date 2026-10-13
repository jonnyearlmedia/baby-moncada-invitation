"use client";

/* eslint-disable @next/next/no-img-element -- guest photos are local blobs or public storage URLs rendered at their native 4:5 size. */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GUESTBOOK_MESSAGE_MAX, GUESTBOOK_NAME_MAX, GUESTBOOK_PHOTO_MAX_BYTES, GUESTBOOK_SIGN_OFFS, type GuestbookEntry, type GuestbookFrame, type GuestbookSignOff } from "@/lib/guestbook";
import { PHOTO_ALBUM_NAME, PHOTO_ALBUM_URL, REGISTRY_URL } from "@/lib/event-links";
import { FRAME_HEIGHT, FRAME_OPTIONS, FRAME_WIDTH, loadPhoto, renderFrame, type PhotoCrop } from "@/lib/guestbook-frames";
import PhotoPositioner, { clampCrop } from "./photo-positioner";

type Step = "welcome" | "photo" | "position" | "frame" | "write" | "wall";
// "party" and "any" both open the camera roll; they only differ in what they ask for.
type PhotoSource = "camera" | "party" | "any";
type Picked = { image: HTMLImageElement; url: string };
type Rendered = Partial<Record<GuestbookFrame, { blob: Blob; url: string }>>;

const POLL_MS = 15_000;
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

function useGuestbookEntries(active: boolean) {
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/guestbook", { cache: "no-store" });
      const body = await response.json() as { entries?: GuestbookEntry[]; error?: string };
      if (!response.ok || !body.entries) throw new Error(body.error ?? "The guestbook could not be loaded.");
      setEntries(body.entries);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The guestbook could not be loaded.");
    }
  }, []);
  useEffect(() => {
    if (!active) return;
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [active, load]);
  return { entries, setEntries, error, reload: load };
}

export default function GuestbookClient() {
  const [step, setStep] = useState<Step>("welcome");
  const [rendered, setRendered] = useState<Rendered>({});
  const [frame, setFrame] = useState<GuestbookFrame>("boarding");
  const [preparing, setPreparing] = useState<PhotoSource | null>(null);
  const [source, setSource] = useState<PhotoSource>("camera");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [crop, setCrop] = useState<PhotoCrop>({ x: 0.5, y: 0.45, zoom: 1 });
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [signOff, setSignOff] = useState<GuestbookSignOff>("Love,");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [justSigned, setJustSigned] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pendingSource = useRef<PhotoSource>("camera");
  const topRef = useRef<HTMLDivElement>(null);
  const { entries, setEntries, error: wallError } = useGuestbookEntries(step === "wall" || step === "welcome");

  const clearPhotos = useCallback(() => {
    setRendered((current) => {
      for (const item of Object.values(current)) if (item) URL.revokeObjectURL(item.url);
      return {};
    });
  }, []);

  const clearPicked = useCallback(() => {
    setPicked((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(() => () => { clearPhotos(); clearPicked(); }, [clearPhotos, clearPicked]);
  useEffect(() => { topRef.current?.scrollIntoView({ block: "start" }); }, [step]);

  function startEntry() {
    clearPhotos();
    clearPicked();
    setFrame("boarding");
    setName("");
    setMessage("");
    setSignOff("Love,");
    setError("");
    setJustSigned(null);
    setStep("photo");
  }

  function choosePhoto(next: PhotoSource) {
    pendingSource.current = next;
    (next === "camera" ? cameraRef : libraryRef).current?.click();
  }

  async function renderAll(image: HTMLImageElement, placement?: PhotoCrop) {
    const next: Rendered = {};
    for (const option of FRAME_OPTIONS) {
      const blob = await renderFrame(image, option.id, GUESTBOOK_PHOTO_MAX_BYTES, placement);
      next[option.id] = { blob, url: URL.createObjectURL(blob) };
    }
    clearPhotos();
    setRendered(next);
    setStep("frame");
  }

  // Camera shots are already framed by the guest, so they go straight to the
  // frames. Camera roll photos stop first so the guest can place themselves.
  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const from = pendingSource.current;
    setError("");
    setPreparing(from);
    try {
      if (from === "camera") {
        clearPicked();
        await renderAll(await loadPhoto(file));
      } else {
        const url = URL.createObjectURL(file);
        const image = new window.Image();
        image.src = url;
        try {
          await image.decode();
        } catch (decodeError) {
          URL.revokeObjectURL(url);
          throw decodeError;
        }
        clearPicked();
        setPicked({ image, url });
        setCrop(clampCrop({ x: 0.5, y: 0.45, zoom: 1 }, image.naturalWidth, image.naturalHeight));
        setStep("position");
      }
      setSource(from);
    } catch {
      setError(from === "camera" ? "That photo did not load. Try taking it again." : "That photo did not load. Try a different one.");
    } finally {
      setPreparing(null);
    }
  }

  async function placePhoto() {
    if (!picked) return;
    setError("");
    setPreparing(source);
    try {
      await renderAll(picked.image, crop);
    } catch {
      setError("That photo did not load. Try a different one.");
    } finally {
      setPreparing(null);
    }
  }

  function skipPhoto() {
    clearPhotos();
    setError("");
    setStep("write");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    const form = new FormData();
    form.set("name", name.trim());
    form.set("message", message.trim());
    form.set("signOff", signOff);
    form.set("frame", frame);
    const photo = rendered[frame];
    if (photo) form.set("photo", photo.blob, "photo.jpg");
    try {
      const response = await fetch("/api/guestbook", { method: "POST", body: form });
      const body = await response.json() as { entry?: GuestbookEntry; error?: string };
      if (!response.ok || !body.entry) throw new Error(body.error ?? "Your entry was not saved. Please try again.");
      const entry = body.entry;
      setEntries((current) => [entry, ...(current ?? []).filter((item) => item.id !== entry.id)]);
      setJustSigned(entry.id);
      clearPhotos();
      setStep("wall");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your entry was not saved. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const hasPhoto = Boolean(rendered[frame]);
  const fromLibrary = source !== "camera";
  const frameStep = fromLibrary ? 3 : 2;
  const count = entries?.length ?? 0;

  const photos = entries?.filter((entry) => entry.photoUrl).slice(0, 5) ?? [];

  return <main className="gb-page">
    <div className="gb-sky" aria-hidden="true">
      <span className="gb-cloud one" /><span className="gb-cloud two" /><span className="gb-cloud three" />
      <span className="gb-plane"><svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" /></svg></span>
    </div>
    <div ref={topRef} className="gb-shell">
      <header className="gb-topbar"><span>Moncada Airways</span><span className="gb-live"><i />Flt JF926</span></header>
      <input ref={cameraRef} className="gb-hidden-input" type="file" accept="image/*" capture="user" onChange={onPhoto} tabIndex={-1} aria-hidden="true" />
      <input ref={libraryRef} className="gb-hidden-input" type="file" accept="image/*" onChange={onPhoto} tabIndex={-1} aria-hidden="true" />

      {step === "welcome" && <section className="gb-screen gb-hero">
        <div className="gb-board" role="img" aria-label="Flight JF926 has arrived">
          <div className="gb-board-meta"><span>Flt JF926</span><span>From all over</span><span>Gate: Guestbook</span></div>
          <SplitFlap text="ARRIVED" />
        </div>
        <p className="gb-script">thank you for coming! ✈</p>
        <h1>So glad <em>you’re here!</em></h1>
        <figure className="gb-parents">
          <Image src="/guestbook-parents.jpg" alt="Janelle and Fernando smiling and holding up the ultrasound of their baby boy" width={1284} height={944} sizes="(max-width: 560px) 90vw, 480px" priority />
          <figcaption>Janelle, Fernando &amp; baby boy</figcaption>
        </figure>
        <p className="gb-lede">They are so happy you came! Leave the Moncadas a photo and a note they can keep forever.</p>
        <button className="gb-pass" onClick={startEntry}>
          <span className="gb-pass-main">
            <small>Boarding now</small>
            <strong>Sign the guestbook</strong>
            <span>Add a pic, pick a frame, leave some love!</span>
          </span>
          <span className="gb-pass-stub" aria-hidden="true">
            <small>Gate</small><b>GB</b>
            <small>Seat</small><b>Any</b>
            <i className="gb-barcode" />
          </span>
        </button>
        {photos.length > 0 && <button className="gb-strip" onClick={() => setStep("wall")}>
          <span className="gb-strip-photos" aria-hidden="true">{photos.map((entry) => <img key={entry.id} src={entry.photoUrl ?? ""} alt="" width={FRAME_WIDTH} height={FRAME_HEIGHT} loading="lazy" decoding="async" />)}</span>
          <span className="gb-strip-caption"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6Z" /><path d="M12 6v14.5" /></svg>Read the guestbook · {count} signed<i aria-hidden="true">›</i></span>
        </button>}
        {photos.length === 0 && <button className="gb-button" onClick={() => setStep("wall")}>Read the guestbook{count ? ` · ${count} ${count === 1 ? "entry" : "entries"}` : ""}</button>}
      </section>}

      {step === "welcome" && <nav className="gb-links" aria-label="More from today">
        <p className="gb-section-label">From the shower</p>
        <a href={PHOTO_ALBUM_URL} target="_blank" rel="noopener noreferrer">
          <span className="gb-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg></span>
          <span><strong>Add your photos!</strong><small>Drop everything you took at the shower into the {PHOTO_ALBUM_NAME} album! No Apple account needed.</small></span>
          <i aria-hidden="true">›</i>
        </a>
        <a href={REGISTRY_URL} target="_blank" rel="noopener noreferrer">
          <span className="gb-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13" /><path d="M12 8C10.5 4.5 6.5 3.5 6.5 6.2 6.5 8 12 8 12 8Zm0 0c1.5-3.5 5.5-4.5 5.5-1.8C17.5 8 12 8 12 8Z" /></svg></span>
          <span><strong>The registry</strong><small>Want to send something later? It’s all on Amazon!</small></span>
          <i aria-hidden="true">›</i>
        </a>
      </nav>}

      {step === "photo" && <section className="gb-screen">
        <StepHeader index={1} title="Pick your guestbook photo!" onBack={() => setStep("welcome")} />
        <div className="gb-entry-preview" aria-hidden="true">
          <span className="gb-entry-photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></svg><b>Your photo</b></span>
          <span className="gb-entry-note"><i /><i /><i /><b>Your note</b></span>
        </div>
        <p className="gb-lede">This photo goes on your page in the Moncadas&apos; guestbook, right next to your note.</p>
        <p className="gb-pick">Pick one</p>
        <div className="gb-options">
          <PhotoOption icon="party" title="A photo from the party" detail="Best if you’re in it! Not in any? Any shot from the shower works." busy={preparing === "party"} disabled={Boolean(preparing)} featured onClick={() => choosePhoto("party")} />
          <p className="gb-or" aria-hidden="true"><span>or</span></p>
          <PhotoOption icon="any" title="Any photo of you" detail="No party pics of you? Use a favorite from anywhere." busy={preparing === "any"} disabled={Boolean(preparing)} onClick={() => choosePhoto("any")} />
          <p className="gb-or" aria-hidden="true"><span>or</span></p>
          <PhotoOption icon="camera" title="Take one right now" detail="Snap a quick selfie with your camera." busy={preparing === "camera"} disabled={Boolean(preparing)} onClick={() => choosePhoto("camera")} />
        </div>
        {error && <p className="gb-error" role="alert">{error}</p>}
        <button className="gb-text-button" onClick={skipPhoto}>Skip the photo and just write a note</button>
      </section>}

      {step === "position" && picked && <section className="gb-screen">
        <StepHeader index={2} title="Line it up!" onBack={() => { clearPicked(); setStep("photo"); }} />
        <p className="gb-lede">Drag your photo to move it and pinch to zoom, so you are front and center.</p>
        <PhotoPositioner src={picked.url} width={picked.image.naturalWidth} height={picked.image.naturalHeight} crop={crop} onChange={setCrop} />
        {error && <p className="gb-error" role="alert">{error}</p>}
        <div className="gb-row">
          <button className="gb-button" onClick={() => choosePhoto(source)} disabled={Boolean(preparing)}>Pick another</button>
          <button className="gb-button primary" onClick={() => void placePhoto()} disabled={Boolean(preparing)}>{preparing ? "Framing…" : "Next"}</button>
        </div>
      </section>}

      {step === "frame" && <section className="gb-screen">
        <StepHeader index={frameStep} title="Pick your frame!" onBack={() => setStep(fromLibrary && picked ? "position" : "photo")} />
        {rendered[frame] && <img className="gb-preview" src={rendered[frame]?.url} alt={`You in the ${FRAME_OPTIONS.find((option) => option.id === frame)?.label} frame`} width={FRAME_WIDTH} height={FRAME_HEIGHT} />}
        <div className="gb-frames" role="radiogroup" aria-label="Photo frame">
          {FRAME_OPTIONS.map((option) => <button key={option.id} role="radio" aria-checked={frame === option.id} className={frame === option.id ? "selected" : ""} onClick={() => setFrame(option.id)}>
            {rendered[option.id] && <img src={rendered[option.id]?.url} alt="" width={FRAME_WIDTH} height={FRAME_HEIGHT} />}
            <span>{option.label}</span>
          </button>)}
        </div>
        <div className="gb-row">
          {fromLibrary && picked
            ? <button className="gb-button" onClick={() => setStep("position")}>Reposition</button>
            : <button className="gb-button" onClick={() => choosePhoto("camera")} disabled={Boolean(preparing)}>{preparing ? "Framing…" : "Retake"}</button>}
          <button className="gb-button primary" onClick={() => setStep("write")}>Next</button>
        </div>
      </section>}

      {step === "write" && <section className="gb-screen">
        <StepHeader index={hasPhoto ? frameStep + 1 : 2} title="Leave some love!" onBack={() => setStep(hasPhoto ? "frame" : "photo")} />
        <form className="gb-form" onSubmit={submit}>
          {hasPhoto && <img className="gb-thumb" src={rendered[frame]?.url} alt="You, framed" width={FRAME_WIDTH} height={FRAME_HEIGHT} />}
          <div className="gb-letter">
            <p className="gb-letter-greeting">Dear Moncada family,</p>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={GUESTBOOK_MESSAGE_MAX} placeholder="A wish for the little one, advice for the new parents, or just a big hello!" rows={7} aria-label="Your message" required />
            <small className="gb-letter-count">{message.length}/{GUESTBOOK_MESSAGE_MAX}</small>
            <div className="gb-signoffs" role="radiogroup" aria-label="Sign off">
              {GUESTBOOK_SIGN_OFFS.map((option) => <button key={option} type="button" role="radio" aria-checked={signOff === option} onClick={() => setSignOff(option)}>{option}</button>)}
            </div>
            <p className="gb-letter-signoff">{signOff}</p>
            <input className="gb-letter-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={GUESTBOOK_NAME_MAX} autoComplete="name" placeholder="Your name" aria-label="Your name" required />
          </div>
          {error && <p className="gb-error" role="alert">{error}</p>}
          <button className="gb-button primary" type="submit" disabled={sending || !name.trim() || !message.trim()}>{sending ? "Signing…" : "Sign the guestbook!"}</button>
        </form>
      </section>}

      {step === "wall" && justSigned && <Confetti key={justSigned} />}
      {step === "wall" && <section className="gb-screen gb-wall-screen">
        <div className="gb-wall-head">
          {justSigned ? <><p className="gb-script">you&apos;re in the book! ✈</p><h1>Signed, sealed, delivered!</h1></> : <><p className="gb-script">love notes for the Moncadas</p><h1>The guestbook</h1></>}
          <p className="gb-lede">{count ? `${count} ${count === 1 ? "entry" : "entries"} so far! New ones pop up live.` : "No entries yet. Be the first!"}</p>
          <div className="gb-row">
            <button className="gb-button primary" onClick={startEntry}>{justSigned ? "Add another entry!" : "Sign the guestbook!"}</button>
            <button className="gb-button" onClick={() => setStep("welcome")}>Back</button>
          </div>
          {count > 0 && <Link className="gb-text-button" href="/guestbook/book">Flip through it like a book ›</Link>}
        </div>
        {wallError && !entries && <p className="gb-error" role="alert">{wallError}</p>}
        {!entries && !wallError && <p className="gb-loading">Loading the guestbook…</p>}
        <div className="gb-wall">{entries?.map((entry) => <EntryCard key={entry.id} entry={entry} highlight={entry.id === justSigned} />)}</div>
      </section>}
    </div>
  </main>;
}

function SplitFlap({ text }: { text: string }) {
  return <span className="gb-flaps">{Array.from(text).map((character, index) => <b key={`${character}-${index}`} style={{ animationDelay: `${300 + index * 90}ms` }}>{character}</b>)}</span>;
}

const CONFETTI_COLORS = ["#f2c46d", "#fffdf8", "#8ec1e6", "#f4a7b9"];

function Confetti() {
  return <div className="gb-confetti" aria-hidden="true">{Array.from({ length: 42 }, (_, index) => <i key={index} style={{
    left: `${(index * 37) % 100}%`,
    background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    width: `${6 + (index % 3) * 3}px`,
    height: `${index % 2 ? 6 + (index % 3) * 3 : 14}px`,
    borderRadius: index % 5 === 0 ? "50%" : "2px",
    animationDelay: `${(index % 12) * 70}ms`,
    animationDuration: `${2200 + (index % 5) * 300}ms`,
  }} />)}</div>;
}

const OPTION_ICONS = {
  party: <><path d="M4 20 9 7l8 8-13 5Z" /><path d="M13 4c1 1 1 2.5 0 3.5M17 8c1.5-.5 3 0 3.5 1M15 3l.5 1.5M20 5l-1.2.8M19.5 13.5l-1.5-.3" /></>,
  any: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
};

function PhotoOption({ icon, title, detail, busy, disabled, featured = false, onClick }: { icon: keyof typeof OPTION_ICONS; title: string; detail: string; busy: boolean; disabled: boolean; featured?: boolean; onClick: () => void }) {
  return <button className={`gb-option${featured ? " featured" : ""}${busy ? " busy" : ""}`} onClick={onClick} disabled={disabled}>
    <span className="gb-option-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{OPTION_ICONS[icon]}</svg></span>
    <span><strong>{busy ? "Getting it ready…" : title}</strong><small>{detail}</small></span>
    <i aria-hidden="true">›</i>
  </button>;
}

function StepHeader({ index, title, onBack }: { index: number; title: string; onBack: () => void }) {
  return <div className="gb-step-header">
    <button className="gb-back" onClick={onBack} aria-label="Go back">‹</button>
    <div><span>Step {index}</span><h2>{title}</h2></div>
  </div>;
}

export function EntryCard({ entry, highlight = false }: { entry: GuestbookEntry; highlight?: boolean }) {
  return <article className={`gb-card${highlight ? " highlight" : ""}${entry.photoUrl ? "" : " no-photo"}`}>
    {highlight && <span className="gb-badge">Just signed!</span>}
    {entry.photoUrl && <img src={entry.photoUrl} alt={`${entry.name} at the shower`} width={FRAME_WIDTH} height={FRAME_HEIGHT} loading="lazy" decoding="async" />}
    <div className="gb-card-body">
      <time dateTime={entry.createdAt}>{timeFormatter.format(new Date(entry.createdAt))}</time>
      <p>{entry.message}</p>
      <footer><span>{entry.signOff}</span><strong>{entry.name}</strong></footer>
    </div>
  </article>;
}
