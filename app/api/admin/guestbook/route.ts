import { z } from "zod";
import { hasHostSession } from "@/lib/admin-session";
import { GUESTBOOK_FRAMES, GUESTBOOK_MESSAGE_MAX, GUESTBOOK_NAME_MAX, GUESTBOOK_PHOTO_MAX_BYTES } from "@/lib/guestbook";
import { listGuestbookEntries, setGuestbookEntryPhoto, updateGuestbookEntry } from "@/lib/guestbook-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const changeSchema = z.object({
  id: z.string().uuid(),
  hidden: z.boolean().optional(),
  name: z.string().trim().min(1).max(GUESTBOOK_NAME_MAX).optional(),
  message: z.string().trim().min(1).max(GUESTBOOK_MESSAGE_MAX).optional(),
}).refine((value) => value.hidden !== undefined || value.name !== undefined || value.message !== undefined);

export async function GET() {
  if (!(await hasHostSession())) return Response.json({ error: "Host sign-in required." }, { status: 401 });
  try {
    return Response.json({ entries: await listGuestbookEntries(true) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("guestbook_admin_load_failed", error);
    return Response.json({ error: "Guestbook entries could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await hasHostSession())) return Response.json({ error: "Host sign-in required." }, { status: 401 });
  try {
    const parsed = changeSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the guestbook entry." }, { status: 400 });
    const { id, ...changes } = parsed.data;
    if (!(await updateGuestbookEntry(id, changes))) return Response.json({ error: "That entry no longer exists." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("guestbook_admin_save_failed", error);
    return Response.json({ error: "That change was not saved. Please try again." }, { status: 500 });
  }
}

const photoSchema = z.object({ id: z.string().uuid(), frame: z.enum(GUESTBOOK_FRAMES) });

// Attaches or replaces an entry's photo. The photo arrives already framed, as a JPEG.
export async function PUT(request: Request) {
  if (!(await hasHostSession())) return Response.json({ error: "Host sign-in required." }, { status: 401 });
  try {
    const form = await request.formData();
    const parsed = photoSchema.safeParse({ id: form.get("id"), frame: form.get("frame") ?? "none" });
    const file = form.get("photo");
    if (!parsed.success || !(file instanceof File) || file.size === 0 || file.size > GUESTBOOK_PHOTO_MAX_BYTES) return Response.json({ error: "Check the photo." }, { status: 400 });
    const photo = new Uint8Array(await file.arrayBuffer());
    if (!(photo[0] === 0xff && photo[1] === 0xd8 && photo[2] === 0xff)) return Response.json({ error: "The photo must be a JPEG." }, { status: 400 });
    if (!(await setGuestbookEntryPhoto(parsed.data.id, photo, parsed.data.frame))) return Response.json({ error: "That entry no longer exists." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("guestbook_admin_photo_failed", error);
    return Response.json({ error: "The photo was not saved. Please try again." }, { status: 500 });
  }
}
