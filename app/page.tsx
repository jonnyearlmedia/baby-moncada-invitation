"use client";

/* eslint-disable @next/next/no-img-element -- Amazon supplies live, variable registry image URLs; native lazy loading keeps the list resilient when an item image changes. */

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { barcodePattern, confirmationCode } from "@/lib/pass-code";
import type { EventSettings } from "@/lib/invitation-types";

const BOOKING_URL = "https://www.hilton.com/en/hotels/stsrhup-hotel-centro-sonoma-wine-country/?SEO_id=GMB-AMER-UP-STSRHUP";
const FALLBACK_RSVP_DEADLINE = "2026-09-11";
const REGISTRY_URL = "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ";
const HOTEL_ADDRESS = "5870 Labath Ave, Rohnert Park, CA 94928";
const EVENT_ROOM = "The Reunion Room";
const PHOTO_ALBUM_URL = "https://photos.icloud.com/shared/album/0eccWFCNcNKvZ0UPIb95aAiwg";
const PHOTO_ALBUM_NAME = "Janelle & Fernando\u2019s Baby Shower";
const HOTEL_APPLE_MAPS = "https://maps.apple.com/?daddr=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&dirflg=d";
const HOTEL_GOOGLE_MAPS = "https://www.google.com/maps/dir/?api=1&destination=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&travelmode=driving&dir_action=navigate";
const HOTEL_WAZE = "https://waze.com/ul?q=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&navigate=yes";
const HOTEL_MAP_EMBED = "https://www.openstreetmap.org/export/embed.html?bbox=-122.7305%2C38.3456%2C-122.7105%2C38.3577&layer=mapnik&marker=38.3516523%2C-122.7205662";

const EVENT_TIME_ZONE = "America/Los_Angeles";
const EVENT_START_ISO = "2026-09-26T23:00:00.000Z";
const BOARDING_WINDOW_MS = 3600000;
const EVENT_DURATION_MS = 18000000;
const CONTACT_PHONE = "+17073345988";

const NAV_ITEMS = {
  invite: { icon: "home", label: "Invite", dayLabel: "Today" },
  stay: { icon: "hotel", label: "Hotel", dayLabel: "Hotel" },
  registry: { icon: "gift", label: "Registry", dayLabel: "Registry" },
  maps: { icon: "pin", label: "Travel", dayLabel: "Travel" },
  rsvp: { icon: "check", label: "RSVP", dayLabel: "RSVP" },
} as const;

const SCHEDULED_NAV = ["invite", "stay", "registry", "maps", "rsvp"] as const;
const DAY_OF_NAV = ["invite", "maps", "registry", "rsvp", "stay"] as const;

type View = keyof typeof NAV_ITEMS;
type IconName = (typeof NAV_ITEMS)[View]["icon"] | "calendar";
type Phase = "scheduled" | "today" | "boarding" | "inflight" | "landed";
type Countdown = ReturnType<typeof getCountdown>;
type RegistryOffer = { id: string | number; store: string; url: string; price: number | null; isRegistry: boolean; availability: string | null; availabilityText: string | null };
type RegistryItem = { id: string | number; title: string; image: string; category: string; price: string | null; quantity: number; quantityNeeded: number; isFulfilled: boolean; reservedCount: number; offers: RegistryOffer[] };
type RegistryState = { status: "loading" | "ready" | "handoff" | "error"; items: RegistryItem[]; updatedAt: string | null; refreshState: "current" | "refreshing" };
type Overlay = { type: "gift"; item: RegistryItem } | null;
type Attendance = "yes" | "no" | null;
type RSVP = {
  canonicalSlug: string;
  household: string;
  invitationLabel: string;
  messageGreeting: string;
  guests: { id: string; name: string; response: Attendance }[];
  note: string;
  submitted: boolean;
  updatedAt: string | null;
  status: "loading" | "ready" | "saving" | "error";
  error: string | null;
  event: EventSettings | null;
};

const eventDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

function getCountdown(startsAt: number, now: number) {
  const difference = Math.max(0, startsAt - now);
  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference % 86400000) / 3600000),
    minutes: Math.floor((difference % 3600000) / 60000),
    seconds: Math.floor((difference % 60000) / 1000),
  };
}

function getPhase(startsAt: number, now: number): Phase {
  if (now >= startsAt + EVENT_DURATION_MS) return "landed";
  if (now >= startsAt + BOARDING_WINDOW_MS) return "inflight";
  if (now >= startsAt) return "boarding";
  return eventDayFormatter.format(now) === eventDayFormatter.format(startsAt) ? "today" : "scheduled";
}

function formatNameList(names: string[]) {
  if (names.length < 2) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function ExternalLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return <a className={`phone-action${primary ? " primary" : ""}`} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === "home" && <path d="M3 11 20 4 13 21 11 14 3 11Z" />}
    {name === "hotel" && <><path d="M4 3h16v18H4z" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M9 21v-5h6v5" /></>}
    {name === "gift" && <><path d="M4 9h16v12H4z" /><path d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M12 4v17M4 14h16" /></>}
    {name === "pin" && <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
    {name === "check" && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></>}
    {name === "calendar" && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>}
  </svg>;
}

export default function Home({ inviteSlug = "murao" }: { inviteSlug?: string }) {
  const [view, setView] = useState<View>("invite");
  const [category, setCategory] = useState("All");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(true);
  const [registry, setRegistry] = useState<RegistryState>({ status: "loading", items: [], updatedAt: null, refreshState: "current" });
  const appPageRef = useRef<HTMLElement>(null);
  const phoneContentRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState<{ phase: Phase; countdown: Countdown }>({ phase: "scheduled", countdown: { days: 0, hours: 0, minutes: 0, seconds: 0 } });
  const [rsvp, setRsvp] = useState<RSVP>({ canonicalSlug: inviteSlug, household: "", invitationLabel: "", messageGreeting: "", guests: [], note: "", submitted: false, updatedAt: null, status: "loading", error: null, event: null });

  useEffect(() => {
    const appPage = appPageRef.current;
    if (!appPage) return;

    const visualViewport = window.visualViewport;
    let animationFrame = 0;
    const updateVisibleHeight = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const visibleHeight = Math.round(visualViewport?.height ?? window.innerHeight);
        appPage.style.setProperty("--invitation-viewport-height", `${visibleHeight}px`);
      });
    };

    updateVisibleHeight();
    visualViewport?.addEventListener("resize", updateVisibleHeight);
    visualViewport?.addEventListener("scroll", updateVisibleHeight);
    window.addEventListener("resize", updateVisibleHeight);
    window.addEventListener("orientationchange", updateVisibleHeight);
    window.addEventListener("pageshow", updateVisibleHeight);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      visualViewport?.removeEventListener("resize", updateVisibleHeight);
      visualViewport?.removeEventListener("scroll", updateVisibleHeight);
      window.removeEventListener("resize", updateVisibleHeight);
      window.removeEventListener("orientationchange", updateVisibleHeight);
      window.removeEventListener("pageshow", updateVisibleHeight);
      appPage.style.removeProperty("--invitation-viewport-height");
    };
  }, []);

  const startsAt = useMemo(() => {
    const configured = rsvp.event ? Date.parse(rsvp.event.startsAt) : Number.NaN;
    return Number.isNaN(configured) ? Date.parse(EVENT_START_ISO) : configured;
  }, [rsvp.event]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setClock({ phase: getPhase(startsAt, now), countdown: getCountdown(startsAt, now) });
    };
    const initialFrame = window.requestAnimationFrame(tick);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(timer);
    };
  }, [startsAt]);

  useEffect(() => {
    let active = true;
    async function loadRSVP() {
      try {
        const response = await fetch(`/api/rsvp?slug=${encodeURIComponent(inviteSlug)}`, { cache: "no-store" });
        const data = await response.json() as Omit<RSVP, "status" | "error"> & { error?: string };
        if (!response.ok) throw new Error(data.error || "RSVP unavailable");
        if (!active) return;
        setRsvp({ ...data, status: "ready", error: null });
        const deadline = new Date(`${data.event?.rsvpDeadline ?? FALLBACK_RSVP_DEADLINE}T23:59:59-07:00`).getTime();
        setDeadlinePassed(Number.isNaN(deadline) || deadline <= Date.now());
      } catch {
        if (active) setRsvp((current) => ({ ...current, status: "error", error: "We couldn’t load this invitation. Please try again." }));
      }
    }
    loadRSVP();
    return () => { active = false; };
  }, [inviteSlug]);

  useEffect(() => {
    let active = true;
    async function loadRegistry() {
      try {
        const response = await fetch("/api/registry");
        if (!response.ok) throw new Error("Registry refresh failed");
        const data = await response.json() as { mode?: "handoff"; items?: RegistryItem[]; updatedAt?: string; refreshState?: "current" | "refreshing" };
        if (active && data.mode === "handoff") setRegistry({ status: "handoff", items: [], updatedAt: null, refreshState: "current" });
        else if (active) setRegistry({ status: "ready", items: data.items ?? [], updatedAt: data.updatedAt ?? null, refreshState: data.refreshState ?? "current" });
      } catch {
        if (active) setRegistry({ status: "error", items: [], updatedAt: null, refreshState: "current" });
      }
    }
    loadRegistry();
    return () => { active = false; };
  }, []);

  const visibleProducts = useMemo(() => category === "All" ? registry.items : registry.items.filter((product) => product.category === category), [category, registry.items]);
  function changeView(next: View) {
    setView(next);
    setOverlay(null);
    if (phoneContentRef.current) phoneContentRef.current.scrollTop = 0;
  }

  async function saveRSVP() {
    setRsvp((current) => ({ ...current, status: "saving", error: null }));
    try {
      const response = await fetch(`/api/rsvp?slug=${encodeURIComponent(inviteSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: rsvp.guests.map(({ id, response }) => ({ id, response })), note: rsvp.note }),
      });
      const data = await response.json() as Omit<RSVP, "status" | "error"> & { error?: string };
      if (!response.ok) throw new Error(data.error || "RSVP was not saved");
      setRsvp({ ...data, status: "ready", error: null });
    } catch {
      setRsvp((current) => ({ ...current, status: "error", error: "Your response wasn’t saved. Check your connection and try again." }));
    }
  }

  function downloadCalendar() {
    const calendar = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Baby Moncada//Invitation//EN", "BEGIN:VEVENT",
      "UID:baby-moncada-20260926", "DTSTART;TZID=America/Los_Angeles:20260926T160000",
      "SUMMARY:Baby Moncada Baby Shower", `LOCATION:${HOTEL_ADDRESS}`,
      `DESCRIPTION:Join Janelle and Fernando for the Baby Moncada baby shower in the Reunion Room at Hotel Centro Sonoma Wine Country. Attire is casual. Diaper raffle: bring a pack of diapers in size 2 or larger for a chance to win a prize.`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    link.download = "baby-moncada.ics";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const { phase, countdown } = clock;
  const dayOf = phase !== "scheduled";
  const navOrder = dayOf ? DAY_OF_NAV : SCHEDULED_NAV;

  return (
    <main className="app-page" ref={appPageRef}>
      <section className="phone boarding-pass" data-phase={phase} aria-label="Baby Moncada invitation">
        <div className="phone-content" ref={phoneContentRef}>
          {view === "invite" && <InviteScreen phase={phase} countdown={countdown} rsvp={rsvp} deadlinePassed={deadlinePassed} onRSVP={() => changeView("rsvp")} onCalendar={downloadCalendar} />}
          {view === "stay" && <StayScreen bookingUrl={BOOKING_URL} phase={phase} />}
          {view === "registry" && <RegistryScreen category={category} setCategory={setCategory} products={visibleProducts} registry={registry} onGift={(item) => setOverlay({ type: "gift", item })} />}
          {view === "maps" && <MapsScreen phase={phase} countdown={countdown} />}
          {view === "rsvp" && <RSVPScreen rsvp={rsvp} setRsvp={setRsvp} deadlinePassed={deadlinePassed} phase={phase} onSave={saveRSVP} />}
        </div>
        <nav className="phone-nav" aria-label="Invitation features">
          {navOrder.map((key) => <button key={key} className={view === key ? "selected" : ""} aria-current={view === key ? "page" : undefined} onClick={() => changeView(key)}><span className="nav-icon"><Icon name={NAV_ITEMS[key].icon} />{key === "rsvp" && rsvp.submitted && <i aria-hidden="true" />}</span>{dayOf ? NAV_ITEMS[key].dayLabel : NAV_ITEMS[key].label}</button>)}
        </nav>
        {overlay && <HandoffSheet overlay={overlay} onClose={() => setOverlay(null)} />}
      </section>
    </main>
  );
}

const PHASE_COPY: Record<Phase, { stamp: string; status: string; note: string; script: string }> = {
  scheduled: { stamp: "ON TIME", status: "ON TIME", note: "Boarding pass issued", script: "the little one is coming \u2708" },
  today: { stamp: "TODAY", status: "BOARDING SOON", note: "Doors open at 4:00 PM", script: "today is the day \u2708" },
  boarding: { stamp: "BOARDING", status: "NOW BOARDING", note: "Come on in. We are in the Reunion Room.", script: "we are boarding \u2708" },
  inflight: { stamp: "IN FLIGHT", status: "IN FLIGHT", note: "The shower is underway. Late arrivals still welcome.", script: "wheels up \u2708" },
  landed: { stamp: "ARRIVED", status: "ARRIVED", note: "Thank you for flying Moncada Airways", script: "thank you for coming \u2708" },
};

function SplitFlap({ text }: { text: string }) {
  return <span className="split-flap">
    <span className="flap-text">{text}</span>
    {Array.from(text).map((character, index) => <b key={`${text}-${index}`} aria-hidden="true" style={{ animationDelay: `${index * 40}ms` }}>{character === " " ? "\u00a0" : character}</b>)}
  </span>;
}

function DepartureBoard({ phase, countdown }: { phase: Phase; countdown: Countdown }) {
  const copy = PHASE_COPY[phase];
  const hours = countdown.days * 24 + countdown.hours;
  return <section className="departure-board" data-phase={phase} aria-label={`Flight status ${copy.status}`}>
    <div className="board-head"><span>Moncada Airways</span><span>Flt JF926</span></div>
    <dl className="board-grid">
      <div><dt>Destination</dt><dd>Hotel Centro, Rohnert Park</dd></div>
      <div><dt>Departs</dt><dd>4:00 PM</dd></div>
      <div><dt>Gate</dt><dd>{EVENT_ROOM}</dd></div>
    </dl>
    <p className="board-status"><i aria-hidden="true" /><SplitFlap text={copy.status} /></p>
    {phase === "today" && <div className="board-clock" aria-label={`${hours} hours ${countdown.minutes} minutes until boarding`}>
      {([["Hrs", hours], ["Min", countdown.minutes], ["Sec", countdown.seconds]] as const).map(([label, value]) => <div key={label}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}
    </div>}
    <p className="board-note">{copy.note}</p>
  </section>;
}

function MapActions() {
  return <div className="day-of-actions">
    <ExternalLink href={HOTEL_APPLE_MAPS} primary>Apple Maps</ExternalLink>
    <ExternalLink href={HOTEL_GOOGLE_MAPS} primary>Google Maps</ExternalLink>
    <ExternalLink href={HOTEL_WAZE} primary>Waze</ExternalLink>
  </div>;
}

function DayOfActions({ phone }: { phone: string }) {
  return <>
    <MapActions />
    <div className="day-of-contact">
      <a className="phone-action" href={`sms:${phone}`}>Text Janelle</a>
      <a className="phone-action" href={`tel:${phone}`}>Call Janelle</a>
    </div>
  </>;
}

function ArrivalGuide() {
  return <section className="arrival-guide" aria-label="When you arrive">
    <h3>When you arrive&#8230;</h3>
    <Image
      className="arrival-map"
      src="/arrival-map.png"
      alt="Ground floor plan. A red arrow leaves the entrance at the bottom left, runs up into the lobby, then right across the lobby to a small pre function room that opens into the room marked Janelle and Fernando&#8217;s Baby Shower."
      width={1448}
      height={1086}
      sizes="(max-width: 480px) 100vw, 430px"
    />
    <ol>
      <li><span aria-hidden="true">01</span><div><strong>Park on site</strong><p>Hilton currently lists parking at $8 per day.</p></div></li>
      <li><span aria-hidden="true">02</span><div><strong>In the main entrance</strong><p>Straight ahead into the lobby.</p></div></li>
      <li><span aria-hidden="true">03</span><div><strong>Turn right and cross the lobby</strong><p>Follow it all the way to the far end.</p></div></li>
      <li><span aria-hidden="true">04</span><div><strong>Through the pre function room</strong><p>The small room just before the space.</p></div></li>
      <li><span aria-hidden="true">05</span><div><strong>The Reunion Room</strong><p>Janelle and Fernando&#8217;s Baby Shower.</p></div></li>
    </ol>
  </section>;
}

function PhotoAlbumCard({ phase, phone }: { phase: Phase; phone: string }) {
  const line = phase === "landed"
    ? "The album stays open. Add yours whenever you get to them."
    : phase === "today"
      ? "Everything from today lands in one album. Open it, join, and add the ones you take."
      : "Add your photos as you go. Everyone in the album sees them.";
  return <section className="album-card" aria-label="Shared photo album">
    <span>Shared album</span>
    <strong>{PHOTO_ALBUM_NAME}</strong>
    <p>{line}</p>
    <ExternalLink href={PHOTO_ALBUM_URL} primary>Add your photos</ExternalLink>
    <small>Anyone with the link can join and post. No Apple account needed, and it works on Android and in a browser. Stuck? <a href={`sms:${phone}`}>Text Janelle</a>.</small>
  </section>;
}

function DayOfStatus({ phase, rsvp }: { phase: Phase; rsvp: RSVP }) {
  const attending = rsvp.guests.filter((guest) => guest.response === "yes").length;
  if (phase === "landed") return <div className="rsvp-deadline confirmed day-of-status">
    <span>Flight complete</span>
    <strong>Thank you for celebrating</strong>
    <p>Baby Moncada is due November 25, 2026. The registry stays open if you still want to send something.</p>
  </div>;
  if (!rsvp.submitted) return <div className="rsvp-deadline day-of-status urgent">
    <span>No reply on file</span>
    <strong>Come anyway</strong>
    <p>We never heard back, but there is a seat with your name on it. Send Janelle a text if you are on your way.</p>
  </div>;
  if (attending === 0) return <div className="rsvp-deadline confirmed day-of-status">
    <span>Reply received</span>
    <strong>We will miss you today</strong>
    <p>Thank you for letting us know. The registry stays open all the same.</p>
  </div>;
  return <div className="rsvp-deadline confirmed day-of-status">
    <span>Checked in</span>
    <strong>Party of {attending}, boarding at 4:00 PM</strong>
    <p>{phase === "today" ? "See you in the Reunion Room." : "We are already in the Reunion Room. Come find us."}</p>
  </div>;
}

function InviteScreen({ phase, countdown, rsvp, deadlinePassed, onRSVP, onCalendar }: { phase: Phase; countdown: Countdown; rsvp: RSVP; deadlinePassed: boolean; onRSVP: () => void; onCalendar: () => void }) {
  const [shareLabel, setShareLabel] = useState("Share invite");
  async function shareInvite() {
    try {
      if (navigator.share) await navigator.share({ title: "Baby Moncada Baby Shower", text: "You\u2019re invited to Janelle and Fernando\u2019s baby shower", url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setShareLabel("Link copied \u2713");
    } catch { return; }
    window.setTimeout(() => setShareLabel("Share invite"), 2000);
  }
  const dayOf = phase !== "scheduled";
  const copy = PHASE_COPY[phase];
  const record = confirmationCode(rsvp.canonicalSlug);
  const passengerNames = rsvp.guests.map((guest) => guest.name).join(", ") || "Your invited party";
  return <div className={`invite-screen ticket-screen${dayOf ? " day-of" : ""}`} data-phase={phase}>
    <header className="ticket-header">
      <p>Boarding Pass<br />For {rsvp.invitationLabel || "your household"}<br /><span className="pass-conf">Conf {record}</span></p>
      {dayOf ? <span className="departure-stamp" data-phase={phase}>{copy.stamp}</span> : <div className="paper-monogram" aria-hidden="true">J✦F</div>}
    </header>
    {dayOf && <DepartureBoard phase={phase} countdown={countdown} />}
    {dayOf && phase !== "landed" && <DayOfActions phone={rsvp.event?.contactPhone ?? CONTACT_PHONE} />}
    <section className="ticket-hero">
      <p className="script-line">{copy.script}</p>
      <h1>Baby<br />Moncada</h1>
      <p className="host-line">A baby shower honoring Janelle &amp; Fernando</p>
      <span className="boy-pill">A little boy is on the way</span>
      <p className="recipient-line">{passengerNames} · Party of {rsvp.guests.length || "\u2014"}</p>
    </section>
    {!dayOf && <div className="flight-wrap"><svg className="flight-path" viewBox="0 0 300 56" aria-hidden="true"><path d="M6 44 C 80 10, 160 60, 230 18" /><text x="222" y="22">✈</text></svg></div>}
    <TicketDivider />
    <section className="ticket-details">
      <TicketFact label="Departure" value="Sat, Sep 26 2026" />
      <TicketFact label="Boarding time" value="4:00 PM" />
      <TicketFact label="Gate" value={EVENT_ROOM} />
      <TicketFact label="Group" value="Family" />
      <TicketFact label="Seat" value="Open" />
      <TicketFact label="Parking" value="$8 per day" />
      <TicketFact full label="Destination" value="Hotel Centro Sonoma Wine Country" detail={HOTEL_ADDRESS} />
      <TicketFact full label="Passenger" value={passengerNames} />
      <TicketFact full label="Attire" value="Casual" detail="Dress comfortably" />
    </section>
    <TicketDivider />
    {dayOf ? phase !== "landed" && <ArrivalGuide /> : <section className="countdown-wrap"><p className="phone-eyebrow">Time to boarding</p><div className="countdown" aria-label="Countdown to September 26, 2026">
      {Object.entries(countdown).map(([label, value]) => <div key={label}><strong>{label === "days" ? value : String(value).padStart(2, "0")}</strong><span>{label === "hours" ? "Hrs" : label === "minutes" ? "Min" : label === "seconds" ? "Sec" : "Days"}</span></div>)}
    </div></section>}
    <div className="ticket-barcode" style={{ backgroundImage: barcodePattern(rsvp.canonicalSlug) }} aria-hidden="true" />
    <p className="barcode-code" aria-hidden="true">{record}</p>
    {phase === "landed"
      ? <div className="landed-card"><strong>✈ Thanks for flying with us</strong><span>Janelle and Fernando are glad you made the trip. Gifts are still welcome whenever you get to them.</span><ExternalLink href={REGISTRY_URL} primary>Open the registry on Amazon</ExternalLink></div>
      : <>
        <div className="baby-on-board"><strong>✈ Baby On Board</strong><span>Moncada Airways</span></div>
        <div className="diaper-raffle"><strong>✈ Diaper Raffle</strong><span>{dayOf ? "Last call. Bring a pack of diapers, size 2 or up, and you are in the drawing. There is still time to grab one on the way." : "Bring a pack of diapers to enter. Sizes 2 and up are the biggest help, he\u2019ll grow into them fast."}</span></div>
      </>}
    {dayOf && <PhotoAlbumCard phase={phase} phone={rsvp.event?.contactPhone ?? CONTACT_PHONE} />}
    {dayOf ? <DayOfStatus phase={phase} rsvp={rsvp} /> : rsvp.submitted ? <RSVPConfirmed rsvp={rsvp} /> : <RSVPDeadline value={rsvp.event?.rsvpDeadline ?? FALLBACK_RSVP_DEADLINE} urgent={deadlinePassed} />}
    <div className="home-actions">{dayOf ? <button className="phone-action full" onClick={onRSVP}>{rsvp.submitted ? "See your RSVP" : "RSVP now"}</button> : <><button className="phone-action primary" onClick={onRSVP}>RSVP</button><button className="phone-action" onClick={onCalendar}>Add to calendar</button></>}</div>
    <div className={`save-invite${dayOf ? " compact" : ""}`}><strong>📌 Save this invitation</strong><p>Add this invitation to your Home Screen for quick access to the registry, directions, and RSVP.<span><b>iPhone (Safari or Chrome):</b> Tap Share → Add to Home Screen.</span><small>Prefer a bookmark? Use Add Bookmark in Safari or Add to Bookmarks in Chrome.</small></p><button onClick={shareInvite}>{shareLabel}</button></div>
  </div>;
}

function TicketDivider() { return <div className="ticket-divider" aria-hidden="true"><i /><i /></div>; }
function TicketFact({ label, value, detail, full = false }: { label: string; value: string; detail?: string; full?: boolean }) { return <div className={full ? "ticket-fact-full" : undefined}><span>{label}</span><strong>{value}</strong>{detail && <p>{detail}</p>}</div>; }

function RSVPConfirmed({ rsvp }: { rsvp: RSVP }) {
  const attending = rsvp.guests.filter((guest) => guest.response === "yes").length;
  return <div className="rsvp-deadline confirmed">
    <span>RSVP received</span>
    <strong>{attending > 0 ? `You\u2019re on the list \u2014 party of ${attending}` : "Thanks for letting us know"}</strong>
    <p>{attending > 0 ? "See you September 26. Tap RSVP to change your response." : "We\u2019ll miss you. Tap RSVP if anything changes."}</p>
  </div>;
}

function RSVPDeadline({ value, urgent, compact = false }: { value: string; urgent: boolean; compact?: boolean }) {
  const formatted = new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return <div className={`rsvp-deadline${compact ? " compact" : ""}`}>
    <span>Reply requested</span>
    <strong>{urgent ? "RSVP as soon as possible" : `RSVP by ${formatted}`}</strong>
    {!compact && <p>{urgent ? "We\u2019re finalizing the headcount \u2014 please respond for everyone named on this invitation." : "Please respond for everyone named on this invitation."}</p>}
  </div>;
}

function ScreenHeader({ kicker, title, mark, subtitle }: { kicker: string; title: string; mark: string; subtitle?: string }) {
  return <header className="screen-header"><div><p className="phone-eyebrow">{kicker}</p><h2>{title}</h2>{subtitle && <p className="screen-subtitle">{subtitle}</p>}</div><span>{mark}</span></header>;
}

function StayScreen({ bookingUrl, phase }: { bookingUrl: string; phase: Phase }) {
  const dayOf = phase !== "scheduled";
  return <div className="feature-screen">
    <ScreenHeader kicker="Boarding Pass · Hotel Stay" title="Stay on site" subtitle="Hotel Centro Sonoma Wine Country · Tapestry by Hilton" mark="" />
    {dayOf && <div className="day-of-banner"><span>Today</span><strong>This is the venue</strong><p>The shower is in the Reunion Room inside this hotel. You do not need a guest room to be here. Park on site, walk in the main lobby, and ask for the Reunion Room.</p></div>}
    <div className="info-block venue-block"><strong>Hotel Centro Sonoma Wine Country</strong><p>Tapestry by Hilton<br />{HOTEL_ADDRESS}</p></div>
    {!dayOf && <>
      <div className="stay-facts two-up"><div><span>Check in</span><strong>Fri, Sep 25</strong></div><div><span>Check out</span><strong>Sun, Sep 27</strong></div></div>
      <div className="room-list">
        <Room name="1 King Bed" detail="Sleeps 2 · workspace · mini refrigerator" />
        <Room name="2 Queen Beds" detail="Sleeps 4 · workspace · mini refrigerator" />
      </div>
    </>}
    <div className="amenities"><span>Free Wi-Fi</span><span>Outdoor pool</span><span>Restaurant</span><span>Fitness center</span><span>Pet friendly</span></div>
    {dayOf && <div className="overnight-note"><span>Only if you booked a room</span><strong>Checkout is Sunday, September 27</strong><p>The front desk handles checkout and can tell you whether a later time is possible. Most guests are not staying over and can skip this.</p></div>}
    <div className="booking-panel"><div><span>Booking</span><strong>{dayOf ? "Still need a room tonight?" : "Reserve directly with the hotel"}</strong><p>{dayOf ? "Whatever Hilton still has open is what is left. Availability, taxes and fees, and the final total are live on their site." : "Rooms are booked on your own for September 25 to 27. Hilton shows live availability, taxes and fees, and the final total before you confirm."}</p></div><ExternalLink href={bookingUrl} primary={!dayOf}>Check rooms &amp; book with Hilton</ExternalLink></div>
  </div>;
}

function Room({ name, detail }: { name: string; detail: string }) {
  return <article className="room"><div className="room-top"><h3>{name}</h3></div><p>{detail}</p></article>;
}

function RegistryScreen({ category, setCategory, products: visible, registry, onGift }: { category: string; setCategory: (value: string) => void; products: RegistryItem[]; registry: RegistryState; onGift: (item: RegistryItem) => void }) {
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of registry.items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return [["All", registry.items.length], ...Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))] as [string, number][];
  }, [registry.items]);
  const syncedAt = registry.updatedAt ? new Date(registry.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "recently";
  const updateLabel = registry.refreshState === "refreshing" ? `Last verified ${syncedAt}` : `Synced ${syncedAt}`;

  if (registry.status === "loading") return <div className="feature-screen">
    <ScreenHeader kicker="Amazon registry" title="Janelle’s registry" mark="Updating" />
    <div className="registry-loading" role="status"><div className="loading-ring" /><strong>Loading the current registry</strong><p>Checking gift availability and retailer options.</p></div>
  </div>;

  if (registry.status === "error") return <div className="feature-screen">
    <ScreenHeader kicker="Amazon registry" title="Janelle’s registry" mark="Unavailable" />
    <div className="registry-empty"><strong>We couldn’t refresh the gift list.</strong><p>Nothing stale is being shown. Open Amazon to see the current registry and purchase status.</p><ExternalLink href={REGISTRY_URL} primary>Open the registry on Amazon</ExternalLink></div>
  </div>;

  if (registry.status === "handoff") return <div className="feature-screen">
    <ScreenHeader kicker="Amazon registry" title="Janelle’s registry" mark="Live on Amazon" />
    <div className="registry-profile"><div className="registry-monogram" aria-hidden="true">J <span>+</span> F</div><div><strong>Janelle &amp; Fernando Moncada</strong><p>Baby due November 25, 2026</p></div></div>
    <div className="registry-empty"><strong>See the current registry directly on Amazon.</strong><p>New items, changes, fulfilled gifts, and checkout stay accurate on the live registry. This invitation will not show a stale copy.</p><ExternalLink href={REGISTRY_URL} primary>Open the registry on Amazon</ExternalLink></div>
  </div>;

  const stillNeeded = registry.items.filter((item) => !item.isFulfilled).length;
  return <div className="feature-screen">
    <ScreenHeader kicker="Live from Amazon" title="Janelle’s registry" mark={`${stillNeeded} still needed`} />
    <div className="registry-profile">
      <div className="registry-monogram" aria-hidden="true">J <span>+</span> F</div>
      <div><strong>Janelle &amp; Fernando Moncada</strong><p>Rohnert Park, CA · Baby due November 25, 2026</p></div>
    </div>
    <div className="registry-official-link"><ExternalLink href={REGISTRY_URL} primary>See the full registry on Amazon</ExternalLink><small>Use Amazon directly for checkout, gift tracking, returns, and thank-you records.</small></div>
    <div className="registry-summary"><span><strong>{registry.items.length}</strong> gifts</span><span><strong>{categoryCounts.length - 1}</strong> categories</span><span className="live-state"><i /> {updateLabel}</span></div>
    {registry.refreshState === "refreshing" && <p className="registry-trust"><strong>Amazon sync is delayed.</strong> These are the last verified items. Use the official Amazon button above for the newest purchase status.</p>}
    <p className="registry-trust">Items, quantities, and purchase status refresh from Amazon. Every gift opens through its exact registry-linked product page.</p>
    <div className="category-row" aria-label="Registry categories">{categoryCounts.map(([name, count]) => <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name} {count}</button>)}</div>
    <div className="products">{visible.map((product) => <article className={`product${product.isFulfilled ? " reserved" : ""}`} key={product.id}>
        <img className="product-art" src={product.image} alt="" loading="lazy" />
        <div className="product-body">
          <span className="product-category">{product.category}</span>
          <h3>{product.title}</h3>
          <div className="product-meta"><strong>{product.isFulfilled ? "Already purchased" : product.price || "See current price"}</strong>{product.quantity > 1 && !product.isFulfilled && <span className="quantity-needed">{product.quantityNeeded} of {product.quantity} still needed</span>}<div className="store-list" aria-label={`Available from ${product.offers.map((offer) => offer.store).join(", ")}`}>{product.offers.slice(0, 3).map((offer) => <span key={offer.id}>{offer.store}</span>)}</div></div>
          <button className="phone-action primary" disabled={product.isFulfilled} onClick={() => onGift(product)}>{product.isFulfilled ? "Gift fulfilled" : `View ${product.offers.length || ""} option${product.offers.length === 1 ? "" : "s"}`}</button>
        </div>
      </article>)}</div>
    {visible.length === 0 && <div className="registry-empty"><strong>No gifts in this category.</strong><p>Choose another category to continue browsing.</p></div>}
  </div>;
}

function MapsScreen({ phase, countdown }: { phase: Phase; countdown: Countdown }) {
  const [copyLabel, setCopyLabel] = useState("Copy address");
  async function copyAddress() { await navigator.clipboard.writeText(HOTEL_ADDRESS); setCopyLabel("Copied ✓"); window.setTimeout(() => setCopyLabel("Copy address"), 2000); }
  const dayOf = phase !== "scheduled";
  const untilBoarding = phase === "today" ? `Boarding in ${countdown.days * 24 + countdown.hours}h ${String(countdown.minutes).padStart(2, "0")}m` : phase === "landed" ? "The shower has wrapped" : "Boarding now";
  return <div className="feature-screen">
    <ScreenHeader kicker="Boarding Pass · Travel" title="Shower & stay" subtitle="One destination — no travel between the shower and hotel." mark="" />
    {dayOf && <div className="day-of-banner"><span>{untilBoarding}</span><strong>5870 Labath Ave, Rohnert Park</strong><MapActions /><div className="day-of-contact"><button className="phone-action" onClick={copyAddress}>{copyLabel}</button></div></div>}
    <div className="map-visual"><iframe title="Interactive map showing Hotel Centro Sonoma Wine Country at 5870 Labath Avenue" loading="lazy" src={HOTEL_MAP_EMBED} /></div>
    <div className="place-list">
      <article className="place venue-place"><span>Your destination</span><h3>Hotel Centro Sonoma Wine Country</h3><p>{HOTEL_ADDRESS}</p><div><ExternalLink href={HOTEL_APPLE_MAPS}>Apple Maps</ExternalLink><ExternalLink href={HOTEL_GOOGLE_MAPS}>Google Maps</ExternalLink><ExternalLink href={HOTEL_WAZE}>Waze</ExternalLink><button className="phone-action" onClick={copyAddress}>{copyLabel}</button></div></article>
      <ArrivalGuide />
      <div className="wear-note"><strong>What to wear</strong><p>Late September is typically warm during the day and cooler in the evening. Dress comfortably and bring a light layer.</p></div>
      <p className="travel-note">The shower and guest rooms share the same address.</p>
    </div>
  </div>;
}

function RSVPScreen({ rsvp, setRsvp, deadlinePassed, phase, onSave }: { rsvp: RSVP; setRsvp: React.Dispatch<React.SetStateAction<RSVP>>; deadlinePassed: boolean; phase: Phase; onSave: () => void }) {
  const dayOf = phase !== "scheduled";
  if (rsvp.status === "loading") return <div className="feature-screen rsvp-screen"><ScreenHeader kicker="Your invitation" title="RSVP" mark="Loading" /><div className="registry-loading" role="status"><div className="loading-ring" /><strong>Finding your invitation</strong><p>Loading the people included in your party.</p></div></div>;
  if (rsvp.status === "error" && rsvp.guests.length === 0) return <div className="feature-screen rsvp-screen"><ScreenHeader kicker="Your invitation" title="RSVP" mark="Unavailable" /><div className="registry-empty"><strong>We couldn’t open this RSVP.</strong><p>{rsvp.error}</p><button className="phone-action primary full" onClick={() => window.location.reload()}>Try again</button></div></div>;
  const complete = rsvp.guests.every((guest) => guest.response !== null);
  const attending = rsvp.guests.filter((guest) => guest.response === "yes").map((guest) => guest.name);

  if (rsvp.submitted) {
    const declined = rsvp.guests.filter((guest) => guest.response === "no").map((guest) => guest.name);
    const responseSummary = attending.length === rsvp.guests.length
      ? `${formatNameList(attending)} ${attending.length === 1 ? "is" : "are"} attending.`
      : attending.length === 0
        ? `${formatNameList(declined)} can’t make it.`
        : `${formatNameList(attending)} ${attending.length === 1 ? "is" : "are"} attending. ${formatNameList(declined)} can’t make it.`;
    return <div className="feature-screen rsvp-screen">
      <ScreenHeader kicker="RSVP received" title={`Thank you, ${rsvp.messageGreeting}.`} mark="✓" />
      <div className="rsvp-success">
        <div className="success-mark" aria-hidden="true">✓</div>
        <h3>{responseSummary}</h3>
        {rsvp.note && <blockquote>“{rsvp.note}”</blockquote>}
        <p>Your response is saved. You can return with this invitation link to make a change.</p>
        {rsvp.updatedAt && <span className="saved-time">Last updated {new Date(rsvp.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
        <button className="phone-action full" onClick={() => setRsvp({ ...rsvp, submitted: false, error: null })}>Change response</button>
        {attending.length > 0 && <section className="rsvp-next-steps" aria-label="Before the baby shower">
          <header><strong>{dayOf ? "Today" : "Before the shower"}</strong><span>Two quick reminders</span></header>
          <div className="rsvp-next-step raffle-step"><span>Raffle</span><div><strong>Bring a pack of diapers</strong><p>{dayOf ? "Size 2 and up. One pack is one entry, and there is still time to grab one on the way." : "Sizes 2 and up are the biggest help, one pack is one entry to win a prize."}</p></div></div>
          <div className="rsvp-next-step live-invite-step"><span>Live</span><div><strong>Save this invitation</strong><p>Add it to your Home Screen or bookmarks. Return anytime for current registry items, directions, hotel details, and event updates.</p></div></div>
        </section>}
      </div>
    </div>;
  }

  return <div className="feature-screen">
    <ScreenHeader kicker="Boarding Pass · RSVP" title="Who’s on board?" subtitle="Respond for each passenger named on this invitation." mark="" />
    {dayOf ? <DayOfStatus phase={phase} rsvp={rsvp} /> : <RSVPDeadline value={rsvp.event?.rsvpDeadline ?? FALLBACK_RSVP_DEADLINE} urgent={deadlinePassed} compact />}
    <div className="party-summary">
      <span>Invitation for</span>
      <strong>{rsvp.household}</strong>
      <p>{rsvp.guests.map((guest) => guest.name).join(", ")} · Party of {rsvp.guests.length}</p>
    </div>
    <div className="invitee-list">
      {rsvp.guests.map((guest, index) => <article className="invitee" key={guest.id}>
        <div className="invitee-heading"><span className="guest-avatar" aria-hidden="true">{guest.name[0]}</span><div><strong>{guest.name}</strong><p>{guest.response === "yes" ? "Attending" : guest.response === "no" ? "Can’t attend" : "Response needed"}</p></div></div>
        <div className="attendance-options" role="group" aria-label={`${guest.name}'s attendance`}>
          <button aria-pressed={guest.response === "yes"} onClick={() => setRsvp({ ...rsvp, guests: rsvp.guests.map((item, itemIndex) => itemIndex === index ? { ...item, response: "yes" } : item) })}>Attending</button>
          <button aria-pressed={guest.response === "no"} onClick={() => setRsvp({ ...rsvp, guests: rsvp.guests.map((item, itemIndex) => itemIndex === index ? { ...item, response: "no" } : item) })}>Can’t make it</button>
        </div>
      </article>)}
    </div>
    <div className="rsvp-note">
      <label htmlFor="rsvp-note">Note for Janelle &amp; Fernando <span>Optional</span></label>
      <textarea id="rsvp-note" value={rsvp.note} onChange={(event) => setRsvp({ ...rsvp, note: event.target.value })} placeholder="Share a quick note" maxLength={180} />
    </div>
    {rsvp.error && <p className="form-error" role="alert">{rsvp.error}</p>}
    <button className="phone-action primary full save-rsvp" disabled={!complete || rsvp.status === "saving"} onClick={onSave}>{rsvp.status === "saving" ? "Saving response…" : rsvp.updatedAt ? "Save changes" : "Confirm RSVP"}</button>
    {!complete && <p className="rsvp-guidance">Choose a response for every guest to continue.</p>}
    <div className="contact-actions"><span>Questions? Reach Janelle</span><div><a href={`mailto:${rsvp.event?.contactEmail ?? "j_elyssa05@yahoo.com"}`}>Email</a><a href={`sms:${rsvp.event?.contactPhone ?? "+17073345988"}`}>Text</a><a href={`tel:${rsvp.event?.contactPhone ?? "+17073345988"}`}>Call</a></div></div>
  </div>;
}

function HandoffSheet({ overlay, onClose }: { overlay: Exclude<Overlay, null>; onClose: () => void }) {
  if (overlay.type === "gift") {
    const { item } = overlay;
    return <div className="handoff-overlay" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><div className="handoff-sheet gift-sheet"><div className="sheet-handle" />
      <button className="sheet-close" aria-label="Close gift details" onClick={onClose}>×</button>
      <div className="gift-sheet-head"><img src={item.image} alt="" /><div><span>{item.category}</span><h3 id="handoff-title">{item.title}</h3><strong>{item.price || "See current price"}</strong></div></div>
      <div className="offer-list">
        {item.offers.map((offer) => <ExternalLink key={offer.id} href={offer.url} primary={offer.isRegistry}>
          <span>{offer.isRegistry ? "View registry item on Amazon" : `View at ${offer.store}`}</span><b>{offer.price != null ? `$${offer.price.toFixed(2)}` : "Current price"} ↗</b>
        </ExternalLink>)}
      </div>
      {item.offers.length === 0 && <p>No item-level purchase option is available right now. Amazon may have changed this gift.</p>}
      <button className="phone-action full" onClick={onClose}>Keep browsing gifts</button>
    </div></div>;
  }
  return null;
}
