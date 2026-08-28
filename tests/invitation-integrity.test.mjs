import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("confirmed event facts are consistent in UI and database seed", async () => {
  const [page, layout, migration, deadlineMigration] = await Promise.all([read("app/page.tsx"), read("app/layout.tsx"), read("supabase/migrations/20260824073636_production_rsvp_pilot.sql"), read("supabase/migrations/20260824155828_add_rsvp_deadline.sql")]);
  assert.match(page, /Sat, Sep 26 2026/);
  assert.match(page, /4:00 PM/);
  assert.match(page, /DTSTART;TZID=America\/Los_Angeles:20260926T160000/);
  assert.match(migration, /2026-09-26 16:00:00-07/);
  assert.match(migration, /5870 Labath Ave, Rohnert Park, CA 94928/);
  assert.match(migration, /2026-09-11/);
  assert.match(migration, /groupCode=905/);
  assert.match(page, /A baby shower honoring Janelle/);
  assert.match(page, /Baby Moncada Baby Shower/);
  assert.match(layout, /Baby Moncada Baby Shower · September 26, 2026/);
  assert.match(deadlineMigration, /rsvp_deadline date not null default date '2026-09-11'/);
  assert.match(deadlineMigration, /'rsvpDeadline', e\.rsvp_deadline/);
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

test("confirmed attendees receive diaper raffle and live invitation reminders", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /attending\.length > 0/);
  assert.match(page, /Bring a pack of diapers/);
  assert.match(page, /Save this invitation/);
  assert.match(page, /current registry items, directions, hotel details, and event updates/);
});

test("database tables are RLS-protected and old readable links survive renames", async () => {
  const [migration, registryMigration] = await Promise.all([read("supabase/migrations/20260824073636_production_rsvp_pilot.sql"), read("supabase/migrations/20260827165346_amazon_registry_snapshot.sql")]);
  const schema = `${migration}\n${registryMigration}`;
  for (const table of ["event_settings", "households", "household_slug_aliases", "guests", "rsvp_submissions", "rsvp_guest_responses", "registry_items", "registry_offers", "registry_sync_runs", "registry_sync_state", "admin_login_attempts", "admin_audit_log"]) assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
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
  assert.match(dashboard, /Send links and track RSVPs/);
  assert.match(dashboard, /party-copy-row/);
  assert.match(dashboard, /Individual guests/);
  assert.match(dashboard, /Search guests, parties, or short links/);
  assert.match(dashboard, /responseFilter/);
  assert.match(migration, /admin_audit_log/);
});

test("host-created invitations are validated and committed through one protected database function", async () => {
  const [route, dashboard, migration] = await Promise.all([read("app/api/admin/dashboard/route.ts"), read("app/dashboard/dashboard-client.tsx"), read("supabase/migrations/20260825030159_create_admin_invitation.sql")]);
  assert.match(route, /export async function POST/);
  assert.match(route, /admin_create_household/);
  assert.match(route, /hasHostSession/);
  assert.match(dashboard, /Type the names\. The link builds itself\./);
  assert.match(dashboard, /parseGuestNames/);
  assert.match(migration, /where id for update/);
  assert.match(migration, /insert into public\.households/);
  assert.match(migration, /insert into public\.guests/);
  assert.match(migration, /admin_audit_log/);
  assert.match(migration, /revoke execute .* from public, anon, authenticated/);
  assert.match(migration, /grant execute .* to service_role/);
});

test("registry refreshes every current Amazon page and preserves registry-linked item URLs", async () => {
  const [route, page, scheduledSync, workflow, migration] = await Promise.all([
    read("app/api/registry/route.ts"),
    read("app/page.tsx"),
    read("scripts/sync-amazon-registry.mjs"),
    read(".github/workflows/amazon-registry-sync.yml"),
    read("supabase/migrations/20260828052059_github_registry_sync_rpc.sql"),
  ]);
  assert.match(route, /visitor-view-load-more-items/);
  assert.match(route, /"UNPURCHASED"/);
  assert.match(route, /"PURCHASED"/);
  assert.match(route, /paginationKey/);
  assert.match(route, /cache: "no-store"/);
  assert.match(route, /searchParams\.get\("colid"\) === REGISTRY_ID/);
  assert.match(route, /searchParams\.get\("coliid"\) === itemId/);
  assert.match(route, /quantityNeeded === 0/);
  assert.match(route, /items\.length !== cards\.length/);
  assert.match(page, /View.*option/);
  assert.match(page, /Open the registry on Amazon/);
  assert.match(page, /Nothing stale is being shown/);
  const amazonHandoff = page.indexOf("See the full registry on Amazon");
  const productList = page.indexOf('<div className="products">');
  assert.ok(amazonHandoff > -1 && amazonHandoff < productList);
  assert.doesNotMatch(page, /Babylist/);
  assert.doesNotMatch(page, /className="registry-footer"/);
  assert.match(workflow, /cron: "17 \*\/6 \* \* \*"/);
  assert.match(workflow, /REGISTRY_SYNC_TOKEN/);
  assert.match(scheduledSync, /chromium\.launch/);
  assert.match(scheduledSync, /loadPages\(page, csrf, state, "UNPURCHASED"/);
  assert.match(scheduledSync, /loadPages\(page, csrf, state, "PURCHASED"/);
  assert.match(scheduledSync, /commit_amazon_registry_sync/);
  assert.match(migration, /token_hash = extensions\.digest\(p_token, 'sha256'\)/);
  assert.match(migration, /v_retained_count \* 4 < v_old_count \* 3/);
  assert.match(migration, /revoke all on public\.registry_sync_credentials from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.commit_amazon_registry_sync.*to anon/);
});

test("travel view uses an interactive map at the exact venue coordinates", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /openstreetmap\.org\/export\/embed\.html/);
  assert.match(page, /marker=38\.3516523%2C-122\.7205662/);
  assert.match(page, /<iframe title="Interactive map showing Hotel Centro/);
  assert.doesNotMatch(page, /<div className="map-visual"><svg/);
  assert.match(page, /Hilton currently lists parking at \$8 per day/);
  assert.match(page, /Ask the front desk for the Baby Moncada shower location or follow any posted event signs/);
  assert.match(page, /warm during the day and cooler in the evening/);
});

test("mobile invitation tracks the visible browser viewport and reserves the safe bottom area", async () => {
  const [page, layout, styles] = await Promise.all([read("app/page.tsx"), read("app/layout.tsx"), read("app/globals.css")]);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(page, /window\.visualViewport/);
  assert.match(page, /--invitation-viewport-height/);
  assert.match(styles, /height:var\(--invitation-viewport-height,100svh\)/);
  assert.match(styles, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(styles, /--phone-nav-reserved-height/);
});

test("save instructions preserve the household-specific invitation link", async () => {
  const [page, invitePage, inviteManifest, dashboardLayout, dashboardManifest] = await Promise.all([
    read("app/page.tsx"),
    read("app/invite/[slug]/page.tsx"),
    read("app/invite/[slug]/manifest.webmanifest/route.ts"),
    read("app/dashboard/layout.tsx"),
    read("app/dashboard/manifest.webmanifest/route.ts"),
  ]);
  assert.match(page, /Save this invitation/);
  assert.match(page, /Home Screen for quick access to the registry, directions, and RSVP/);
  assert.match(page, /Add to Home Screen/);
  assert.match(page, /Add Bookmark/);
  assert.match(page, /Add to Bookmarks/);
  assert.match(invitePage, /manifest: `\$\{invitationPath\}\/manifest\.webmanifest`/);
  assert.match(inviteManifest, /invitationManifest\(slug\)/);
  assert.match(dashboardLayout, /manifest: "\/dashboard\/manifest\.webmanifest"/);
  assert.match(dashboardManifest, /dashboardManifest\(\)/);
});
