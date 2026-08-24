"use client";

import { useEffect, useMemo, useState } from "react";

const BOOKING_URL = "https://www.hilton.com/en/book/reservation/rooms/?ctyhocn=STSRHUP&arrivalDate=2026-09-25&departureDate=2026-09-27&groupCode=905&room1NumAdults=1&cid=OM%2CWW%2CHILTONLINK%2CEN%2CDirectLink";
const REGISTRY_URL = "https://my.babylist.com/janelle-fernando?session_synced=true";
const HOTEL_ADDRESS = "5870 Labath Ave, Rohnert Park, CA 94928";
const EVENT_APPLE_MAPS = "https://maps.apple.com/?q=Private%20Residence%2C%20Rohnert%20Park%2C%20CA";
const EVENT_GOOGLE_MAPS = "https://www.google.com/maps/search/?api=1&query=Rohnert%20Park%2C%20CA";
const HOTEL_APPLE_MAPS = "https://maps.apple.com/?daddr=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&dirflg=d";
const HOTEL_GOOGLE_MAPS = "https://www.google.com/maps/dir/?api=1&destination=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&travelmode=driving&dir_action=navigate";
const RSVP_STORAGE_KEY = "moncada-rsvp-murao-v1";

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

const products = [
  { category: "Feeding", icon: "🍼", name: "Philips Avent Natural Bottles · 9 oz", price: "$29.95" },
  { category: "Feeding", icon: "◌", name: "Comfy Cubs Muslin Burp Cloths · 10 pack", price: "$24.99" },
  { category: "Feeding", icon: "♨", name: "Momcozy Portable Bottle Warmer", price: "$79.99" },
  { category: "Feeding", icon: "⚙", name: "Baby Brezza Formula Pro Advanced", price: "$229.99" },
  { category: "Baby gear", icon: "♧", name: "Graco Slim Snacker High Chair", price: "$99.99" },
  { category: "Baby gear", icon: "⌁", name: "Chicco Bravo Primo Travel System", price: "$558.63" },
  { category: "Sleeping", icon: "◉", name: "Dr.Care VistaView Baby Monitor", price: "$129.99" },
  { category: "Diapering", icon: "▱", name: "Diaper Genie Platinum Pail", price: "$77.25" },
  { category: "Bathing", icon: "≈", name: "Frida Baby Grow-with-Me Bathtub", price: "$49.42" },
] as const;

const categories = [
  ["All", 32], ["Feeding", 13], ["Baby gear", 4], ["Sleeping", 1],
  ["Diapering", 1], ["Bathing", 3], ["Playing", 6],
] as const;

type View = (typeof nav)[number][0];
type Overlay = { type: "room"; label: string } | { type: "product"; index: number } | null;
type RSVP = { name: string; response: "yes" | "maybe" | "no"; guests: number };

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
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [rsvp, setRsvp] = useState<RSVP>({ name: "Elsa & Jonathan", response: "yes", guests: 2 });
  const [saveMessage, setSaveMessage] = useState("");
  const concept = concepts[style];

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem("moncada-favorites") || "[]"));
      setChosen(localStorage.getItem("moncada-chosen") || "");
      setRsvp((current) => ({ ...current, ...JSON.parse(localStorage.getItem(RSVP_STORAGE_KEY) || "{}") }));
    } catch {}
    setCountdown(getCountdown());
    const timer = window.setInterval(() => setCountdown(getCountdown()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleProducts = useMemo(() => category === "All" ? products : products.filter((product) => product.category === category), [category]);
  const chosenConcept = concepts.find((item) => item.id === chosen);

  function savePicker(nextFavorites = favorites, nextChosen = chosen) {
    try {
      localStorage.setItem("moncada-favorites", JSON.stringify(nextFavorites));
      if (nextChosen) localStorage.setItem("moncada-chosen", nextChosen);
    } catch {}
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
    setSaveMessage("");
  }

  function saveRSVP() {
    try { localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(rsvp)); } catch {}
    setSaveMessage(rsvp.name.trim() ? `Response saved for ${rsvp.name.trim()}.` : "Response saved on this device.");
  }

  function downloadCalendar() {
    const calendar = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Baby Moncada//Invitation//EN", "BEGIN:VEVENT",
      "UID:baby-moncada-20260926", "DTSTART;VALUE=DATE:20260926", "DTEND;VALUE=DATE:20260927",
      "SUMMARY:Baby Moncada Celebration", "LOCATION:Rohnert Park, CA",
      "DESCRIPTION:A little boy is on the way. Celebration honoring Janelle and Fernando Moncada.",
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
              <div className="phone-content">
                {view === "invite" && <InviteScreen countdown={countdown} onRSVP={() => changeView("rsvp")} onCalendar={downloadCalendar} />}
                {view === "stay" && <StayScreen onRoom={(label) => setOverlay({ type: "room", label })} />}
                {view === "registry" && <RegistryScreen category={category} setCategory={setCategory} products={visibleProducts} onProduct={(index) => setOverlay({ type: "product", index })} />}
                {view === "maps" && <MapsScreen />}
                {view === "rsvp" && <RSVPScreen rsvp={rsvp} setRsvp={setRsvp} saveMessage={saveMessage} onSave={saveRSVP} />}
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
      <div><span>▣</span><p><strong>Saturday, September 26, 2026</strong><br />Rohnert Park, California</p></div>
      <div><span>⌂</span><p><strong>Private residence</strong><br />Exact street address will be added</p></div>
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

function StayScreen({ onRoom }: { onRoom: (label: string) => void }) {
  return <div className="feature-screen">
    <ScreenHeader kicker="A room block for the weekend" title="Your stay" mark="HILTON" />
    <div className="info-block"><strong>Hotel Centro Sonoma Wine Country</strong><p>Tapestry by Hilton · Rohnert Park</p></div>
    <div className="stay-facts"><div><span>Check in</span><strong>Fri, Sep 25</strong></div><div><span>Check out</span><strong>Sun, Sep 27</strong></div><div><span>Group rate</span><strong>Code 905</strong></div></div>
    <div className="room-list">
      <Room name="1 King Bed" detail="Sleeps 2 · workspace · mini refrigerator" onChoose={onRoom} />
      <Room name="2 Queen Beds" detail="Sleeps 4 · workspace · mini refrigerator" onChoose={onRoom} />
    </div>
    <div className="amenities"><span>Free Wi-Fi</span><span>Outdoor pool</span><span>Restaurant</span><span>Fitness center</span><span>Pet friendly</span></div>
  </div>;
}

function Room({ name, detail, onChoose }: { name: string; detail: string; onChoose: (label: string) => void }) {
  return <article className="room"><div className="room-top"><h3>{name}</h3><div className="room-price">$149<span>per night</span></div></div><p>{detail}</p><button className="phone-action primary full" onClick={() => onChoose(name)}>View this room</button></article>;
}

function RegistryScreen({ category, setCategory, products: visible, onProduct }: { category: string; setCategory: (value: string) => void; products: readonly (typeof products)[number][]; onProduct: (index: number) => void }) {
  return <div className="feature-screen">
    <ScreenHeader kicker="Janelle & Fernando’s Babylist" title="Gifts for baby" mark="J + F" />
    <div className="category-row" aria-label="Registry categories">{categories.map(([name, count]) => <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name} {count}</button>)}</div>
    <div className="products">{visible.map((product) => {
      const index = products.indexOf(product);
      return <article className="product" key={product.name}><div className="product-art" aria-hidden="true">{product.icon}</div><div className="product-body"><h3>{product.name}</h3><strong>{product.price}</strong><button className="phone-action full" onClick={() => onProduct(index)}>View gift</button></div></article>;
    })}</div>
    {visible.length === 0 && <div className="info-block"><strong>See all gifts</strong><p>This category continues on Janelle and Fernando’s Babylist.</p><ExternalLink href={REGISTRY_URL} primary>View full registry</ExternalLink></div>}
  </div>;
}

function MapsScreen() {
  return <div className="feature-screen">
    <ScreenHeader kicker="Celebration and hotel" title="Plan your route" mark="⌖" />
    <div className="map-visual" role="img" aria-label="Stylized preview of the event area and hotel"><div className="map-pin event"><span>⌂</span></div><div className="map-pin hotel"><span>H</span></div><b>Rohnert Park</b></div>
    <div className="place-list">
      <article className="place"><h3>The celebration</h3><p>Private residence · Rohnert Park, CA<br />The street address will appear here once it is confirmed.</p><div><ExternalLink href={EVENT_APPLE_MAPS}>Open Apple Maps</ExternalLink><ExternalLink href={EVENT_GOOGLE_MAPS}>Open Google Maps</ExternalLink></div></article>
      <article className="place"><h3>Your hotel</h3><p>Hotel Centro Sonoma Wine Country<br />{HOTEL_ADDRESS}</p><div><ExternalLink href={HOTEL_APPLE_MAPS}>Open Apple Maps</ExternalLink><ExternalLink href={HOTEL_GOOGLE_MAPS}>Open Google Maps</ExternalLink></div></article>
    </div>
  </div>;
}

function RSVPScreen({ rsvp, setRsvp, saveMessage, onSave }: { rsvp: RSVP; setRsvp: React.Dispatch<React.SetStateAction<RSVP>>; saveMessage: string; onSave: () => void }) {
  return <div className="feature-screen">
    <ScreenHeader kicker="Your response" title="Elsa & Jonathan, will you join us?" mark="♡" />
    <div className="rsvp-card">
      <label htmlFor="guest-name">Names on the invitation</label><input id="guest-name" value={rsvp.name} onChange={(event) => setRsvp({ ...rsvp, name: event.target.value })} placeholder="Guest names" autoComplete="name" />
      <span className="field-label">Response</span>
      <div className="rsvp-options">
        {(["yes", "maybe", "no"] as const).map((response) => <button key={response} className="phone-action" aria-pressed={rsvp.response === response} onClick={() => setRsvp({ ...rsvp, response })}>{response === "yes" ? "Yes, we’ll be there" : response === "maybe" ? "We’re not sure yet" : "We’ll celebrate from afar"}</button>)}
      </div>
      <div className="guest-row"><div><strong>Guests attending</strong><p>This invitation is for two</p></div><div className="stepper"><button aria-label="Decrease guest count" onClick={() => setRsvp({ ...rsvp, guests: Math.max(1, rsvp.guests - 1) })}>−</button><strong>{rsvp.guests}</strong><button aria-label="Increase guest count" onClick={() => setRsvp({ ...rsvp, guests: Math.min(2, rsvp.guests + 1) })}>+</button></div></div>
      <button className="phone-action primary full save-rsvp" onClick={onSave}>Save response</button>
      <p className="save-message" aria-live="polite">{saveMessage}</p>
    </div>
  </div>;
}

function HandoffSheet({ overlay, onClose }: { overlay: Exclude<Overlay, null>; onClose: () => void }) {
  const isRoom = overlay.type === "room";
  const product = !isRoom ? products[overlay.index] : null;
  return <div className="handoff-overlay" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><div className="handoff-sheet"><div className="sheet-handle" />
    <h3 id="handoff-title">{isRoom ? overlay.label : product?.name}</h3>
    <p>{isRoom ? "The September 25–27 stay and group code 905 are ready. Hilton will open to collect guest details and confirm the reservation." : `${product?.price}. Babylist will open this gift with current retailer options and availability.`}</p>
    <div><button className="phone-action" onClick={onClose}>{isRoom ? "Back to rooms" : "Back to gifts"}</button><ExternalLink href={isRoom ? BOOKING_URL : REGISTRY_URL} primary>{isRoom ? "Continue with Hilton" : "View on Babylist"}</ExternalLink></div>
  </div></div>;
}
