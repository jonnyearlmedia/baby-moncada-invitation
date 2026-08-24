"use client";

import { useEffect, useMemo, useState } from "react";

const BOOKING_URL = "https://www.hilton.com/en/book/reservation/rooms/?ctyhocn=STSRHUP&arrivalDate=2026-09-25&departureDate=2026-09-27&groupCode=905&room1NumAdults=1&cid=OM%2CWW%2CHILTONLINK%2CEN%2CDirectLink";
const REGISTRY_URL = "https://my.babylist.com/janelle-fernando?session_synced=true";
const HOTEL_ADDRESS = "5870 Labath Ave, Rohnert Park, CA 94928";
const EVENT_APPLE_MAPS = "https://maps.apple.com/?q=Private%20Residence%2C%20Rohnert%20Park%2C%20CA";
const EVENT_GOOGLE_MAPS = "https://www.google.com/maps/search/?api=1&query=Rohnert%20Park%2C%20CA";
const HOTEL_APPLE_MAPS = "https://maps.apple.com/?daddr=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&dirflg=d";
const HOTEL_GOOGLE_MAPS = "https://www.google.com/maps/dir/?api=1&destination=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&travelmode=driving&dir_action=navigate";
const RSVP_STORAGE_KEY = "moncada-rsvp-murao-v2";

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
  { category: "Feeding", name: "Philips Avent Natural Bottles · 9 oz, 4-Pack", detail: "Medium flow · BPA-free · anti-colic valve", price: "$29.95", stores: ["Babylist", "Amazon"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/snr07p97bdojpcdu84ll.jpg" },
  { category: "Feeding", name: "Comfy Cubs Muslin Burp Cloths · 10-Pack", detail: "Six-layer cotton · multicolor · 20 × 10 in", price: "from $19.99", stores: ["Babylist", "Amazon", "Target", "+1"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/pd5gsqdciqdtgluetsid.jpg" },
  { category: "Feeding", name: "Momcozy Portable Bottle Warmer", detail: "17 oz · precise temperature control · travel-ready", price: "$79.99", stores: ["Babylist", "Amazon", "Target", "+1"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/ho9kbihjwhrkjzhxiu5j.jpg" },
  { category: "Feeding", name: "Baby Brezza Formula Pro Advanced", detail: "Automatic formula dispenser and bottle maker", price: "$229.99", stores: ["Babylist", "Amazon", "Target", "Nordstrom"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/nb7zmntehv1u1pj7btxa.jpg" },
  { category: "Baby gear", name: "Graco Slim Snacker High Chair", detail: "Ultra-slim fold · multiple recline positions", price: "$99.99", stores: ["Babylist", "Amazon", "Target", "Walmart"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/u6v0cqiepgy6px8xsbph.jpg" },
  { category: "Baby gear", name: "Chicco Bravo Primo Travel System", detail: "Stroller and KeyFit Max infant car seat", price: "from $499.99", stores: ["Babylist", "Amazon", "Target", "Walmart"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/x6lscafg7clahey72jhn.jpg" },
  { category: "Baby gear", name: "Baby Tula Explore Linen Carrier", detail: "Newborn to toddler · front and back carry", price: "$219.00", stores: ["Babylist", "Amazon"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/qkukx5ha8tko9g7yxgof.jpg" },
  { category: "Sleeping", name: "Dr.Care VistaView Baby Monitor", detail: "5-inch display · app control · night vision", price: "$129.99", stores: ["Amazon"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/lb902x6m8x7d6tjy8zkz.jpg" },
  { category: "Diapering", name: "Diaper Genie Platinum Pail", detail: "Hands-free · odor-locking · Easy Roll bags", price: "from $75.00", stores: ["Babylist", "Amazon", "Target", "Walmart"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/s5zzlkdn11z4cvw1enxu.jpg" },
  { category: "Bathing", name: "Frida Baby 4-in-1 Grow-with-Me Bathtub", detail: "Newborn to toddler · removable bath seat", price: "from $39.49", stores: ["Babylist", "Amazon", "Target", "Walmart"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/ro9s1prgmbxzoyrz7eb9.jpg" },
  { category: "Playing", name: "I Love to Sing in Tagalog", detail: "Filipino animal-song book for children", price: "$27.00", stores: ["Amazon"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/fcdetrnmsrwii48eikz3.jpg" },
  { category: "Cash & gift cards", name: "Babylist Shop Gift Card", detail: "Let Janelle and Fernando choose what they need", price: "$25–$1,000", stores: ["Babylist"], image: "https://images.babylist.com/image/upload/f_auto,q_auto:best,t_app_500px_square/nflyuwmcjwk1pygyameq.jpg" },
] as const;

const categories = [
  ["All", 32], ["Feeding", 13], ["Sleeping", 1], ["Diapering", 1],
  ["Baby gear", 4], ["Health & safety", 2], ["Bathing", 3], ["Playing", 6],
  ["General", 1], ["Cash & gift cards", 1],
] as const;

type View = (typeof nav)[number][0];
type Overlay = { type: "room"; label: string } | { type: "product"; index: number } | null;
type Attendance = "yes" | "no" | null;
type RSVP = { guests: { name: string; response: Attendance }[]; note: string; submitted: boolean };

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
  const [rsvp, setRsvp] = useState<RSVP>({ guests: [{ name: "Elsa", response: null }, { name: "Jonathan", response: null }], note: "", submitted: false });
  const concept = concepts[style];

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem("moncada-favorites") || "[]"));
      setChosen(localStorage.getItem("moncada-chosen") || "");
      const savedRSVP = JSON.parse(localStorage.getItem(RSVP_STORAGE_KEY) || "null");
      if (savedRSVP?.guests?.length === 2) setRsvp(savedRSVP);
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
  }

  function saveRSVP() {
    const submitted = { ...rsvp, submitted: true };
    setRsvp(submitted);
    try { localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(submitted)); } catch {}
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
    <ScreenHeader kicker="Babylist registry" title="Janelle’s registry" mark="32 gifts" />
    <div className="registry-profile">
      <div className="registry-monogram" aria-hidden="true">J <span>+</span> F</div>
      <div><strong>Janelle &amp; Fernando Moncada</strong><p>Rohnert Park, CA · Baby due November 25, 2026</p></div>
    </div>
    <div className="registry-summary"><span><strong>32</strong> gifts</span><span><strong>10</strong> categories</span><ExternalLink href={REGISTRY_URL}>Open all</ExternalLink></div>
    <div className="category-row" aria-label="Registry categories">{categories.map(([name, count]) => <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name} {count}</button>)}</div>
    <div className="products">{visible.map((product) => {
      const index = products.indexOf(product);
      return <article className="product" key={product.name}>
        <img className="product-art" src={product.image} alt="" loading="lazy" />
        <div className="product-body">
          <span className="product-category">{product.category}</span>
          <h3>{product.name}</h3>
          <p>{product.detail}</p>
          <div className="product-meta"><strong>{product.price}</strong><div className="store-list" aria-label={`Available from ${product.stores.join(", ")}`}>{product.stores.slice(0, 3).map((store) => <span key={store}>{store}</span>)}</div></div>
          <button className="phone-action full" onClick={() => onProduct(index)}>See buying options</button>
        </div>
      </article>;
    })}</div>
    {visible.length === 0 && <div className="registry-empty"><strong>More gifts in this category</strong><p>The complete selection and current availability are on Janelle and Fernando’s Babylist.</p><ExternalLink href={REGISTRY_URL} primary>View this category on Babylist</ExternalLink></div>}
    {category === "All" && <div className="registry-footer"><p>Showing 12 of 32 gifts</p><ExternalLink href={REGISTRY_URL} primary>Continue through the full registry</ExternalLink></div>}
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

function RSVPScreen({ rsvp, setRsvp, onSave }: { rsvp: RSVP; setRsvp: React.Dispatch<React.SetStateAction<RSVP>>; onSave: () => void }) {
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
        <p>This preview is saved on this device and has not notified the hosts.</p>
        <button className="phone-action full" onClick={() => setRsvp({ ...rsvp, submitted: false })}>Change response</button>
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
    <button className="phone-action primary full save-rsvp" disabled={!complete} onClick={onSave}>Confirm RSVP</button>
    {!complete && <p className="rsvp-guidance">Choose a response for Elsa and Jonathan to continue.</p>}
  </div>;
}

function HandoffSheet({ overlay, onClose }: { overlay: Exclude<Overlay, null>; onClose: () => void }) {
  const isRoom = overlay.type === "room";
  const product = !isRoom ? products[overlay.index] : null;
  return <div className="handoff-overlay" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><div className="handoff-sheet"><div className="sheet-handle" />
    {!isRoom && product && <div className="sheet-product"><img src={product.image} alt="" /><div><span>{product.category}</span><strong>{product.price}</strong></div></div>}
    <h3 id="handoff-title">{isRoom ? overlay.label : product?.name}</h3>
    <p>{isRoom ? "The September 25–27 stay and group code 905 are ready. Hilton will open to collect guest details and confirm the reservation." : "Babylist will show current prices and retailer availability for this gift. Open the registry there to purchase it and prevent duplicate gifts."}</p>
    <div><button className="phone-action" onClick={onClose}>{isRoom ? "Back to rooms" : "Back to gifts"}</button><ExternalLink href={isRoom ? BOOKING_URL : REGISTRY_URL} primary>{isRoom ? "Continue with Hilton" : "View on Babylist"}</ExternalLink></div>
  </div></div>;
}
