import { z } from "zod";
import { hasHostSession } from "@/lib/admin-session";
import { listGuestbookEntries, setGuestbookEntryHidden } from "@/lib/guestbook-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const visibilitySchema = z.object({ id: z.string().uuid(), hidden: z.boolean() });

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
    const parsed = visibilitySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the guestbook entry." }, { status: 400 });
    if (!(await setGuestbookEntryHidden(parsed.data.id, parsed.data.hidden))) return Response.json({ error: "That entry no longer exists." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("guestbook_admin_save_failed", error);
    return Response.json({ error: "That change was not saved. Please try again." }, { status: 500 });
  }
}
