import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertNoDuplicateItems,
  collectFilterPages,
  parseItems,
  parseRegistrySummary,
  readGridState,
  safeImageUrl,
  safeItemUrl,
  summarizeItems,
  verifyRegistryTotals,
} from "../scripts/amazon-registry-parser.mjs";

const root = new URL("../", import.meta.url);
const fixture = (name) => readFile(new URL(`tests/fixtures/${name}`, root), "utf8");

// Both fixtures are real Amazon markup, captured by the sync job's own diagnostics upload during
// the September 5-7 outage. The card markup is trimmed only where parsing is provably unaffected.
const registryPage = await fixture("amazon-registry-page.html");
const emptyPageWithKey = await fixture("amazon-registry-empty-page-with-key.html");

test("real Amazon cards parse into complete registry items", () => {
  const items = parseItems(registryPage);
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.ok(item.id && item.title);
    assert.match(item.image, /^https:\/\/m\.media-amazon\.com\//);
    assert.equal(item.offers.length, 1);
    assert.match(item.offers[0].url, /^https:\/\/www\.amazon\.com\/.*\/dp\//);
    assert.match(item.offers[0].url, /colid=10AIJQD53FRAQ/);
    assert.match(item.offers[0].url, /coliid=/);
    assert.equal(item.quantityNeeded, item.quantity - item.reservedCount);
    assert.equal(item.isFulfilled, item.quantityNeeded === 0);
  }
  const multi = items.find((item) => item.quantity > 1);
  assert.ok(multi, "fixture must cover an item wanted more than once");
  assert.equal(multi.quantity, 5);
  assert.equal(multi.offers[0].availabilityText, "0 of 5 purchased");
  assert.equal(items.find((item) => item.category === "Activity & gear")?.price, "$47.99");
});

test("Amazon's own purchased/total header is read", () => {
  assert.deepEqual(parseRegistrySummary(registryPage), { purchasedUnits: 9, totalUnits: 101 });
  assert.equal(parseRegistrySummary("<html><body>no summary here</body></html>"), null);
});

// The September outage: Amazon served a terminal page with no items that still carried a
// pagination key, and the sync treated it as a broken read for two days.
test("an empty page that still carries a pagination key ends the filter instead of failing", async () => {
  assert.equal(parseItems(emptyPageWithKey).length, 0);
  assert.ok(readGridState(emptyPageWithKey).paginationKey, "fixture must still carry Amazon's key");

  const served = [];
  const items = await collectFilterPages({
    filter: "UNPURCHASED",
    firstHtml: registryPage,
    fetchPage: async (filter, state) => { served.push(state.paginationKey); return emptyPageWithKey; },
  });

  assert.equal(items.length, 3, "the items read before the empty page are kept");
  assert.equal(served.length, 1);
});

test("a filter with no first page still reads through Amazon's pages", async () => {
  const pages = [registryPage, emptyPageWithKey];
  const items = await collectFilterPages({
    filter: "PURCHASED",
    baseState: { designAsin: "B07F4F8N6Z", ownerCustomerId: "AUOU4CA5BCPUP" },
    fetchPage: async () => pages.shift(),
  });
  assert.equal(items.length, 3);
  assert.equal(pages.length, 0, "both pages are read before the filter ends");
});

test("a repeated pagination key is rejected instead of looping", async () => {
  await assert.rejects(
    collectFilterPages({ filter: "UNPURCHASED", firstHtml: registryPage, fetchPage: async () => registryPage }),
    /repeated a registry page/,
  );
});

test("a page whose cards do not all parse is rejected, never partially published", () => {
  const broken = registryPage.replace(/0 of 1 Purchased/i, "sold out");
  assert.throws(() => parseItems(broken), /incomplete registry page/);
});

test("only exact registry item links and Amazon image hosts are accepted", () => {
  assert.equal(safeItemUrl("/x/dp/B1?colid=10AIJQD53FRAQ&coliid=I1", "B1", "I1"), "https://www.amazon.com/x/dp/B1?colid=10AIJQD53FRAQ&coliid=I1");
  assert.equal(safeItemUrl("/x/dp/B1?colid=OTHER&coliid=I1", "B1", "I1"), null, "another registry's link");
  assert.equal(safeItemUrl("/x/dp/B1?colid=10AIJQD53FRAQ&coliid=I9", "B1", "I1"), null, "another item's link");
  assert.equal(safeItemUrl("https://evil.example.com/x/dp/B1?colid=10AIJQD53FRAQ&coliid=I1", "B1", "I1"), null);
  assert.equal(safeImageUrl("https://m.media-amazon.com/images/I/1.jpg"), "https://m.media-amazon.com/images/I/1.jpg");
  assert.equal(safeImageUrl("http://m.media-amazon.com/images/I/1.jpg"), null);
  assert.equal(safeImageUrl("https://evil.example.com/1.jpg"), null);
});

// This is the check that catches a page Amazon silently skipped: every page that was read looks
// perfectly valid, so the scraped totals are the only evidence that one is missing.
test("a read that disagrees with Amazon's header totals is caught", () => {
  const items = parseItems(registryPage);
  const scraped = summarizeItems(items);
  assert.equal(scraped.totalUnits, 7);
  assert.equal(scraped.purchasedUnits, 0);

  assert.equal(verifyRegistryTotals(items, { purchasedUnits: 0, totalUnits: 7 }).matched, true);
  assert.equal(verifyRegistryTotals(items, { purchasedUnits: 0, totalUnits: 8 }).matched, false, "one unit missing");
  assert.equal(verifyRegistryTotals(items, { purchasedUnits: 1, totalUnits: 7 }).matched, false, "a purchase missing");

  const unverified = verifyRegistryTotals(items, null);
  assert.equal(unverified.checked, false);
  assert.equal(unverified.matched, null);
});

test("duplicate items across the two filters are rejected", () => {
  const items = parseItems(registryPage);
  assert.doesNotThrow(() => assertNoDuplicateItems(items));
  assert.throws(() => assertNoDuplicateItems([...items, items[0]]), /duplicate registry items/);
});
