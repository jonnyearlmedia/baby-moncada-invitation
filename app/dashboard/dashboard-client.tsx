"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EventRow = {
  event_title: string; hosts_display: string; event_starts_at: string; rsvp_deadline: string; venue_name: string; venue_address: string;
  contact_email: string; contact_phone: string; registry_url: string; hotel_booking_url: string;
  hotel_booking_deadline: string; hotel_group_code: string; hotel_rate_label: string; copy_message_template: string;
};
type GuestRow = { id: string; display_name: string; response: "yes" | "no" | null; response_updated_at: string | null };
type HouseholdRow = {
  id: string; slug: string; display_name: string; invitation_label: string; message_greeting: string;
  guests: GuestRow[]; submission: { note: string; updated_at: string } | null;
};
type DashboardData = { event: EventRow; households: HouseholdRow[]; registrySync: { status: string; finished_at: string | null } | null };
type ResponseFilter = "all" | "yes" | "no" | "pending";
type DashboardView = "parties" | "guests";

function formatDateTime(value: string | null) {
  if (!value) return "Not replied yet";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function responseLabel(response: GuestRow["response"]) {
  if (response === "yes") return "Yes — attending";
  if (response === "no") return "No — can’t attend";
  return "Pending — no response";
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("all");
  const [dashboardView, setDashboardView] = useState<DashboardView>("parties");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (response.status === 401) { router.replace("/dashboard/login"); return; }
    const body = await response.json() as DashboardData & { error?: string };
    if (!response.ok) { setError(body.error ?? "Dashboard unavailable."); return; }
    setData(body); setError("");
  }, [router]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => {
    const guests = data?.households.flatMap((household) => household.guests) ?? [];
    return { invited: guests.length, attending: guests.filter((guest) => guest.response === "yes").length, declined: guests.filter((guest) => guest.response === "no").length, pending: guests.filter((guest) => guest.response === null).length };
  }, [data]);

  const responseDirectory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data?.households.flatMap((household) => household.guests.map((guest) => ({
      ...guest,
      householdName: household.display_name,
      householdSlug: household.slug,
      invitationLink: `/invite/${household.slug}`,
      submissionUpdatedAt: household.submission?.updated_at ?? null,
    }))).filter((guest) => {
      const matchesFilter = responseFilter === "all" || (responseFilter === "pending" ? guest.response === null : guest.response === responseFilter);
      const haystack = `${guest.display_name} ${guest.householdName} ${guest.householdSlug}`.toLocaleLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    }) ?? [];
  }, [data, responseFilter, search]);

  const partyDirectory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data?.households.filter((household) => {
      const matchesFilter = responseFilter === "all" || household.guests.some((guest) => responseFilter === "pending" ? guest.response === null : guest.response === responseFilter);
      const haystack = `${household.display_name} ${household.slug} ${household.invitation_label} ${household.guests.map((guest) => guest.display_name).join(" ")}`.toLocaleLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    }) ?? [];
  }, [data, responseFilter, search]);

  async function save(body: Record<string, unknown>, key: string) {
    setBusy(key); setError(""); setNotice("");
    const response = await fetch("/api/admin/dashboard", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) setError(result.error ?? "Changes were not saved.");
    else { setNotice("Changes saved."); await load(); }
    setBusy("");
  }

  function updateEvent(field: keyof EventRow, value: string) {
    setData((current) => current ? { ...current, event: { ...current.event, [field]: value } } : current);
  }
  function updateHousehold(id: string, change: Partial<HouseholdRow>) {
    setData((current) => current ? { ...current, households: current.households.map((household) => household.id === id ? { ...household, ...change } : household) } : current);
  }
  function updateGuest(householdId: string, guestId: string, name: string) {
    setData((current) => current ? { ...current, households: current.households.map((household) => household.id === householdId ? { ...household, guests: household.guests.map((guest) => guest.id === guestId ? { ...guest, display_name: name } : guest) } : household) } : current);
  }
  async function copy(text: string, message: string, key: string) { await navigator.clipboard.writeText(text); setCopiedKey(key); setNotice(message); window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1800); }
  function invitationLink(slug: string) { return `${window.location.origin}/invite/${slug}`; }

  if (!data) return <main className="admin-shell"><section className="admin-card"><p>{error || "Loading the host dashboard…"}</p></section></main>;
  const event = data.event;
  return <main className="admin-shell"><header className="admin-top"><div><p className="admin-kicker">Baby Moncada</p><h1>Host dashboard</h1><p>Manage invitation links, guest names, event details, and live RSVP results.</p></div><button className="admin-secondary" onClick={async () => { await fetch("/api/admin/session", { method: "DELETE" }); router.replace("/dashboard/login"); }}>Log out</button></header>
    {(error || notice) && <div className={error ? "admin-alert error" : "admin-alert"} role="status">{error || notice}</div>}
    <section className="stats-grid" aria-label="RSVP totals"><button className={responseFilter === "all" ? "stats-card selected" : "stats-card"} onClick={() => setResponseFilter("all")}><strong>{stats.invited}</strong><span>All invited</span></button><button className={responseFilter === "yes" ? "stats-card selected" : "stats-card"} onClick={() => setResponseFilter("yes")}><strong>{stats.attending}</strong><span>Yes — attending</span></button><button className={responseFilter === "no" ? "stats-card selected" : "stats-card"} onClick={() => setResponseFilter("no")}><strong>{stats.declined}</strong><span>No — can’t attend</span></button><button className={responseFilter === "pending" ? "stats-card selected" : "stats-card"} onClick={() => setResponseFilter("pending")}><strong>{stats.pending}</strong><span>Pending</span></button></section>

    <section className="admin-card response-directory-card"><div className="section-heading"><div><p className="admin-kicker">Live invitations and RSVPs</p><h2>{dashboardView === "parties" ? "Send links and track RSVPs" : "Every guest, at a glance"}</h2></div><span>{dashboardView === "parties" ? `${partyDirectory.length} matching ${partyDirectory.length === 1 ? "party" : "parties"}` : `${responseDirectory.length} matching ${responseDirectory.length === 1 ? "guest" : "guests"}`}</span></div>
      {dashboardView === "parties" && <p className="directory-help">Copy or preview each party’s invitation directly from its card. No extra section required.</p>}
      <div className="view-switch" aria-label="Dashboard view"><button className={dashboardView === "parties" ? "selected" : ""} onClick={() => setDashboardView("parties")}>Parties</button><button className={dashboardView === "guests" ? "selected" : ""} onClick={() => setDashboardView("guests")}>Individual guests</button></div>
      <div className="directory-controls"><label>Search guests, parties, or short links<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try Grace, Ponticelle, or a short link" /></label><div className="filter-row" aria-label="Filter RSVP responses">{(["all", "yes", "no", "pending"] as ResponseFilter[]).map((filter) => <button key={filter} className={responseFilter === filter ? "filter-button selected" : "filter-button"} onClick={() => setResponseFilter(filter)}>{filter === "all" ? "Everyone" : filter === "yes" ? "Yes" : filter === "no" ? "No" : "Pending"}</button>)}</div></div>
      {dashboardView === "parties" ? <div className="party-directory-list">{partyDirectory.length ? partyDirectory.map((household) => {
        const link = `/invite/${household.slug}`;
        const fullLink = invitationLink(household.slug);
        const message = event.copy_message_template.replaceAll("{{household}}", household.message_greeting).replaceAll("{{link}}", fullLink);
        return <article className="party-directory-card" key={household.id}><header><div><strong>{household.display_name}</strong><a href={link}>{link}</a></div><div className="response-pills"><i>{household.guests.filter((guest) => guest.response === "yes").length} yes</i><i>{household.guests.filter((guest) => guest.response === "no").length} no</i><i>{household.guests.filter((guest) => guest.response === null).length} pending</i></div></header><div className="copy-row party-copy-row"><button className={copiedKey === `${household.id}-link` ? "copy-success" : ""} onClick={() => copy(fullLink, "Invitation link copied.", `${household.id}-link`)}>{copiedKey === `${household.id}-link` ? "✓ Copied!" : "Copy link"}</button><button className={copiedKey === `${household.id}-message` ? "copy-success" : ""} onClick={() => copy(message, "Ready-to-send message copied.", `${household.id}-message`)}>{copiedKey === `${household.id}-message` ? "✓ Copied!" : "Copy message"}</button><a href={link} target="_blank" rel="noreferrer">Preview invitation</a></div><div className="party-guest-list">{household.guests.map((guest) => <div className={`party-guest-row status-${guest.response ?? "pending"}`} key={guest.id}><div><strong>{guest.display_name}</strong><span>{responseLabel(guest.response)}</span></div><time>{formatDateTime(guest.response_updated_at ?? household.submission?.updated_at ?? null)}</time></div>)}</div>{household.submission?.note && <p className="party-note"><strong>Note:</strong> {household.submission.note}</p>}</article>;
      }) : <p className="empty-state">No invitation parties match this search and filter.</p>}</div> : <div className="directory-list">{responseDirectory.length ? responseDirectory.map((guest) => <div className={`directory-row status-${guest.response ?? "pending"}`} key={guest.id}><div><strong>{guest.display_name}</strong><span>{guest.householdName} · <a href={guest.invitationLink}>{guest.invitationLink}</a></span></div><div><b>{responseLabel(guest.response)}</b><time>{formatDateTime(guest.response_updated_at ?? guest.submissionUpdatedAt)}</time></div></div>) : <p className="empty-state">No guests match this search and filter.</p>}</div>}
    </section>

    <section className="admin-card"><div className="section-heading"><div><p className="admin-kicker">Shared across every link</p><h2>Event details</h2></div><span>Basic edits update all invitations</span></div>
      <div className="field-grid">
        <label>Event title<input value={event.event_title} onChange={(e) => updateEvent("event_title", e.target.value)} /></label>
        <label>Hosts<input value={event.hosts_display} onChange={(e) => updateEvent("hosts_display", e.target.value)} /></label>
        <label>Date and time<input type="datetime-local" value={toLocalInput(event.event_starts_at)} onChange={(e) => updateEvent("event_starts_at", new Date(e.target.value).toISOString())} /></label>
        <label>RSVP deadline<input type="date" value={event.rsvp_deadline} onChange={(e) => updateEvent("rsvp_deadline", e.target.value)} /></label>
        <label>Venue<input value={event.venue_name} onChange={(e) => updateEvent("venue_name", e.target.value)} /></label>
        <label className="wide">Address<input value={event.venue_address} onChange={(e) => updateEvent("venue_address", e.target.value)} /></label>
        <label>Email<input type="email" value={event.contact_email} onChange={(e) => updateEvent("contact_email", e.target.value)} /></label>
        <label>Phone in +1 format<input value={event.contact_phone} onChange={(e) => updateEvent("contact_phone", e.target.value)} /></label>
        <label className="wide">Babylist registry URL<input type="url" value={event.registry_url} onChange={(e) => updateEvent("registry_url", e.target.value)} /></label>
        <label className="wide">Hilton booking URL<input type="url" value={event.hotel_booking_url} onChange={(e) => updateEvent("hotel_booking_url", e.target.value)} /></label>
        <label>Hotel deadline<input type="date" value={event.hotel_booking_deadline} onChange={(e) => updateEvent("hotel_booking_deadline", e.target.value)} /></label>
        <label>Group code<input value={event.hotel_group_code} onChange={(e) => updateEvent("hotel_group_code", e.target.value)} /></label>
        <label>Rate label<input value={event.hotel_rate_label} onChange={(e) => updateEvent("hotel_rate_label", e.target.value)} /></label>
        <label className="wide">Copy-message template<textarea value={event.copy_message_template} onChange={(e) => updateEvent("copy_message_template", e.target.value)} /><small>Keep <code>{"{{household}}"}</code> and <code>{"{{link}}"}</code> where the name and link should appear.</small></label>
      </div>
      <button className="admin-primary" disabled={busy === "event"} onClick={() => save({ kind: "event", eventTitle: event.event_title, hostsDisplay: event.hosts_display, eventStartsAt: event.event_starts_at, rsvpDeadline: event.rsvp_deadline, venueName: event.venue_name, venueAddress: event.venue_address, contactEmail: event.contact_email, contactPhone: event.contact_phone, registryUrl: event.registry_url, hotelBookingUrl: event.hotel_booking_url, hotelBookingDeadline: event.hotel_booking_deadline, hotelGroupCode: event.hotel_group_code, hotelRateLabel: event.hotel_rate_label, copyMessageTemplate: event.copy_message_template }, "event")}>{busy === "event" ? "Saving…" : "Save event details"}</button>
    </section>

    <section className="admin-card" id="invitation-settings"><div className="section-heading"><div><p className="admin-kicker">Invitation settings</p><h2>Edit names and short links</h2></div><span>Open a party only when its invitation details need changing</span></div>
      <div className="household-list">{data.households.map((household) => {
        const link = invitationLink(household.slug);
        const message = event.copy_message_template.replaceAll("{{household}}", household.message_greeting).replaceAll("{{link}}", link);
        return <details className="household-card" key={household.id}><summary><div><strong>{household.display_name}</strong><span>/invite/{household.slug}</span></div><div className="response-pills"><i>{household.guests.filter((g) => g.response === "yes").length} yes</i><i>{household.guests.filter((g) => g.response === "no").length} no</i><i>{household.guests.filter((g) => g.response === null).length} pending</i></div></summary>
          <div className="household-body"><div className="copy-row"><button className={copiedKey === `${household.id}-link` ? "copy-success" : ""} onClick={() => copy(link, "Invitation link copied.", `${household.id}-link`)}>{copiedKey === `${household.id}-link` ? "✓ Copied!" : "Copy link"}</button><button className={copiedKey === `${household.id}-message` ? "copy-success" : ""} onClick={() => copy(message, "Ready-to-send message copied.", `${household.id}-message`)}>{copiedKey === `${household.id}-message` ? "✓ Copied!" : "Copy message"}</button><a href={`/invite/${household.slug}`} target="_blank" rel="noreferrer">Preview invitation</a></div>
            <div className="household-response-list"><div className="subsection-heading"><strong>Who responded</strong><span>{household.guests.filter((guest) => guest.response === "yes").length} yes · {household.guests.filter((guest) => guest.response === "no").length} no · {household.guests.filter((guest) => guest.response === null).length} pending</span></div>{household.guests.map((guest) => <div className={`household-response-row status-${guest.response ?? "pending"}`} key={guest.id}><div><strong>{guest.display_name}</strong><span>{responseLabel(guest.response)}</span></div><time>{formatDateTime(guest.response_updated_at ?? household.submission?.updated_at ?? null)}</time></div>)}</div>
            <div className="field-grid"><label>Short link<input value={household.slug} onChange={(e) => updateHousehold(household.id, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label><label>Dashboard name<input value={household.display_name} onChange={(e) => updateHousehold(household.id, { display_name: e.target.value })} /></label><label className="wide">Invitation “For” wording<input value={household.invitation_label} onChange={(e) => updateHousehold(household.id, { invitation_label: e.target.value })} /></label><label>Thank-you greeting<input value={household.message_greeting} onChange={(e) => updateHousehold(household.id, { message_greeting: e.target.value })} /></label></div>
            <fieldset><legend>Names shown on this RSVP</legend>{household.guests.map((guest) => <label className="guest-edit" key={guest.id}><input value={guest.display_name} onChange={(e) => updateGuest(household.id, guest.id, e.target.value)} /><span data-response={guest.response ?? "pending"}>{guest.response ?? "pending"}</span></label>)}</fieldset>
            {household.submission && <p className="submission-note">Last response {new Date(household.submission.updated_at).toLocaleString()}{household.submission.note ? ` · “${household.submission.note}”` : ""}</p>}
            <button className="admin-primary" disabled={busy === household.id} onClick={() => save({ kind: "household", id: household.id, slug: household.slug, displayName: household.display_name, invitationLabel: household.invitation_label, messageGreeting: household.message_greeting, guests: household.guests.map((guest) => ({ id: guest.id, name: guest.display_name })) }, household.id)}>{busy === household.id ? "Saving…" : "Save this invitation"}</button>
          </div></details>;
      })}</div>
    </section>
    <section className="admin-card registry-admin"><p className="admin-kicker">Registry accuracy</p><h2>Babylist remains the live source</h2><p>The invitation refreshes its product images, purchase status, and exact item links directly from Babylist whenever a guest opens the registry. If that refresh fails, guests are sent to the official Babylist registry instead of seeing stale products.</p><a href={event.registry_url} target="_blank" rel="noreferrer">Open and verify the live Babylist registry</a></section>
  </main>;
}
