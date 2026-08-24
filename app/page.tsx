"use client";

/* eslint-disable @next/next/no-img-element -- Babylist supplies live, variable registry image URLs; native lazy loading keeps the list resilient when an item image changes. */

import { useEffect, useMemo, useRef, useState } from "react";

const BOOKING_URL = "https://www.hilton.com/en/book/reservation/rooms/?ctyhocn=STSRHUP&arrivalDate=2026-09-25&departureDate=2026-09-27&groupCode=905&room1NumAdults=1&cid=OM%2CWW%2CHILTONLINK%2CEN%2CDirectLink";
const REGISTRY_URL = "https://my.babylist.com/janelle-fernando?session_synced=true";
const HOTEL_ADDRESS = "5870 Labath Ave, Rohnert Park, CA 94928";
const HOTEL_APPLE_MAPS = "https://maps.apple.com/?daddr=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&dirflg=d";
const HOTEL_GOOGLE_MAPS = "https://www.google.com/maps/dir/?api=1&destination=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&travelmode=driving&dir_action=navigate";
const RSVP_INVITE_CODE = "murao-family-2-f7c4a9";

const concepts = [
  { id: "glass", name: "Apple Invites / Cinematic Glass", short: "Cinematic Glass" },
  { id: "paper", name: "Paperless Post / Luxe Stationery", short: "Luxe Stationery" },
  { id: "editorial", name: "Modern Editorial / Magazine", short: "Modern Editorial" },
  { id: "dreamy", name: "Dreamy Storybook / Soft 3D", short: "Dreamy Storybook" },
  { id: "bold", name: "Bold Contemporary / Partiful-Adjacent", short: "Bold Contemporary" },
  { id: "minimal", name: "Minimal Luxury / Architectural", short: "Minimal Luxury" },
] as const;

const nav = [
  ["invite", "⌂", "Invite"],
  ["stay", "▤", "Hotel"],
  ["registry", "♧", "Gifts"],
  ["maps", "⌖", "Travel"],
  ["rsvp", "✓", "RSVP"],
] as const;

type View = (typeof nav)[number][0];
type RegistryOffer = { id: number; store: string; url: string; price: number | null; isBabylist: boolean; availability: string | null; availabilityText: string | null };
type RegistryItem = { id: number; title: string; image: string; category: string; price: string | null; quantity: number; quantityNeeded: number; isFulfilled: boolean; reservedCount: number; offers: RegistryOffer[] };
type RegistryState = { status: "loading" | "ready" | "error"; items: RegistryItem[]; updatedAt: string | null };
type Overlay = { type: "gift"; item: RegistryItem } | null;
type Attendance = "yes" | "no" | null;
type RSVP = {
  household: string;
  guests: { id: number; name: string; response: Attendance }[];
  note: string;
  submitted: boolean;
  updatedAt: string | null;
  status: "loading" | "ready" | "saving" | "error";
  error: string | null;
};

function getCountdown() {
  const target = new Date(2026, 8, 26, 0, 0, 0).getTime();
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

export default function Home() {
  const [style, setStyle] = useState(0);
  const [view, setView] = useState<View>("invite");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [chosen, setChosen] = useState("");
  const [category, setCategory] = useState("All");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [registry, setRegistry] = useState<RegistryState>({ status: "loading", items: [], updatedAt: null });
  const phoneContentRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [rsvp, setRsvp] = useState<RSVP>({ household: "The Murao Family", guests: [], note: "", submitted: false, updatedAt: null, status: "loading", error: null });
  const concept = concepts[style];

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(() => {
      try {
        setFavorites(JSON.parse(localStorage.getItem("moncada-favorites") || "[]"));
        setChosen(localStorage.getItem("moncada-chosen") || "");
      } catch {
        // The invitation remains usable when private browsing blocks storage.
      }
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
        const response = await fetch(`/api/rsvp?code=${encodeURIComponent(RSVP_INVITE_CODE)}`, { cache: "no-store" });
        const data = await response.json() as Omit<RSVP, "status" | "error"> & { error?: string };
        if (!response.ok) throw new Error(data.error || "RSVP unavailable");
        if (active) setRsvp({ ...data, status: "ready", error: null });
      } catch {
        if (active) setRsvp((current) => ({ ...current, status: "error", error: "We couldn’t load this invitation. Please try again." }));
      }
    }
    loadRSVP();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRegistry() {
      try {
        const response = await fetch("/api/registry");
        if (!response.ok) throw new Error("Registry refresh failed");
        const data = await response.json() as { items: RegistryItem[]; updatedAt: string };
        if (active) setRegistry({ status: "ready", items: data.items, updatedAt: data.updatedAt });
      } catch {
        if (active) setRegistry({ status: "error", items: [], updatedAt: null });
      }
    }
    loadRegistry();
    return () => { active = false; };
  }, []);

  const visibleProducts = useMemo(() => category === "All" ? registry.items : registry.items.filter((product) => product.category === category), [category, registry.items]);
  const chosenConcept = concepts.find((item) => item.id === chosen);

  function savePicker(nextFavorites = favorites, nextChosen = chosen) {
    try {
      localStorage.setItem("moncada-favorites", JSON.stringify(nextFavorites));
      if (nextChosen) localStorage.setItem("moncada-chosen", nextChosen);
    } catch {
      // The invitation remains usable when private browsing blocks storage.
    }
  }

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    savePicker(next, chosen);
  }

  function chooseStyle() {
    setChosen(concept.id);
    savePicker(favorites, concept.id);
  }

  function changeView(next: View) {
    setView(next);
    setOverlay(null);
    if (phoneContentRef.current) phoneContentRef.current.scrollTop = 0;
  }

  async function saveRSVP() {
    setRsvp((current) => ({ ...current, status: "saving", error: null }));
    try {
      const response = await fetch(`/api/rsvp?code=${encodeURIComponent(RSVP_INVITE_CODE)}`, {
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
      "UID:baby-moncada-20260926", "DTSTART;VALUE=DATE:20260926", "DTEND;VALUE=DATE:20260927",
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
    <main className="picker-page">
      <header className="picker-header">
        <div><p className="outer-eyebrow">Baby Moncada · September 26, 2026</p><h1>Choose the invitation that feels like them.</h1></div>
        <div className="picker-summary"><span>{favorites.length} favorite{favorites.length === 1 ? "" : "s"}</span><strong>{chosenConcept ? `${chosenConcept.short} selected` : "Still deciding"}</strong></div>
      </header>

      <div className="picker-layout">
        <aside className="concept-panel">
          <nav className="concept-list" aria-label="Visual directions">
            {concepts.map((item, index) => (
              <div className="concept-row" key={item.id}>
                <button className={index === style ? "concept active" : "concept"} aria-pressed={index === style} onClick={() => { setStyle(index); setOverlay(null); }}>
                  <span>0{index + 1}</span>{item.name}
                </button>
                <button className={favorites.includes(item.id) ? "heart active" : "heart"} aria-label={`Favorite ${item.name}`} aria-pressed={favorites.includes(item.id)} onClick={() => toggleFavorite(item.id)}>{favorites.includes(item.id) ? "♥" : "♡"}</button>
              </div>
            ))}
          </nav>
          <div className="choice-actions">
            <button onClick={() => toggleFavorite(concept.id)}>{favorites.includes(concept.id) ? "Favorited ♥" : "Favorite"}</button>
            <button className="choose" onClick={chooseStyle}>{chosen === concept.id ? "Selected ✓" : "Select this direction"}</button>
          </div>
        </aside>

        <section className="phone-column" aria-label={`${concept.name} interactive invitation`}>
          <div className="phone-label"><span>{concept.name}</span><span>Tap through the full invitation</span></div>
          <div className="device">
            <div className={`phone theme-${concept.id}`}>
              <div className="island" />
              <div className="status"><span>9:41</span><span>▮▮▮ ᴡɪꜰɪ ▰</span></div>
              <div className="phone-content" ref={phoneContentRef}>
                {view === "invite" && <InviteScreen countdown={countdown} onRSVP={() => changeView("rsvp")} onCalendar={downloadCalendar} />}
                {view === "stay" && <StayScreen />}
                {view === "registry" && <RegistryScreen category={category} setCategory={setCategory} products={visibleProducts} registry={registry} onGift={(item) => setOverlay({ type: "gift", item })} />}
                {view === "maps" && <MapsScreen />}
                {view === "rsvp" && <RSVPScreen rsvp={rsvp} setRsvp={setRsvp} onSave={saveRSVP} />}
              </div>
              <nav className="phone-nav" aria-label="Invitation features">
                {nav.map((item) => <button key={item[0]} className={view === item[0] ? "selected" : ""} aria-current={view === item[0] ? "page" : undefined} onClick={() => changeView(item[0])}><span>{item[1]}</span>{item[2]}</button>)}
              </nav>
              {overlay && <HandoffSheet overlay={overlay} onClose={() => setOverlay(null)} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InviteScreen({ countdown, onRSVP, onCalendar }: { countdown: ReturnType<typeof getCountdown>; onRSVP: () => void; onCalendar: () => void }) {
  return <div className="invite-screen">
    <div className="invite-art" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="invite-copy">
      <p className="phone-eyebrow">For the Murao family</p>
      <h2>You&apos;re invited to</h2>
      <div className="baby-title">Baby<br />Moncada</div>
      <p className="honoring">A celebration honoring</p>
      <p className="names">Janelle &amp; Fernando</p>
      <span className="boy-pill">A little boy is on the way</span>
      <p className="recipient-line">Elsa &amp; Jonathan · Party of two</p>
    </div>
    <div className="event-card">
      <div><span>▣</span><p><strong>Saturday, September 26, 2026</strong><br />Event time to be announced</p></div>
      <div><span>⌂</span><p><strong>Hotel Centro Sonoma Wine Country</strong><br />{HOTEL_ADDRESS}</p></div>
    </div>
    <div className="countdown" aria-label="Countdown to September 26, 2026">
      {Object.entries(countdown).map(([label, value]) => <div key={label}><strong>{label === "days" ? value : String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}
    </div>
    <div className="home-actions"><button className="phone-action primary" onClick={onRSVP}>RSVP</button><button className="phone-action" onClick={onCalendar}>Add to calendar</button></div>
  </div>;
}

function ScreenHeader({ kicker, title, mark }: { kicker: string; title: string; mark: string }) {
  return <header className="screen-header"><div><p className="phone-eyebrow">{kicker}</p><h2>{title}</h2></div><span>{mark}</span></header>;
}

function StayScreen() {
  return <div className="feature-screen">
    <ScreenHeader kicker="Baby shower + weekend stay" title="Stay on site" mark="$149 avg/night" />
    <div className="info-block venue-block"><strong>Hotel Centro Sonoma Wine Country</strong><p>Tapestry by Hilton<br />{HOTEL_ADDRESS}</p><div><span>One address</span>The baby shower and room block are both here.</div></div>
    <div className="stay-facts"><div><span>Check in</span><strong>Fri, Sep 25</strong></div><div><span>Check out</span><strong>Sun, Sep 27</strong></div><div><span>Group code</span><strong>905</strong></div></div>
    <div className="room-list">
      <Room name="1 King Bed" detail="Sleeps 2 · workspace · mini refrigerator" />
      <Room name="2 Queen Beds" detail="Sleeps 4 · workspace · mini refrigerator" />
    </div>
    <div className="amenities"><span>Free Wi-Fi</span><span>Outdoor pool</span><span>Restaurant</span><span>Fitness center</span><span>Pet friendly</span></div>
    <div className="booking-panel"><div><span>Official room block</span><strong>September 25–27</strong><p>Hilton will confirm current availability, the final total, and your reservation.</p></div><ExternalLink href={BOOKING_URL} primary>Check rooms &amp; book with Hilton</ExternalLink><small>Hilton currently shows King and two-Queen options at an average group rate of $149 per night. Rates and availability can change until booked.</small></div>
  </div>;
}

function Room({ name, detail }: { name: string; detail: string }) {
  return <article className="room"><div className="room-top"><h3>{name}</h3><span className="room-status">In block</span></div><p>{detail}</p></article>;
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
  return <div className="feature-screen">
    <ScreenHeader kicker="One destination" title="Shower & stay" mark="⌖" />
    <div className="map-visual"><iframe title="Map showing Hotel Centro Sonoma Wine Country" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=-122.7305%2C38.3456%2C-122.7105%2C38.3577&amp;layer=mapnik&amp;marker=38.3516523%2C-122.7205662" /></div>
    <div className="place-list">
      <article className="place venue-place"><span>Your destination</span><h3>Hotel Centro Sonoma Wine Country</h3><p>{HOTEL_ADDRESS}</p><div><ExternalLink href={HOTEL_APPLE_MAPS}>Open in Apple Maps</ExternalLink><ExternalLink href={HOTEL_GOOGLE_MAPS}>Open in Google Maps</ExternalLink></div></article>
      <p className="travel-note">The shower and guest rooms are at the same address—no travel between the event and hotel is needed.</p>
    </div>
  </div>;
}

function RSVPScreen({ rsvp, setRsvp, onSave }: { rsvp: RSVP; setRsvp: React.Dispatch<React.SetStateAction<RSVP>>; onSave: () => void }) {
  if (rsvp.status === "loading") return <div className="feature-screen rsvp-screen"><ScreenHeader kicker="Your invitation" title="RSVP" mark="Loading" /><div className="registry-loading" role="status"><div className="loading-ring" /><strong>Finding your invitation</strong><p>Loading the people included in your party.</p></div></div>;
  if (rsvp.status === "error" && rsvp.guests.length === 0) return <div className="feature-screen rsvp-screen"><ScreenHeader kicker="Your invitation" title="RSVP" mark="Unavailable" /><div className="registry-empty"><strong>We couldn’t open this RSVP.</strong><p>{rsvp.error}</p><button className="phone-action primary full" onClick={() => window.location.reload()}>Try again</button></div></div>;
  const complete = rsvp.guests.every((guest) => guest.response !== null);
  const attending = rsvp.guests.filter((guest) => guest.response === "yes").map((guest) => guest.name);

  if (rsvp.submitted) {
    const responseSummary = attending.length === 2
      ? "Elsa and Jonathan are attending."
      : attending.length === 1
        ? `${attending[0]} is attending. ${rsvp.guests.find((guest) => guest.response === "no")?.name} can’t make it.`
        : "Elsa and Jonathan can’t make it.";
    return <div className="feature-screen rsvp-screen">
      <ScreenHeader kicker="RSVP received" title="Thank you, Murao family." mark="✓" />
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
    <ScreenHeader kicker="Your invitation" title="RSVP" mark="2 invited" />
    <div className="party-summary">
      <span>Invitation for</span>
      <strong>The Murao Family</strong>
      <p>Elsa and Jonathan · Party of two</p>
    </div>
    <div className="rsvp-intro"><h3>Who can make it?</h3><p>Please respond for each person named on this invitation.</p></div>
    <div className="invitee-list">
      {rsvp.guests.map((guest, index) => <article className="invitee" key={guest.name}>
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
    {!complete && <p className="rsvp-guidance">Choose a response for Elsa and Jonathan to continue.</p>}
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
