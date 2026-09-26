import { z } from "zod";
import { hasHostSession } from "@/lib/admin-session";
import { GUESTBOOK_COLUMNS, type GuestbookRow } from "@/lib/guestbook";
import { toGuestbookEntry } from "@/lib/guestbook-server";
import { createAdminServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const visibilitySchema = z.object({ id: z.string().uuid(), hidden: z.boolean() });

export async function GET() {
  if (!(await hasHostSession())) return Response.json({ error: "Host sign-in required." }, { status: 401 });
  try {
    const admin = createAdminServerClient();
    const { data, error } = await admin.from("guestbook_entries").select(GUESTBOOK_COLUMNS).order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return Response.json({ entries: (data as GuestbookRow[]).map((row) => toGuestbookEntry(admin, row, true)) }, { headers: { "Cache-Control": "private, no-store" } });
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
    const admin = createAdminServerClient();
    const { error } = await admin.from("guestbook_entries").update({ hidden: parsed.data.hidden }).eq("id", parsed.data.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("guestbook_admin_save_failed", error);
    return Response.json({ error: "That change was not saved. Please try again." }, { status: 500 });
  }
}
