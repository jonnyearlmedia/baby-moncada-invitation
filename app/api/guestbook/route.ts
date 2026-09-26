import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashIp } from "@/lib/admin-session";
import { GUESTBOOK_BUCKET, GUESTBOOK_COLUMNS, GUESTBOOK_FRAMES, GUESTBOOK_MESSAGE_MAX, GUESTBOOK_NAME_MAX, GUESTBOOK_PHOTO_MAX_BYTES, type GuestbookRow } from "@/lib/guestbook";
import { toGuestbookEntry } from "@/lib/guestbook-server";
import { createAdminServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 10 * 60 * 1000;
// Guests on the venue wifi share one public IP, so this only stops runaway spam.
const RATE_LIMIT = 40;

const entrySchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(GUESTBOOK_NAME_MAX),
  message: z.string().trim().min(1, "Write a little something first.").max(GUESTBOOK_MESSAGE_MAX),
  frame: z.enum(GUESTBOOK_FRAMES),
});

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function GET() {
  try {
    const admin = createAdminServerClient();
    const { data, error } = await admin.from("guestbook_entries").select(GUESTBOOK_COLUMNS).eq("hidden", false).order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return Response.json({ entries: (data as GuestbookRow[]).map((row) => toGuestbookEntry(admin, row)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("guestbook_load_failed", error);
    return Response.json({ error: "The guestbook could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > GUESTBOOK_PHOTO_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: "That photo is too large. Try taking it again." }, { status: 413 });
  }
  let uploadedPath: string | null = null;
  const admin = createAdminServerClient();
  try {
    const form = await request.formData();
    const parsed = entrySchema.safeParse({ name: form.get("name") ?? "", message: form.get("message") ?? "", frame: form.get("frame") ?? "none" });
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check your entry." }, { status: 400 });

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = hashIp(forwarded);
    const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count, error: countError } = await admin.from("guestbook_entries").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", cutoff);
    if (countError) throw countError;
    if ((count ?? 0) >= RATE_LIMIT) return Response.json({ error: "Lots of entries from here at once. Give it a few minutes." }, { status: 429 });

    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > GUESTBOOK_PHOTO_MAX_BYTES) return Response.json({ error: "That photo is too large. Try taking it again." }, { status: 413 });
      const bytes = new Uint8Array(await photo.arrayBuffer());
      if (!isJpeg(bytes)) return Response.json({ error: "That photo did not come through. Try taking it again." }, { status: 400 });
      const path = `entries/${randomUUID()}.jpg`;
      const { error: uploadError } = await admin.storage.from(GUESTBOOK_BUCKET).upload(path, bytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      uploadedPath = path;
    }

    const { data, error } = await admin.from("guestbook_entries").insert({
      guest_name: parsed.data.name,
      message: parsed.data.message,
      frame: uploadedPath ? parsed.data.frame : "none",
      photo_path: uploadedPath,
      ip_hash: ipHash,
    }).select(GUESTBOOK_COLUMNS).single();
    if (error) throw error;
    return Response.json({ entry: toGuestbookEntry(admin, data as GuestbookRow) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("guestbook_save_failed", error);
    if (uploadedPath) await admin.storage.from(GUESTBOOK_BUCKET).remove([uploadedPath]);
    return Response.json({ error: "Your entry was not saved. Please try again." }, { status: 500 });
  }
}
