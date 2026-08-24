import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("confirmed event facts are consistent in UI and database seed", async () => {
  const [page, migration] = await Promise.all([read("app/page.tsx"), read("supabase/migrations/20260824073636_production_rsvp_pilot.sql")]);
  assert.match(page, /Sat, Sep 26 2026/);
  assert.match(page, /4:00 PM/);
  assert.match(page, /DTSTART;TZID=America\/Los_Angeles:20260926T160000/);
  assert.match(migration, /2026-09-26 16:00:00-07/);
  assert.match(migration, /5870 Labath Ave, Rohnert Park, CA 94928/);
  assert.match(migration, /2026-09-11/);
  assert.match(migration, /groupCode=905/);
});

test("all 58 households and readable links are seeded", async () => {
  const migration = await read("supabase/migrations/20260824073636_production_rsvp_pilot.sql");
  const expansion = await read("supabase/migrations/20260824090509_seed_remaining_guest_households.sql");
  for (const slug of ["murao", "ponticelle", "cabrera", "sainz", "morales-diaz", "castro", "murao-jeff-joyce", "murao-jerome", "murao-juliet-ferdie", "wilder-hernani", "tania-doukas", "gamez-burner"]) assert.ok(migration.includes(`'${slug}'`) || expansion.includes(`"slug":"${slug}"`), `missing ${slug}`);
  assert.equal((expansion.match(/"id":"10000000-/g) ?? []).length, 52);
  for (const name of ["Mom", "Jonathan Murao", "Auntie Grace Ponticelle", "Kuya Maikhi Cabrera", "Ate Michelle Cabrera", "Trish", "Tique", "Danny Sainz", "Jenna Sainz", "Angelina", "Lily", "Ava", "DJ", "Ray", "Facundo Morales", "Kelly Diaz", "Eleni", "Jose Castro", "Thalía Castro", "Uncle Jeff Murao", "Auntie Joyce Murao", "Justine", "Jade", "Frankie Gamez", "Shaun Burner"]) assert.ok(migration.includes(`'${name}'`) || expansion.includes(`"${name}"`), `missing ${name}`);
});

test("RSVP writes validate complete named responses inside one database transaction", async () => {
  const [route, migration] = await Promise.all([read("app/api/rsvp/route.ts"), read("supabase/migrations/20260824073636_production_rsvp_pilot.sql")]);
  assert.match(route, /submit_household_rsvp/);
  assert.match(route, /z\.enum\(\["yes", "no"\]\)/);
  assert.match(migration, /v_received_count <> v_invited_count/);
  assert.match(migration, /delete from public\.rsvp_guest_responses/);
  assert.match(migration, /insert into public\.rsvp_guest_responses/);
  assert.doesNotMatch(route, /D1|drizzle|Cloudflare/);
});

test("database tables are RLS-protected and old readable links survive renames", async () => {
  const migration = await read("supabase/migrations/20260824073636_production_rsvp_pilot.sql");
  for (const table of ["event_settings", "households", "household_slug_aliases", "guests", "rsvp_submissions", "rsvp_guest_responses", "registry_items", "registry_offers", "admin_login_attempts", "admin_audit_log"]) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, /insert into public\.household_slug_aliases\(slug, household_id\) values\(v_old_slug/);
});

test("host dashboard uses a hashed passcode, signed cookie, rate limits, and audit log", async () => {
  const [session, login, dashboard, migration] = await Promise.all([read("lib/admin-session.ts"), read("app/api/admin/session/route.ts"), read("app/dashboard/dashboard-client.tsx"), read("supabase/migrations/20260824074255_admin_edit_functions.sql")]);
  assert.match(session, /scryptSync/);
  assert.match(session, /createHmac\("sha256"/);
  assert.match(session, /httpOnly: true/);
  assert.match(login, /Too many attempts/);
  assert.match(dashboard, /Copy link/);
  assert.match(dashboard, /Copy message/);
  assert.match(dashboard, /household\.submission\.note/);
  assert.match(dashboard, /Every RSVP, at a glance/);
  assert.match(dashboard, /Search guests or households/);
  assert.match(dashboard, /responseFilter/);
  assert.match(migration, /admin_audit_log/);
});

test("registry does not claim stale mirrored data when no authorized integration exists", async () => {
  const [route, page] = await Promise.all([read("app/api/registry/route.ts"), read("app/page.tsx")]);
  assert.match(route, /Automated mirroring is disabled until Babylist authorizes/);
  assert.match(route, /mode: "handoff"/);
  assert.match(page, /Open the registry on Babylist/);
  assert.match(page, /Nothing stale is being shown/);
});
