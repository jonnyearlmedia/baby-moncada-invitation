import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { guests, households, rsvpResponses } from "../../../db/schema";

const PREVIEW_INVITE = {
  code: "murao-family-2-f7c4a9",
  displayName: "The Murao Family",
  guests: ["Elsa", "Jonathan"],
};

type Attendance = "yes" | "no";

async function hash(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCode(request: Request) {
  return new URL(request.url).searchParams.get("code")?.trim() ?? "";
}

async function findOrCreateHousehold(code: string) {
  if (code !== PREVIEW_INVITE.code) return null;
  const tokenHash = await hash(code);
  const db = getDb();
  let household = await db.query.households.findFirst({ where: eq(households.tokenHash, tokenHash) });

  if (!household) {
    const [created] = await db.insert(households).values({ tokenHash, displayName: PREVIEW_INVITE.displayName }).onConflictDoNothing().returning();
    household = created ?? await db.query.households.findFirst({ where: eq(households.tokenHash, tokenHash) });
  }
  if (!household) throw new Error("The invitation could not be created");

  const existingGuests = await db.select().from(guests).where(eq(guests.householdId, household.id));
  if (existingGuests.length === 0) {
    await db.insert(guests).values(PREVIEW_INVITE.guests.map((displayName, sortOrder) => ({ householdId: household!.id, displayName, sortOrder }))).onConflictDoNothing();
  }
  return household;
}

async function invitationPayload(code: string) {
  const household = await findOrCreateHousehold(code);
  if (!household) return null;
  const db = getDb();
  const invitedGuests = await db.select().from(guests).where(eq(guests.householdId, household.id)).orderBy(asc(guests.sortOrder), asc(guests.id));
  const response = await db.query.rsvpResponses.findFirst({ where: eq(rsvpResponses.householdId, household.id) });
  const saved = response ? JSON.parse(response.attendanceJson) as Record<string, Attendance> : {};
  return {
    household: household.displayName,
    guests: invitedGuests.map((guest) => ({ id: guest.id, name: guest.displayName, response: saved[String(guest.id)] ?? null })),
    note: response?.note ?? "",
    submitted: Boolean(response),
    updatedAt: response?.updatedAt?.toISOString() ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const code = readCode(request);
    const invitation = await invitationPayload(code);
    if (!invitation) return Response.json({ error: "This invitation link is not valid." }, { status: 404 });
    return Response.json(invitation, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "We couldn’t load this RSVP.", detail: error instanceof Error ? error.message : "Unknown RSVP error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const code = readCode(request);
    const household = await findOrCreateHousehold(code);
    if (!household) return Response.json({ error: "This invitation link is not valid." }, { status: 404 });
    const body = await request.json() as { guests?: { id?: number; response?: Attendance }[]; note?: string };
    const note = (body.note ?? "").trim().slice(0, 180);
    const db = getDb();
    const invitedGuests = await db.select().from(guests).where(eq(guests.householdId, household.id));
    const invitedIds = new Set(invitedGuests.map((guest) => guest.id));
    const received = body.guests ?? [];

    if (received.length !== invitedGuests.length || received.some((guest) => !guest.id || !invitedIds.has(guest.id) || !["yes", "no"].includes(guest.response ?? ""))) {
      return Response.json({ error: "Please answer for every person named on this invitation." }, { status: 400 });
    }

    const attendance = Object.fromEntries(received.map((guest) => [String(guest.id), guest.response]));
    await db.insert(rsvpResponses).values({ householdId: household.id, attendanceJson: JSON.stringify(attendance), note })
      .onConflictDoUpdate({ target: rsvpResponses.householdId, set: { attendanceJson: JSON.stringify(attendance), note, updatedAt: new Date() } });
    const invitation = await invitationPayload(code);
    return Response.json(invitation, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "Your RSVP was not saved. Please try again.", detail: error instanceof Error ? error.message : "Unknown RSVP error" }, { status: 500 });
  }
}
