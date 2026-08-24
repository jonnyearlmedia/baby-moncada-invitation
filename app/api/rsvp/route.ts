import { z } from "zod";
import type { InvitationPayload } from "@/lib/invitation-types";
import { createPublicServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const submissionSchema = z.object({
  guests: z.array(z.object({ id: z.string().uuid(), response: z.enum(["yes", "no"]) })).min(1).max(20),
  note: z.string().max(180).default(""),
});

function readSlug(request: Request) {
  return slugSchema.safeParse(new URL(request.url).searchParams.get("slug") ?? "");
}

async function getInvitation(slug: string) {
  const client = createPublicServerClient();
  const { data, error } = await client.rpc("get_invitation", { p_slug: slug });
  if (error) throw error;
  return data as InvitationPayload | null;
}

export async function GET(request: Request) {
  const parsed = readSlug(request);
  if (!parsed.success) return Response.json({ error: "This invitation link is not valid." }, { status: 404 });
  try {
    const invitation = await getInvitation(parsed.data);
    if (!invitation) return Response.json({ error: "This invitation link is not valid." }, { status: 404 });
    return Response.json(invitation, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("rsvp_load_failed", { slug: parsed.data, error });
    return Response.json({ error: "We couldn’t load this RSVP." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsedSlug = readSlug(request);
  if (!parsedSlug.success) return Response.json({ error: "This invitation link is not valid." }, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) {
    return Response.json({ error: "The RSVP request is too large." }, { status: 413 });
  }
  try {
    const parsedBody = submissionSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return Response.json({ error: "Please answer for every person named on this invitation." }, { status: 400 });
    }
    const client = createPublicServerClient();
    const { error } = await client.rpc("submit_household_rsvp", {
      p_slug: parsedSlug.data,
      p_responses: parsedBody.data.guests.map((guest) => ({ guestId: guest.id, response: guest.response })),
      p_note: parsedBody.data.note.trim(),
    });
    if (error) {
      if (error.message.includes("Please answer for every person")) {
        return Response.json({ error: "Please answer for every person named on this invitation." }, { status: 400 });
      }
      throw error;
    }
    const invitation = await getInvitation(parsedSlug.data);
    if (!invitation) throw new Error("Invitation disappeared after RSVP save");
    return Response.json(invitation, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("rsvp_save_failed", { slug: parsedSlug.data, error });
    return Response.json({ error: "Your RSVP was not saved. Please try again." }, { status: 500 });
  }
}
