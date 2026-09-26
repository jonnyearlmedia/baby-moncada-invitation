import { z } from "zod";
import { hashIp } from "@/lib/admin-session";
import { GUESTBOOK_FRAMES, GUESTBOOK_MESSAGE_MAX, GUESTBOOK_NAME_MAX, GUESTBOOK_PHOTO_MAX_BYTES, GUESTBOOK_SIGN_OFFS } from "@/lib/guestbook";
import { createGuestbookEntry, listGuestbookEntries } from "@/lib/guestbook-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 10 * 60 * 1000;
// Guests on the venue wifi share one public IP, so this only stops runaway spam.
const RATE_LIMIT = 40;
const recentByIp = new Map<string, number[]>();

const entrySchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(GUESTBOOK_NAME_MAX),
  message: z.string().trim().min(1, "Write a little something first.").max(GUESTBOOK_MESSAGE_MAX),
  signOff: z.enum(GUESTBOOK_SIGN_OFFS),
  frame: z.enum(GUESTBOOK_FRAMES),
});

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function overRateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = hashIp(forwarded);
  const now = Date.now();
  const recent = (recentByIp.get(key) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  recentByIp.set(key, recent);
  return recent.length > RATE_LIMIT;
}

export async function GET() {
  try {
    return Response.json({ entries: await listGuestbookEntries() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("guestbook_load_failed", error);
    return Response.json({ error: "The guestbook could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > GUESTBOOK_PHOTO_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: "That photo is too large. Try taking it again." }, { status: 413 });
  }
  try {
    const form = await request.formData();
    const parsed = entrySchema.safeParse({ name: form.get("name") ?? "", message: form.get("message") ?? "", signOff: form.get("signOff") ?? "Love,", frame: form.get("frame") ?? "none" });
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check your entry." }, { status: 400 });
    if (overRateLimit(request)) return Response.json({ error: "Lots of entries from here at once. Give it a few minutes." }, { status: 429 });

    let photo: Uint8Array | null = null;
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) {
      if (file.size > GUESTBOOK_PHOTO_MAX_BYTES) return Response.json({ error: "That photo is too large. Try taking it again." }, { status: 413 });
      photo = new Uint8Array(await file.arrayBuffer());
      if (!isJpeg(photo)) return Response.json({ error: "That photo did not come through. Try taking it again." }, { status: 400 });
    }

    const entry = await createGuestbookEntry({ ...parsed.data, photo });
    return Response.json({ entry }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("guestbook_save_failed", error);
    return Response.json({ error: "Your entry was not saved. Please try again." }, { status: 500 });
  }
}
