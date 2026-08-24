"use client";

/* eslint-disable @next/next/no-img-element -- Babylist supplies live, variable registry image URLs; native lazy loading keeps the list resilient when an item image changes. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { EventSettings } from "@/lib/invitation-types";

const BOOKING_URL = "https://www.hilton.com/en/book/reservation/rooms/?ctyhocn=STSRHUP&arrivalDate=2026-09-25&departureDate=2026-09-27&groupCode=905&room1NumAdults=1&cid=OM%2CWW%2CHILTONLINK%2CEN%2CDirectLink";
const REGISTRY_URL = "https://my.babylist.com/janelle-fernando";
const HOTEL_ADDRESS = "5870 Labath Ave, Rohnert Park, CA 94928";
const HOTEL_APPLE_MAPS = "https://maps.apple.com/?daddr=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&dirflg=d";
const HOTEL_GOOGLE_MAPS = "https://www.google.com/maps/dir/?api=1&destination=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&travelmode=driving&dir_action=navigate";

const nav = [
  ["invite", "home", "Invite"],
  ["stay", "hotel", "Hotel"],
  ["registry", "gift", "Registry"],
  ["maps", "pin", "Travel"],
  ["rsvp", "check", "RSVP"],
] as const;

type View = (typeof nav)[number][0];
type IconName = (typeof nav)[number][1] | "calendar";
type RegistryOffer = { id: number; store: string; url: string; price: number | null; isBabylist: boolean; availability: string | null; availabilityText: string | null };
type RegistryItem = { id: number; title: string; image: string; category: string; price: string | null; quantity: number; quantityNeeded: number; isFulfilled: boolean; reservedCount: number; offers: RegistryOffer[] };
type RegistryState = { status: "loading" | "ready" | "handoff" | "error"; items: RegistryItem[]; updatedAt: string | null };
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

function getCountdown() {
  const target = new Date(2026, 8, 26, 16, 0, 0).getTime();
  const difference = Math.max(0, target - Date.now());
  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference % 86400000) / 3600000),
    minutes: Math.floor((difference % 3600000) / 60000),
    seconds: Math.floor((difference % 60000) / 1000),
  };
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
  const [registry, setRegistry] = useState<RegistryState>({ status: "loading", items: [], updatedAt: null });
  const phoneContentRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [rsvp, setRsvp] = useState<RSVP>({ canonicalSlug: inviteSlug, household: "", invitationLabel: "", messageGreeting: "", guests: [], note: "", submitted: false, updatedAt: null, status: "loading", error: null, event: null });
  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(() => {
      setCountdown(getCountdown());
    });
    const timer = window.setInterval(() => setCountdown(getCountdown()), 1000);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRSVP() {
      try {
        const response = await fetch(`/api/rsvp?slug=${encodeURIComponent(inviteSlug)}`, { cache: "no-store" });
        const data = await response.json() as Omit<RSVP, "status" | "error"> & { error?: string };
        if (!response.ok) throw new Error(data.error || "RSVP unavailable");
        if (active) setRsvp({ ...data, status: "ready", error: null });
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
        const data = await response.json() as { mode?: "handoff"; items?: RegistryItem[]; updatedAt?: string };
        if (active && data.mode === "handoff") setRegistry({ status: "handoff", items: [], updatedAt: null });
        else if (active) setRegistry({ status: "ready", items: data.items ?? [], updatedAt: data.updatedAt ?? null });
      } catch {
        if (active) setRegistry({ status: "error", items: [], updatedAt: null });
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
      "SUMMARY:Baby Moncada Celebration", `LOCATION:${HOTEL_ADDRESS}`,
      "DESCRIPTION:A little boy is on the way. Join Janelle and Fernando at Hotel Centro Sonoma Wine Country.",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([calendar], { type: "text/calendar" }));
    link.download = "baby-moncada.ics";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="app-page">
      <section className="phone boarding-pass" aria-label="Baby Moncada invitation">
        <div className="phone-content" ref={phoneContentRef}>
          {view === "invite" && <InviteScreen countdown={countdown} rsvp={rsvp} onRSVP={() => changeView("rsvp")} onCalendar={downloadCalendar} />}
          {view === "stay" && <StayScreen bookingUrl={rsvp.event?.hotelBookingUrl ?? BOOKING_URL} />}
          {view === "registry" && <RegistryScreen category={category} setCategory={setCategory} products={visibleProducts} registry={registry} onGift={(item) => setOverlay({ type: "gift", item })} />}
          {view === "maps" && <MapsScreen />}
          {view === "rsvp" && <RSVPScreen rsvp={rsvp} setRsvp={setRsvp} onSave={saveRSVP} />}
        </div>
        <nav className="phone-nav" aria-label="Invitation features">
          {nav.map((item) => <button key={item[0]} className={view === item[0] ? "selected" : ""} aria-current={view === item[0] ? "page" : undefined} onClick={() => changeView(item[0])}><span className="nav-icon"><Icon name={item[1]} />{item[0] === "rsvp" && rsvp.submitted && <i aria-label="RSVP submitted" />}</span>{item[2]}</button>)}
        </nav>
        {overlay && <HandoffSheet overlay={overlay} onClose={() => setOverlay(null)} />}
      </section>
    </main>
  );
}

function InviteScreen({ countdown, rsvp, onRSVP, onCalendar }: { countdown: ReturnType<typeof getCountdown>; rsvp: RSVP; onRSVP: () => void; onCalendar: () => void }) {
  const [shareLabel, setShareLabel] = useState("Share invite");
  async function shareInvite() {
    try {
      if (navigator.share) await navigator.share({ title: "Baby Moncada", text: "You’re invited to celebrate Baby Moncada", url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setShareLabel("Link copied ✓");
    } catch { return; }
    window.setTimeout(() => setShareLabel("Share invite"), 2000);
  }
  const passengerNames = rsvp.guests.map((guest) => guest.name).join(", ") || "Your invited party";
  return <div className="invite-screen ticket-screen">
    <header className="ticket-header">
      <p>Boarding Pass<br />For {rsvp.invitationLabel || "your household"}</p>
      <div className="paper-monogram" aria-hidden="true">J✦F</div>
    </header>
    <section className="ticket-hero">
      <p className="script-line">the little one is coming ✈</p>
      <h1>Baby<br />Moncada</h1>
      <p className="host-line">A celebration honoring Janelle &amp; Fernando</p>
      <span className="boy-pill">A little boy is on the way</span>
      <p className="recipient-line">{passengerNames} · Party of {rsvp.guests.length || "—"}</p>
    </section>
    <div className="flight-wrap"><svg className="flight-path" viewBox="0 0 300 56" aria-hidden="true"><path d="M6 44 C 80 10, 160 60, 230 18" /><text x="222" y="22">✈</text></svg></div>
    <TicketDivider />
    <section className="ticket-details">
      <TicketFact label="Departure" value="Sat, Sep 26 2026" />
      <TicketFact label="Boarding time" value="4:00 PM" />
      <TicketFact full label="Destination" value="Hotel Centro Sonoma Wine Country" detail={HOTEL_ADDRESS} />
      <TicketFact full label="Passenger" value={passengerNames} />
    </section>
    <TicketDivider />
    <section className="countdown-wrap"><p className="phone-eyebrow">Time to boarding</p><div className="countdown" aria-label="Countdown to September 26, 2026">
      {Object.entries(countdown).map(([label, value]) => <div key={label}><strong>{label === "days" ? value : String(value).padStart(2, "0")}</strong><span>{label === "hours" ? "Hrs" : label === "minutes" ? "Min" : label === "seconds" ? "Sec" : "Days"}</span></div>)}
    </div></section>
    <div className="ticket-barcode" aria-hidden="true" />
    <div className="baby-on-board"><strong>✈ Baby On Board</strong><span>Moncada Airways</span></div>
    <div className="diaper-raffle"><strong>✈ Diaper Raffle</strong><span>Bring a pack, any size, for a chance to win a prize</span></div>
    <div className="home-actions"><button className="phone-action primary" onClick={onRSVP}>RSVP</button><button className="phone-action" onClick={onCalendar}>Add to calendar</button></div>
    <div className="save-invite"><strong>📌 Save this invite</strong><p>You&apos;ll want this again for the registry and directions. On your phone: Share → Add to Home Screen. On desktop: Ctrl/Cmd + D to bookmark.</p><button onClick={shareInvite}>{shareLabel}</button></div>
  </div>;
}

function TicketDivider() { return <div className="ticket-divider" aria-hidden="true"><i /><i /></div>; }
function TicketFact({ label, value, detail, full = false }: { label: string; value: string; detail?: string; full?: boolean }) { return <div className={full ? "ticket-fact-full" : undefined}><span>{label}</span><strong>{value}</strong>{detail && <p>{detail}</p>}</div>; }

function ScreenHeader({ kicker, title, mark, subtitle }: { kicker: string; title: string; mark: string; subtitle?: string }) {
  return <header className="screen-header"><div><p className="phone-eyebrow">{kicker}</p><h2>{title}</h2>{subtitle && <p className="screen-subtitle">{subtitle}</p>}</div><span>{mark}</span></header>;
}

function StayScreen({ bookingUrl }: { bookingUrl: string }) {
  return <div className="feature-screen">
    <ScreenHeader kicker="Boarding Pass · Hotel Stay" title="Stay on site" subtitle="Hotel Centro Sonoma Wine Country · Tapestry by Hilton" mark="" />
    <div className="info-block venue-block"><strong>Hotel Centro Sonoma Wine Country</strong><p>Tapestry by Hilton<br />{HOTEL_ADDRESS}</p></div>
    <div className="stay-facts"><div><span>Check in</span><strong>Fri, Sep 25</strong></div><div><span>Check out</span><strong>Sun, Sep 27</strong></div><div><span>Group code</span><strong>905</strong></div></div>
    <div className="room-list">
      <Room name="1 King Bed" detail="Sleeps 2 · workspace · mini refrigerator" />
      <Room name="2 Queen Beds" detail="Sleeps 4 · workspace · mini refrigerator" />
    </div>
    <div className="amenities"><span>Free Wi-Fi</span><span>Outdoor pool</span><span>Restaurant</span><span>Fitness center</span><span>Pet friendly</span></div>
    <div className="booking-deadline"><strong>Book by Sep 11</strong><span>The group rate closes September 11, 2026 — reserve before then.</span></div>
    <div className="booking-panel"><div><span>Official room block</span><strong>September 25–27</strong><p>Hilton confirms current availability, the final total, and your reservation. Average group rate $149/night.</p></div><ExternalLink href={bookingUrl} primary>Check rooms &amp; book with Hilton</ExternalLink></div>
  </div>;
}

function Room({ name, detail }: { name: string; detail: string }) {
  return <article className="room"><div className="room-top"><h3>{name}</h3><span className="room-status">Special Rate</span></div><p>{detail}</p></article>;
}

function RegistryScreen({ category, setCategory, products: visible, registry, onGift }: { category: string; setCategory: (value: string) => void; products: RegistryItem[]; registry: RegistryState; onGift: (item: RegistryItem) => void }) {
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of registry.items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return [["All", registry.items.length], ...Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))] as [string, number][];
  }, [registry.items]);

  if (registry.status === "loading") return <div className="feature-screen">
    <ScreenHeader kicker="Babylist registry" title="Janelle’s registry" mark="Updating" />
    <div className="registry-loading" role="status"><div className="loading-ring" /><strong>Loading the current registry</strong><p>Checking gift availability and retailer options.</p></div>
  </div>;

  if (registry.status === "error") return <div className="feature-screen">
    <ScreenHeader kicker="Babylist registry" title="Janelle’s registry" mark="Unavailable" />
    <div className="registry-empty"><strong>We couldn’t refresh the gift list.</strong><p>Nothing stale is being shown. Open Babylist to see the current registry and purchase status.</p><ExternalLink href={REGISTRY_URL} primary>Open the registry on Babylist</ExternalLink></div>
  </div>;

  if (registry.status === "handoff") return <div className="feature-screen">
    <ScreenHeader kicker="Babylist registry" title="Janelle’s registry" mark="Live on Babylist" />
    <div className="registry-profile"><div className="registry-monogram" aria-hidden="true">J <span>+</span> F</div><div><strong>Janelle &amp; Fernando Moncada</strong><p>Baby due November 25, 2026</p></div></div>
    <div className="registry-empty"><strong>See the current registry directly on Babylist.</strong><p>New items, changes, fulfilled gifts, and checkout stay accurate on the live registry. This invitation will not show a stale copy.</p><ExternalLink href={REGISTRY_URL} primary>Open the registry on Babylist</ExternalLink></div>
  </div>;

  const stillNeeded = registry.items.filter((item) => !item.isFulfilled).length;
  return <div className="feature-screen">
    <ScreenHeader kicker="Live from Babylist" title="Janelle’s registry" mark={`${stillNeeded} still needed`} />
    <div className="registry-profile">
      <div className="registry-monogram" aria-hidden="true">J <span>+</span> F</div>
      <div><strong>Janelle &amp; Fernando Moncada</strong><p>Rohnert Park, CA · Baby due November 25, 2026</p></div>
    </div>
    <div className="registry-summary"><span><strong>{registry.items.length}</strong> gifts</span><span><strong>{categoryCounts.length - 1}</strong> categories</span><span className="live-state"><i /> Current</span></div>
    <p className="registry-trust">Availability and purchase status refresh from Babylist. Choose a gift to see its exact buying options.</p>
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
    <div className="registry-footer"><p>Babylist remains the source of truth for checkout, gift reservations, returns, and thank-you tracking.</p><ExternalLink href={REGISTRY_URL}>See the full registry on Babylist</ExternalLink></div>
  </div>;
}

function MapsScreen() {
  const [copyLabel, setCopyLabel] = useState("Copy address");
  async function copyAddress() { await navigator.clipboard.writeText(HOTEL_ADDRESS); setCopyLabel("Copied ✓"); window.setTimeout(() => setCopyLabel("Copy address"), 2000); }
  return <div className="feature-screen">
    <ScreenHeader kicker="Boarding Pass · Travel" title="Shower & stay" subtitle="One destination — no travel between the shower and hotel." mark="" />
    <div className="map-visual"><svg viewBox="0 0 600 360" role="img" aria-label="Map showing Hotel Centro Sonoma Wine Country"><rect width="600" height="360" fill="oklch(93% 0.02 232)" /><path d="M0 260 C 140 220, 220 300, 340 250 S 520 190, 600 230" stroke="oklch(85% 0.02 232)" strokeWidth="18" fill="none" /><path d="M0 120 C 160 160, 260 90, 420 130 S 560 110, 600 90" stroke="oklch(88% 0.015 232)" strokeWidth="10" fill="none" /><path d="M260 0 C 300 100, 240 220, 300 360" stroke="oklch(88% 0.015 232)" strokeWidth="8" fill="none" /><circle cx="300" cy="185" r="9" fill="oklch(58% 0.1 232)" /><path d="M300 150 C 320 150, 335 165, 335 185 C 335 210, 300 235, 300 235 C 300 235, 265 210, 265 185 C 265 165, 280 150, 300 150 Z" fill="oklch(58% 0.1 232)" /><text x="300" y="270" textAnchor="middle" fill="oklch(48% 0.035 250)">5870 Labath Ave, Rohnert Park, CA</text></svg></div>
    <div className="place-list">
      <article className="place venue-place"><span>Your destination</span><h3>Hotel Centro Sonoma Wine Country</h3><p>{HOTEL_ADDRESS}</p><div><ExternalLink href={HOTEL_APPLE_MAPS}>Apple Maps</ExternalLink><ExternalLink href={HOTEL_GOOGLE_MAPS}>Google Maps</ExternalLink><ExternalLink href="https://waze.com/ul?q=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&navigate=yes">Waze</ExternalLink><button className="phone-action" onClick={copyAddress}>{copyLabel}</button></div></article>
      <div className="arrival-card"><span>On arrival</span><ol><li>Park in the hotel&apos;s self-parking lot. Confirm the parking fee with the front desk.</li><li>Enter through the main hotel lobby.</li><li>Ask the front desk for the Baby Moncada shower or follow the event signage.</li></ol></div>
      <div className="wear-note"><strong>What to wear</strong><p>Sonoma in late September is typically warm and dry during the day, then cooler in the evening. Dress for indoor and outdoor mingling.</p></div>
      <p className="travel-note">The shower and guest rooms share the same address.</p>
    </div>
  </div>;
}

function RSVPScreen({ rsvp, setRsvp, onSave }: { rsvp: RSVP; setRsvp: React.Dispatch<React.SetStateAction<RSVP>>; onSave: () => void }) {
  if (rsvp.status === "loading") return <div className="feature-screen rsvp-screen"><ScreenHeader kicker="Your invitation" title="RSVP" mark="Loading" /><div className="registry-loading" role="status"><div className="loading-ring" /><strong>Finding your invitation</strong><p>Loading the people included in your party.</p></div></div>;
  if (rsvp.status === "error" && rsvp.guests.length === 0) return <div className="feature-screen rsvp-screen"><ScreenHeader kicker="Your invitation" title="RSVP" mark="Unavailable" /><div className="registry-empty"><strong>We couldn’t open this RSVP.</strong><p>{rsvp.error}</p><button className="phone-action primary full" onClick={() => window.location.reload()}>Try again</button></div></div>;
  const complete = rsvp.guests.every((guest) => guest.response !== null);
  const attending = rsvp.guests.filter((guest) => guest.response === "yes").map((guest) => guest.name);

  if (rsvp.submitted) {
    const declined = rsvp.guests.filter((guest) => guest.response === "no").map((guest) => guest.name);
    const responseSummary = attending.length === rsvp.guests.length
      ? `${attending.join(", ")} ${attending.length === 1 ? "is" : "are"} attending.`
      : attending.length === 0
        ? `${declined.join(", ")} ${declined.length === 1 ? "can’t" : "can’t"} make it.`
        : `${attending.join(", ")} ${attending.length === 1 ? "is" : "are"} attending. ${declined.join(", ")} can’t make it.`;
    return <div className="feature-screen rsvp-screen">
      <ScreenHeader kicker="RSVP received" title={`Thank you, ${rsvp.messageGreeting}.`} mark="✓" />
      <div className="rsvp-success">
        <div className="success-mark" aria-hidden="true">✓</div>
        <h3>{responseSummary}</h3>
        {rsvp.note && <blockquote>“{rsvp.note}”</blockquote>}
        <p>Your response is saved. You can return with this invitation link to make a change.</p>
        {rsvp.updatedAt && <span className="saved-time">Last updated {new Date(rsvp.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
        <button className="phone-action full" onClick={() => setRsvp({ ...rsvp, submitted: false, error: null })}>Change response</button>
      </div>
    </div>;
  }

  return <div className="feature-screen">
    <ScreenHeader kicker="Boarding Pass · RSVP" title="Who’s on board?" subtitle="Respond for each passenger named on this invitation." mark="" />
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
    const externalOnly = item.offers.length > 0 && item.offers.every((offer) => !offer.isBabylist);
    return <div className="handoff-overlay" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><div className="handoff-sheet gift-sheet"><div className="sheet-handle" />
      <button className="sheet-close" aria-label="Close gift details" onClick={onClose}>×</button>
      <div className="gift-sheet-head"><img src={item.image} alt="" /><div><span>{item.category}</span><h3 id="handoff-title">{item.title}</h3><strong>{item.price || "See current price"}</strong></div></div>
      <div className="offer-list">
        {item.offers.map((offer) => <ExternalLink key={offer.id} href={offer.url} primary={offer.isBabylist}>
          <span>{offer.isBabylist ? "Buy through Babylist" : `View at ${offer.store}`}</span><b>{offer.price != null ? `$${offer.price.toFixed(2)}` : "Current price"} ↗</b>
        </ExternalLink>)}
      </div>
      {item.offers.length === 0 && <p>No item-level purchase option is available right now. Babylist may have changed this gift.</p>}
      {externalOnly && <div className="purchase-note"><strong>Buying from another store?</strong><p>Babylist does not automatically know when an outside retailer purchase is complete. After checkout, return to the registry and mark this gift as purchased so another guest doesn’t buy it too.</p><ExternalLink href={REGISTRY_URL}>Return to Babylist after purchase</ExternalLink></div>}
      <button className="phone-action full" onClick={onClose}>Keep browsing gifts</button>
    </div></div>;
  }
  return null;
}
