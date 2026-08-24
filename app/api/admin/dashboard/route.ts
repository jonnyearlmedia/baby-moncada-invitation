import { z } from "zod";
import { hasHostSession } from "@/lib/admin-session";
import { createAdminServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  kind: z.literal("event"),
  eventTitle: z.string().trim().min(1).max(100),
  hostsDisplay: z.string().trim().min(1).max(100),
  eventStartsAt: z.string().datetime({ offset: true }),
  venueName: z.string().trim().min(1).max(150),
  venueAddress: z.string().trim().min(1).max(250),
  contactEmail: z.string().email(),
  contactPhone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/),
  registryUrl: z.string().url().startsWith("https://"),
  hotelBookingUrl: z.string().url().startsWith("https://"),
  hotelBookingDeadline: z.string().date(),
  hotelGroupCode: z.string().trim().min(1).max(30),
  hotelRateLabel: z.string().trim().min(1).max(80),
  copyMessageTemplate: z.string().min(1).max(500).refine((value) => value.includes("{{link}}"), "Message must include {{link}}"),
});

const householdSchema = z.object({
  kind: z.literal("household"),
  id: z.string().uuid(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  displayName: z.string().trim().min(1).max(300),
  invitationLabel: z.string().trim().min(1).max(300),
  messageGreeting: z.string().trim().min(1).max(150),
  guests: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(100) })).min(1).max(20),
});

function dbError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function GET() {
  if (!(await hasHostSession())) return Response.json({ error: "Host sign-in required." }, { status: 401 });
  try {
    const admin = createAdminServerClient();
    const [eventResult, householdsResult, guestsResult, submissionsResult, responsesResult, syncResult] = await Promise.all([
      admin.from("event_settings").select("*").single(),
      admin.from("households").select("*").order("display_name"),
      admin.from("guests").select("*").order("sort_order"),
      admin.from("rsvp_submissions").select("*"),
      admin.from("rsvp_guest_responses").select("*"),
      admin.from("registry_sync_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    for (const result of [eventResult, householdsResult, guestsResult, submissionsResult, responsesResult, syncResult]) dbError(result.error);
    const guests = guestsResult.data ?? [];
    const responses = responsesResult.data ?? [];
    const submissions = submissionsResult.data ?? [];
    return Response.json({
      event: eventResult.data,
      households: (householdsResult.data ?? []).map((household) => ({
        ...household,
        guests: guests.filter((guest) => guest.household_id === household.id).map((guest) => ({
          ...guest,
          response: responses.find((response) => response.guest_id === guest.id)?.response ?? null,
        })),
        submission: submissions.find((submission) => submission.household_id === household.id) ?? null,
      })),
      registrySync: syncResult.data ?? null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("dashboard_load_failed", error);
    return Response.json({ error: "Dashboard data could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await hasHostSession())) return Response.json({ error: "Host sign-in required." }, { status: 401 });
  try {
    const raw = await request.json();
    const admin = createAdminServerClient();
    if (raw?.kind === "event") {
      const parsed = eventSchema.safeParse(raw);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the event details." }, { status: 400 });
      const { kind: _kind, ...settings } = parsed.data;
      void _kind;
      const { error } = await admin.rpc("admin_update_event", { p_settings: settings });
      dbError(error);
    } else {
      const parsed = householdSchema.safeParse(raw);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the household details." }, { status: 400 });
      const { error } = await admin.rpc("admin_update_household", {
        p_household_id: parsed.data.id,
        p_slug: parsed.data.slug,
        p_display_name: parsed.data.displayName,
        p_invitation_label: parsed.data.invitationLabel,
        p_message_greeting: parsed.data.messageGreeting,
        p_guests: parsed.data.guests,
      });
      dbError(error);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("dashboard_save_failed", error);
    const message = error instanceof Error && error.message.includes("already in use") ? "That invitation link is already in use." : "Changes were not saved. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
