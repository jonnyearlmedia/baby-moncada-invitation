import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("keeps the confirmed event facts consistent", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /Saturday, September 26, 2026/);
  assert.match(page, /5870 Labath Ave, Rohnert Park, CA 94928/);
  assert.match(page, /arrivalDate=2026-09-25&departureDate=2026-09-27&groupCode=905/);
  assert.match(page, /Event time to be announced/);
  assert.doesNotMatch(page, /Saturday, October 18, 2025|The Garden Room|Houston, TX/);
});

test("opens directly as the selected blue stationery invitation", async () => {
  const [page, css, layout] = await Promise.all([read("app/page.tsx"), read("app/globals.css"), read("app/layout.tsx")]);
  assert.match(page, /theme-paper-blue/);
  assert.match(page, /aria-label="Baby Moncada invitation"/);
  assert.match(css, /--app-bg:#dce9f2/);
  assert.match(layout, /Baby Moncada · September 26, 2026/);
  assert.doesNotMatch(page, /Choose the invitation|Visual directions|concepts =/);
  assert.doesNotMatch(page, /className="island"|className="status"/);
});

test("uses live item-level registry actions instead of repeated generic buttons", async () => {
  const [page, route] = await Promise.all([read("app/page.tsx"), read("app/api/registry/route.ts")]);
  assert.match(route, /reg_items\/minimal\?limit=100&offset=0/);
  assert.match(route, /quantityNeeded/);
  assert.match(route, /isFulfilled/);
  assert.match(route, /reservedCount/);
  assert.match(page, /Buy through Babylist/);
  assert.match(page, /View at \$\{offer\.store\}/);
  assert.match(page, /mark this gift as purchased/);
  assert.doesNotMatch(page, />View on Babylist</);
});

test("persists named household RSVPs in D1 with complete-response validation", async () => {
  const [page, route, schema, hosting] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/rsvp/route.ts"),
    read("db/schema.ts"),
    read(".openai/hosting.json"),
  ]);
  assert.match(route, /The Murao Family/);
  assert.match(route, /\["Elsa", "Jonathan"\]/);
  assert.match(route, /Please answer for every person named on this invitation/);
  assert.match(schema, /rsvp_responses/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(page, /Your response is saved/);
  assert.doesNotMatch(page, /saved on this device|has not notified the hosts/);
});

test("provides real map handoffs and an embedded destination map", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /openstreetmap\.org\/export\/embed/);
  assert.match(page, /Open in Apple Maps/);
  assert.match(page, /Open in Google Maps/);
  assert.match(page, /The shower and guest rooms are at the same address/);
});
