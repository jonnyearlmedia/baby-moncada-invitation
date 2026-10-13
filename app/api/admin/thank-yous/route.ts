import { z } from "zod";
import { hasHostSession } from "@/lib/admin-session";
import { THANK_YOU_GIFT_MAX, THANK_YOU_NOTE_MAX } from "@/lib/thank-you";
import { THANK_YOU_DRAFTS } from "@/lib/thank-you-drafts";
import { getThankYouSettings, listThankYouNotes, saveThankYouNote, saveThankYouSettings } from "@/lib/thank-you-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  live: z.boolean(),
  defaultNote: z.string().trim().min(1, "The general note cannot be empty.").max(THANK_YOU_NOTE_MAX),
  messageTemplate: z.string().trim().min(1).max(500).refine((value) => value.includes("{{link}}"), "The message must include {{link}}."),
});

const noteSchema = z.object({
  householdId: z.string().uuid(),
  gift: z.string().trim().max(THANK_YOU_GIFT_MAX).optional(),
  note: z.string().trim().max(THANK_YOU_NOTE_MAX).optional(),
  sent: z.boolean().optional(),
}).refine((value) => value.gift !== undefined || value.note !== undefined || value.sent !== undefined);

function unauthorized() {
  return Response.json({ error: "Host sign-in required." }, { status: 401 });
}

export async function GET() {
  if (!(await hasHostSession())) return unauthorized();
  try {
    const [settings, notes] = await Promise.all([getThankYouSettings(), listThankYouNotes()]);
    return Response.json({ settings, notes, drafts: THANK_YOU_DRAFTS }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("thank_you_load_failed", error);
    return Response.json({ error: "Thank yous could not be loaded." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await hasHostSession())) return unauthorized();
  try {
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the thank you settings." }, { status: 400 });
    return Response.json({ settings: await saveThankYouSettings(parsed.data) });
  } catch (error) {
    console.error("thank_you_settings_failed", error);
    return Response.json({ error: "Those settings were not saved. Please try again." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await hasHostSession())) return unauthorized();
  try {
    const parsed = noteSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the thank you note." }, { status: 400 });
    const { householdId, gift, note, sent } = parsed.data;
    const saved = await saveThankYouNote(householdId, { gift, note, ...(sent === undefined ? {} : { sentAt: sent ? new Date().toISOString() : null }) });
    return Response.json({ note: saved });
  } catch (error) {
    console.error("thank_you_note_failed", error);
    return Response.json({ error: "That note was not saved. Please try again." }, { status: 500 });
  }
}
