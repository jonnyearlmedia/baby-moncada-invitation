import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { confirmationCode, seedFrom } from "../lib/pass-code.ts";

const root = new URL("../", import.meta.url);

async function householdSlugs() {
  const [pilot, expansion] = await Promise.all([
    readFile(new URL("supabase/seed/moncada-pilot-core-seed.sql", root), "utf8"),
    readFile(new URL("supabase/seed/moncada-pilot-remaining-households.sql", root), "utf8"),
  ]);
  const slugs = new Set(["murao", "ponticelle", "cabrera", "sainz", "morales-diaz", "castro"]);
  for (const match of expansion.matchAll(/"slug":"([a-z0-9-]+)"/g)) slugs.add(match[1]);
  for (const slug of slugs) assert.ok(pilot.includes(`'${slug}'`) || expansion.includes(`"${slug}"`), `unknown slug ${slug}`);
  return [...slugs];
}

test("every household gets its own confirmation code", async () => {
  const slugs = await householdSlugs();
  assert.equal(slugs.length, 58);
  const seen = new Map();
  for (const slug of slugs) {
    const code = confirmationCode(slug);
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/, `${slug} produced ${code}`);
    assert.equal(seen.get(code), undefined, `${slug} collides with ${seen.get(code)} on ${code}`);
    seen.set(code, slug);
  }
  assert.equal(seen.size, slugs.length);
});

test("codes are stable for a slug and unaffected by neighbouring slugs", async () => {
  assert.equal(confirmationCode("murao"), confirmationCode("murao"));
  assert.notEqual(confirmationCode("ponticelle"), confirmationCode("tania-doukas"));
  assert.notEqual(confirmationCode("castro"), confirmationCode("murao-juliet-ferdie"));
});

test("the hash finalizer keeps the low bits usable", () => {
  // Without fmix32 these inputs agree on their low five bits, which is what collapsed the codes.
  const lowBits = new Set(["ponticelle:0", "tania-doukas:0", "cabrera:0", "armada-jd-georgia:0"].map((v) => seedFrom(v) % 32));
  assert.equal(lowBits.size, 4);
});
