import { randomUUID } from "node:crypto";
import { GUESTBOOK_BUCKET, GUESTBOOK_PHOTO_MAX_BYTES, type GuestbookEntry, type GuestbookFrame, type GuestbookSignOff } from "@/lib/guestbook";
import { createAdminServerClient } from "@/lib/supabase-server";

// Entries live as small JSON files next to the photos in one storage bucket,
// so the guestbook needs no database migration. The bucket creates itself.
type StoredEntry = {
  id: string;
  name: string;
  message: string;
  signOff: GuestbookSignOff;
  frame: GuestbookFrame;
  photoPath: string | null;
  hidden: boolean;
  createdAt: string;
};

const ENTRY_DIR = "entries";
const PHOTO_DIR = "photos";
const CACHE_MS = 4_000;

let bucketReady: Promise<void> | null = null;
let cache: { at: number; entries: StoredEntry[] } | null = null;

function client() {
  return createAdminServerClient();
}

async function ensureBucket() {
  bucketReady ??= (async () => {
    const storage = client().storage;
    const { error } = await storage.getBucket(GUESTBOOK_BUCKET);
    if (!error) return;
    const created = await storage.createBucket(GUESTBOOK_BUCKET, { public: true, fileSizeLimit: GUESTBOOK_PHOTO_MAX_BYTES, allowedMimeTypes: ["image/jpeg", "application/json"] });
    if (created.error && !/exist/i.test(created.error.message)) throw created.error;
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

function entryPath(id: string) {
  return `${ENTRY_DIR}/${id}.json`;
}

async function writeEntry(entry: StoredEntry) {
  const body = new Blob([JSON.stringify(entry)], { type: "application/json" });
  const { error } = await client().storage.from(GUESTBOOK_BUCKET).upload(entryPath(entry.id), body, { contentType: "application/json", cacheControl: "0", upsert: true });
  if (error) throw error;
  cache = null;
}

async function readEntry(path: string) {
  const { data, error } = await client().storage.from(GUESTBOOK_BUCKET).download(path);
  if (error) return null;
  try {
    return JSON.parse(await data.text()) as StoredEntry;
  } catch {
    return null;
  }
}

async function loadAll() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.entries;
  await ensureBucket();
  const { data, error } = await client().storage.from(GUESTBOOK_BUCKET).list(ENTRY_DIR, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  const files = (data ?? []).filter((file) => file.name.endsWith(".json"));
  const entries = (await Promise.all(files.map((file) => readEntry(`${ENTRY_DIR}/${file.name}`))))
    .filter((entry): entry is StoredEntry => Boolean(entry))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  cache = { at: Date.now(), entries };
  return entries;
}

function toPublic(entry: StoredEntry, includeHidden: boolean): GuestbookEntry {
  return {
    id: entry.id,
    name: entry.name,
    message: entry.message,
    signOff: entry.signOff,
    frame: entry.frame,
    photoUrl: entry.photoPath ? client().storage.from(GUESTBOOK_BUCKET).getPublicUrl(entry.photoPath).data.publicUrl : null,
    createdAt: entry.createdAt,
    ...(includeHidden ? { hidden: entry.hidden } : {}),
  };
}

export async function listGuestbookEntries(includeHidden = false) {
  const entries = await loadAll();
  return entries.filter((entry) => includeHidden || !entry.hidden).map((entry) => toPublic(entry, includeHidden));
}

export async function createGuestbookEntry(input: { name: string; message: string; signOff: GuestbookSignOff; frame: GuestbookFrame; photo: Uint8Array | null }) {
  await ensureBucket();
  const id = randomUUID();
  const storage = client().storage.from(GUESTBOOK_BUCKET);
  let photoPath: string | null = null;
  if (input.photo) {
    photoPath = `${PHOTO_DIR}/${id}.jpg`;
    const { error } = await storage.upload(photoPath, input.photo, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (error) throw error;
  }
  const entry: StoredEntry = { id, name: input.name, message: input.message, signOff: input.signOff, frame: photoPath ? input.frame : "none", photoPath, hidden: false, createdAt: new Date().toISOString() };
  try {
    await writeEntry(entry);
  } catch (error) {
    if (photoPath) await storage.remove([photoPath]);
    throw error;
  }
  return toPublic(entry, false);
}

export async function setGuestbookEntryHidden(id: string, hidden: boolean) {
  await ensureBucket();
  const entry = await readEntry(entryPath(id));
  if (!entry) return false;
  await writeEntry({ ...entry, hidden });
  return true;
}
