import { randomUUID } from "node:crypto";
import { createAdminServerClient } from "@/lib/supabase-server";
import { DEFAULT_THANK_YOU_SETTINGS, THANK_YOU_BUCKET, type ThankYouNote, type ThankYouPostcard, type ThankYouSettings } from "@/lib/thank-you";

// Like the guestbook, thank yous live as small JSON files in one storage
// bucket, so they need no database migration. This bucket is private: only the
// server, holding the secret key, reads or writes it.
const SETTINGS_PATH = "settings.json";
const NOTE_DIR = "notes";

let bucketReady: Promise<void> | null = null;
const known = new Map<string, { version: string; note: ThankYouNote }>();

function client() {
  return createAdminServerClient();
}

async function ensureBucket() {
  bucketReady ??= (async () => {
    const storage = client().storage;
    const { error } = await storage.getBucket(THANK_YOU_BUCKET);
    if (!error) return;
    const created = await storage.createBucket(THANK_YOU_BUCKET, { public: false, allowedMimeTypes: ["application/json"] });
    if (created.error && !/exist/i.test(created.error.message)) throw created.error;
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

// Supabase's CDN caches downloads, so every read carries a nonce to skip it.
async function readJson<T>(path: string, nonce: string = randomUUID()) {
  const { data, error } = await client().storage.from(THANK_YOU_BUCKET).download(path, { cacheNonce: nonce });
  if (error) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, value: unknown) {
  const body = new Blob([JSON.stringify(value)], { type: "application/json" });
  const { error } = await client().storage.from(THANK_YOU_BUCKET).upload(path, body, { contentType: "application/json", cacheControl: "0", upsert: true });
  if (error) throw error;
}

function notePath(householdId: string) {
  return `${NOTE_DIR}/${householdId}.json`;
}

export async function getThankYouSettings(): Promise<ThankYouSettings> {
  await ensureBucket();
  const stored = await readJson<Partial<ThankYouSettings>>(SETTINGS_PATH);
  return { ...DEFAULT_THANK_YOU_SETTINGS, ...stored };
}

export async function saveThankYouSettings(settings: Omit<ThankYouSettings, "updatedAt">) {
  await ensureBucket();
  const saved: ThankYouSettings = { ...settings, updatedAt: new Date().toISOString() };
  await writeJson(SETTINGS_PATH, saved);
  return saved;
}

export async function getThankYouNote(householdId: string) {
  await ensureBucket();
  return readJson<ThankYouNote>(notePath(householdId));
}

export async function listThankYouNotes() {
  await ensureBucket();
  const { data, error } = await client().storage.from(THANK_YOU_BUCKET).list(NOTE_DIR, { limit: 1000 });
  if (error) throw error;
  const files = (data ?? []).filter((file) => file.name.endsWith(".json"));
  const notes = await Promise.all(files.map(async (file) => {
    const meta = (file.metadata ?? {}) as { eTag?: string; lastModified?: string };
    const version = [meta.eTag, meta.lastModified, file.updated_at].filter(Boolean).join("|");
    const hit = known.get(file.name);
    if (hit && version && hit.version === version) return hit.note;
    const note = await readJson<ThankYouNote>(`${NOTE_DIR}/${file.name}`, version || randomUUID());
    if (note && version) known.set(file.name, { version, note });
    return note;
  }));
  return notes.filter((note): note is ThankYouNote => Boolean(note));
}

export async function saveThankYouNote(householdId: string, changes: Partial<Pick<ThankYouNote, "gift" | "note" | "sentAt">>) {
  await ensureBucket();
  const current = await getThankYouNote(householdId);
  const note: ThankYouNote = {
    householdId,
    gift: changes.gift ?? current?.gift ?? "",
    note: changes.note ?? current?.note ?? "",
    sentAt: changes.sentAt !== undefined ? changes.sentAt : current?.sentAt ?? null,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(notePath(householdId), note);
  return note;
}

type HouseholdRow = { id: string; slug: string; invitation_label: string; message_greeting: string };

async function findHousehold(slug: string) {
  const admin = client();
  const columns = "id, slug, invitation_label, message_greeting";
  const direct = await admin.from("households").select(columns).eq("slug", slug).eq("enabled", true).maybeSingle<HouseholdRow>();
  if (direct.error) throw direct.error;
  if (direct.data) return direct.data;
  const alias = await admin.from("household_slug_aliases").select("household_id").eq("slug", slug).maybeSingle<{ household_id: string }>();
  if (alias.error) throw alias.error;
  if (!alias.data) return null;
  const renamed = await admin.from("households").select(columns).eq("id", alias.data.household_id).eq("enabled", true).maybeSingle<HouseholdRow>();
  if (renamed.error) throw renamed.error;
  return renamed.data;
}

// The postcard a household's invitation link turns into. Null while the
// thank yous are not live (unless previewing) or the link is unknown, so the
// invitation renders as it always has.
export async function getThankYouPostcard(slug: string, preview: boolean): Promise<ThankYouPostcard | null> {
  const settings = await getThankYouSettings();
  if (!settings.live && !preview) return null;
  const household = await findHousehold(slug);
  if (!household) return null;
  const note = await getThankYouNote(household.id);
  return {
    slug: household.slug,
    greeting: household.message_greeting,
    addressee: household.invitation_label,
    gift: note?.gift.trim() ?? "",
    note: note?.note.trim() || settings.defaultNote,
  };
}
