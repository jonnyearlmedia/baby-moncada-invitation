"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fillMessage, THANK_YOU_GIFT_MAX, THANK_YOU_NOTE_MAX, type ThankYouNote, type ThankYouSettings } from "@/lib/thank-you";

type Household = { id: string; slug: string; display_name: string; message_greeting: string; guests: { response: "yes" | "no" | null }[] };
type Draft = { gift: string; note: string };
type Filter = "all" | "personal" | "unsent" | "sent";

const FILTERS: [Filter, string][] = [["all", "Everyone"], ["personal", "Needs a note"], ["unsent", "Not sent"], ["sent", "Sent"]];

function formatSent(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ThankYouManager({ households }: { households: Household[] }) {
  const [settings, setSettings] = useState<ThankYouSettings | null>(null);
  const [notes, setNotes] = useState<Record<string, ThankYouNote>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/thank-yous", { cache: "no-store" });
    const body = await response.json() as { settings?: ThankYouSettings; notes?: ThankYouNote[]; drafts?: Record<string, Draft>; error?: string };
    if (!response.ok || !body.settings) { setError(body.error ?? "Thank yous could not be loaded."); return; }
    setSettings(body.settings);
    setNotes(Object.fromEntries((body.notes ?? []).map((note) => [note.householdId, note])));
    setDrafts(body.drafts ?? {});
    setError("");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // What each field shows: an unsaved edit, else the saved note, else Jonny's draft.
  const valueFor = useCallback((household: Household): Draft & { source: "edit" | "saved" | "draft" | "empty" } => {
    const edit = edits[household.id];
    if (edit) return { ...edit, source: "edit" };
    const saved = notes[household.id];
    if (saved && (saved.note || saved.gift)) return { gift: saved.gift, note: saved.note, source: "saved" };
    const draft = drafts[household.slug];
    if (draft) return { ...draft, source: "draft" };
    return { gift: "", note: "", source: "empty" };
  }, [drafts, edits, notes]);

  const progress = useMemo(() => ({
    personal: households.filter((household) => notes[household.id]?.note).length,
    sent: households.filter((household) => notes[household.id]?.sentAt).length,
  }), [households, notes]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return households.filter((household) => {
      const note = notes[household.id];
      const matches = filter === "all" || (filter === "personal" ? !note?.note : filter === "sent" ? Boolean(note?.sentAt) : !note?.sentAt);
      return matches && (!query || `${household.display_name} ${household.slug}`.toLocaleLowerCase().includes(query));
    });
  }, [filter, households, notes, search]);

  async function patch(householdId: string, body: Partial<Draft> & { sent?: boolean }) {
    const response = await fetch("/api/admin/thank-yous", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ householdId, ...body }) });
    const result = await response.json() as { note?: ThankYouNote; error?: string };
    if (!response.ok || !result.note) throw new Error(result.error ?? "That note was not saved.");
    const saved = result.note;
    setNotes((current) => ({ ...current, [householdId]: saved }));
    setEdits((current) => { const next = { ...current }; delete next[householdId]; return next; });
    return saved;
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key); setError(""); setNotice("");
    try { await action(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "That change was not saved."); }
    setBusy("");
  }

  async function saveSettings(next: ThankYouSettings, message: string) {
    await run("settings", async () => {
      const response = await fetch("/api/admin/thank-yous", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ live: next.live, defaultNote: next.defaultNote, messageTemplate: next.messageTemplate }) });
      const result = await response.json() as { settings?: ThankYouSettings; error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error ?? "Those settings were not saved.");
      setSettings(result.settings);
      setNotice(message);
    });
  }

  function linkFor(household: Household) {
    return `${window.location.origin}/invite/${household.slug}`;
  }

  // Copying the text is the moment it goes out, so it also saves the note and
  // marks the household sent. "Not sent" undoes that.
  async function copyMessage(household: Household) {
    if (!settings) return;
    const value = valueFor(household);
    await run(household.id, async () => {
      await navigator.clipboard.writeText(fillMessage(settings.messageTemplate, household.message_greeting, linkFor(household)));
      await patch(household.id, { gift: value.gift, note: value.note, sent: true });
      setCopied(household.id);
      window.setTimeout(() => setCopied((current) => current === household.id ? "" : current), 1800);
      setNotice(`Message for ${household.display_name} copied and marked sent.${settings.live ? "" : " Postcards are still off, so turn them on before they open the link."}`);
    });
  }

  if (!settings) return <section className="admin-card thank-you-admin"><p className="admin-kicker">Thank yous</p><p>{error || "Loading thank yous…"}</p></section>;

  return <section className="admin-card thank-you-admin" id="thank-yous">
    <div className="section-heading"><div><p className="admin-kicker">Thank yous</p><h2>A postcard for every household</h2></div><span>{progress.personal} of {households.length} personal notes · {progress.sent} sent</span></div>
    <div className={`thank-you-live${settings.live ? " on" : ""}`}>
      <div><strong>{settings.live ? "Postcards are on" : "Postcards are off"}</strong><p>{settings.live ? "Every invitation link now opens as that household’s thank you postcard." : "Invitation links still show the arrived boarding pass. Preview any postcard below, then turn them on when you are ready to send."}</p></div>
      <button className={settings.live ? "admin-secondary" : "admin-primary"} disabled={busy === "settings"} onClick={() => void saveSettings({ ...settings, live: !settings.live }, settings.live ? "Postcards turned off." : "Postcards are on.")}>{settings.live ? "Turn off" : "Turn postcards on"}</button>
    </div>
    {(error || notice) && <div className={error ? "admin-alert error" : "admin-alert"} role="status">{error || notice}</div>}

    <details className="builder-advanced thank-you-settings"><summary>General note and text message</summary>
      <div className="field-grid">
        <label className="wide">General note<textarea value={settings.defaultNote} maxLength={THANK_YOU_NOTE_MAX} onChange={(event) => setSettings({ ...settings, defaultNote: event.target.value })} /><small>Any household without a personal note gets this one.</small></label>
        <label className="wide">Text message<textarea value={settings.messageTemplate} maxLength={500} onChange={(event) => setSettings({ ...settings, messageTemplate: event.target.value })} /><small>Keep <code>{"{{household}}"}</code> and <code>{"{{link}}"}</code> where the name and link go.</small></label>
      </div>
      <button className="admin-primary" disabled={busy === "settings"} onClick={() => void saveSettings(settings, "General note and message saved.")}>{busy === "settings" ? "Saving…" : "Save note and message"}</button>
    </details>

    <div className="directory-controls"><label>Search households<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try Murao or Castro" /></label><div className="filter-row" aria-label="Filter thank yous">{FILTERS.map(([key, label]) => <button key={key} className={filter === key ? "filter-button selected" : "filter-button"} onClick={() => setFilter(key)}>{label}</button>)}</div></div>

    <div className="thank-you-list">{visible.length ? visible.map((household) => {
      const value = valueFor(household);
      const saved = notes[household.id];
      const attended = household.guests.some((guest) => guest.response === "yes");
      const dirty = value.source === "edit" || value.source === "draft";
      const setField = (field: keyof Draft, text: string) => setEdits((current) => ({ ...current, [household.id]: { gift: value.gift, note: value.note, [field]: text } }));
      return <article className={`thank-you-card${saved?.sentAt ? " sent" : ""}`} key={household.id}>
        <header><div><strong>{household.display_name}</strong><span>{attended ? "Came to the shower" : "Did not RSVP yes"} · /invite/{household.slug}</span></div>
          <i className="thank-you-status">{saved?.sentAt ? `Sent ${formatSent(saved.sentAt)}` : value.source === "draft" ? "Draft, not saved" : saved?.note ? "Note written" : "General note"}</i></header>
        <div className="field-grid">
          <label className="wide"><span>Gift <span className="optional">optional</span></span><input value={value.gift} maxLength={THANK_YOU_GIFT_MAX} placeholder="The stroller, a diaper cake…" onChange={(event) => setField("gift", event.target.value)} /></label>
          <label className="wide">Personal note<textarea value={value.note} maxLength={THANK_YOU_NOTE_MAX} placeholder={settings.defaultNote} onChange={(event) => setField("note", event.target.value)} /><small>{value.note ? `${value.note.length}/${THANK_YOU_NOTE_MAX}` : "Empty uses the general note."}</small></label>
        </div>
        <div className="copy-row">
          <button disabled={busy === household.id || !dirty} onClick={() => void run(household.id, async () => { await patch(household.id, { gift: value.gift, note: value.note }); setNotice(`Saved ${household.display_name}.`); })}>{busy === household.id ? "Saving…" : dirty ? "Save note" : "Saved"}</button>
          <button className={copied === household.id ? "copy-success" : ""} disabled={busy === household.id} onClick={() => void copyMessage(household)}>{copied === household.id ? "✓ Copied!" : "Copy message"}</button>
          <a href={`/invite/${household.slug}?postcard=preview`} target="_blank" rel="noreferrer">Preview postcard</a>
          {saved?.sentAt && <button className="admin-secondary" disabled={busy === household.id} onClick={() => void run(household.id, async () => { await patch(household.id, { sent: false }); })}>Mark not sent</button>}
        </div>
      </article>;
    }) : <p className="empty-state">No households match.</p>}</div>
  </section>;
}
