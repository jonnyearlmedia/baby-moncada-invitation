import * as cheerio from "cheerio";

// A read that Amazon answered but that failed validation. Retrying it just repeats the same
// answer, so these end the run immediately instead of burning three passes over the registry.
export class RegistryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RegistryValidationError";
    this.permanent = true;
  }
}

export const REGISTRY_ID = "10AIJQD53FRAQ";
export const REGISTRY_URL = "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ";
export const ITEMS_ENDPOINT = "https://www.amazon.com/baby-reg/visitor-view-load-more-items";
export const ITEM_CARD_SELECTOR = ".aok-float-left[asin][category][itemid]";
export const REGISTRY_SUMMARY_SELECTOR = "#br-purchased-and-total-items-count";
export const MAX_PAGES_PER_FILTER = 10;

// Amazon's header count runs one unit ahead of Amazon's own item cards on this registry. Verified
// on captures from 2026-09-07 and 2026-09-08: every card on every page parses, and each card's
// "N NEEDED" badge matches its "N of M Purchased" text, summing to 100 units while the header says
// 101. So the header is a completeness signal, not an exact figure. What it has to catch is a
// missed page, which drops up to 30 items at once and is nowhere near this tolerance.
export const REGISTRY_UNIT_TOLERANCE = 2;

const categoryNames = {
  "activity-and-gear": "Activity & gear",
  "baby-clothing": "Baby clothing",
  bathing: "Bathing",
  diapering: "Diapering",
  feeding: "Feeding",
};

export function readGridState(html, previous = {}) {
  const $ = cheerio.load(html);
  const diagnostics = [];
  for (const element of $("script[type='a-state']").toArray()) {
    try {
      const value = JSON.parse($(element).text());
      diagnostics.push(Object.keys(value));
      const designAsin = value.designAsin || previous.designAsin;
      const ownerCustomerId = value.ownerCustomerId || previous.ownerCustomerId;
      if (value.registryId === REGISTRY_ID && "filters" in value && designAsin && ownerCustomerId) {
        return {
          designAsin,
          ownerCustomerId,
          lastItemCategory: value.lastItemCategory ?? "",
          paginationKey: value.paginationKey ?? "",
          registryId: value.registryId,
        };
      }
    } catch {
      // Amazon includes unrelated state blocks that are not JSON registry state.
    }
  }
  throw new Error(`Amazon registry pagination data is unavailable (${JSON.stringify(diagnostics)})`);
}

export function safeItemUrl(value, asin, itemId) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://www.amazon.com");
    const exactRegistryItem = url.pathname.includes(`/dp/${asin}`)
      && url.searchParams.get("colid") === REGISTRY_ID
      && url.searchParams.get("coliid") === itemId;
    return url.protocol === "https:" && ["amazon.com", "www.amazon.com"].includes(url.hostname) && exactRegistryItem
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function safeImageUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["m.media-amazon.com", "images-na.ssl-images-amazon.com"].includes(url.hostname)) return null;
    url.hostname = "m.media-amazon.com";
    return url.toString();
  } catch {
    return null;
  }
}

export function parsePrice(value) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function countItemCards(html) {
  return cheerio.load(html)(ITEM_CARD_SELECTOR).length;
}

// Amazon prints an authoritative "<purchased>/<total> items purchased" summary in the registry
// header. It counts units, so an item wanted five times contributes five. It is the only
// independent number on the page, which makes it the one real check that every page was read.
export function parseSummaryCounts(text) {
  if (!text) return null;
  const match = text.replace(/\s+/g, " ").match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  const purchasedUnits = Number(match[1]);
  const totalUnits = Number(match[2]);
  if (!Number.isInteger(purchasedUnits) || !Number.isInteger(totalUnits) || totalUnits < 1 || purchasedUnits > totalUnits) return null;
  return { purchasedUnits, totalUnits };
}

// The header is populated after DOMContentLoaded, and the element exists empty before that, so
// the sync waits for these counts to actually carry digits rather than for the element to appear.
export function readSummaryText(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const header = $(REGISTRY_SUMMARY_SELECTOR).first();
  if (header.length) {
    const counts = `${header.find(".purchased-count").first().text().trim()}/${header.find(".total-count").first().text().trim()}`;
    if (parseSummaryCounts(counts)) return counts;
    return header.text().replace(/\s+/g, " ").trim();
  }
  const sentence = $("body").text().replace(/\s+/g, " ").match(/(\d+)\s*\/\s*(\d+)\s+items?\s+purchased/i);
  return sentence ? sentence[0] : null;
}

export function parseRegistrySummary(html) {
  return parseSummaryCounts(readSummaryText(html));
}

export function parseItems(html) {
  const $ = cheerio.load(html);
  const cards = $(ITEM_CARD_SELECTOR);
  const items = cards.toArray().flatMap((element) => {
    const card = $(element);
    const itemId = card.attr("itemid");
    const asin = card.attr("asin");
    const purchaseMatch = card.text().match(/(\d+)\s+of\s+(\d+)\s+Purchased/i);
    if (!itemId || !asin || !purchaseMatch) return [];

    const title = card.find("h2[aria-label]").first().attr("aria-label")?.trim();
    const image = safeImageUrl(card.find("img.br-vv-item-card-image").first().attr("src"));
    const url = safeItemUrl(card.find(`a[href*="/dp/${asin}"][href*="colid="][href*="coliid="]`).first().attr("href"), asin, itemId);
    const purchased = Number(purchaseMatch[1]);
    const quantity = Number(purchaseMatch[2]);
    if (!title || !image || !url || !Number.isInteger(purchased) || !Number.isInteger(quantity) || quantity < 1 || purchased < 0 || purchased > quantity) return [];

    const price = card.find(".a-price .a-offscreen").first().text().trim();
    const categoryKey = card.attr("category")?.replace("br-checklist-category-", "") ?? "general";
    const quantityNeeded = quantity - purchased;
    return [{
      id: itemId,
      title,
      image,
      category: categoryNames[categoryKey] ?? categoryKey.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" "),
      price: price || null,
      quantity,
      quantityNeeded,
      isFulfilled: quantityNeeded === 0,
      reservedCount: purchased,
      offers: [{
        id: `${itemId}-amazon`,
        store: "Amazon",
        url,
        price: price ? parsePrice(price) : null,
        isRegistry: true,
        availability: quantityNeeded === 0 ? "purchased" : "available",
        availabilityText: `${purchased} of ${quantity} purchased`,
      }],
    }];
  });
  if (items.length !== cards.length) throw new RegistryValidationError(`Amazon returned an incomplete registry page (${items.length}/${cards.length} valid items)`);
  return items;
}

export function summarizeItems(items) {
  return {
    items: items.length,
    totalUnits: items.reduce((total, item) => total + item.quantity, 0),
    purchasedUnits: items.reduce((total, item) => total + item.reservedCount, 0),
    neededItems: items.filter((item) => !item.isFulfilled).length,
    purchasedItems: items.filter((item) => item.isFulfilled).length,
  };
}

// Rejects a scrape that disagrees with Amazon's own header. This is what catches a page that was
// silently skipped, which is invisible to every other check because each page it did read is valid.
export function verifyRegistryTotals(items, summary) {
  const scraped = summarizeItems(items);
  if (!summary) return { checked: false, matched: null, short: null, withinTolerance: null, scraped, reported: null };
  const short = summary.totalUnits - scraped.totalUnits;
  const purchasedShort = summary.purchasedUnits - scraped.purchasedUnits;
  const matched = short === 0 && purchasedShort === 0;
  // Only a shortfall matters. Reading more than Amazon reports means Amazon's counter is behind,
  // never that an item was missed.
  const withinTolerance = short <= REGISTRY_UNIT_TOLERANCE && Math.abs(purchasedShort) <= REGISTRY_UNIT_TOLERANCE;
  return { checked: true, matched, short, purchasedShort, withinTolerance, scraped, reported: summary };
}

export function assertNoDuplicateItems(items) {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new RegistryValidationError("Amazon returned duplicate registry items");
}

// The pagination loop lives here, with the network injected, so the exact sequence that broke the
// sync in September can be replayed in a test without touching Amazon.
export async function collectFilterPages({ filter, firstHtml, baseState, fetchPage, log = () => {}, onPage = () => {} }) {
  const items = firstHtml ? parseItems(firstHtml) : [];
  let state = firstHtml ? readGridState(firstHtml) : { ...baseState, lastItemCategory: "", paginationKey: "" };
  const seenKeys = new Set();

  for (let index = firstHtml ? 1 : 0; index < MAX_PAGES_PER_FILTER; index += 1) {
    if (firstHtml && !state.paginationKey) return items;
    if (state.paginationKey && seenKeys.has(state.paginationKey)) throw new RegistryValidationError("Amazon repeated a registry page");
    if (state.paginationKey) seenKeys.add(state.paginationKey);
    const html = await fetchPage(filter, state);
    onPage({ filter, index, html });
    const pageItems = parseItems(html);
    // Amazon hands out a pagination key that leads to an empty page, so an empty page is the end
    // of the filter whatever the key claims. The header totals check is what proves nothing was
    // skipped; treating this as a failure only ever produced a stale registry for guests.
    if (pageItems.length === 0) {
      log("amazon_registry_filter_ended_on_empty_page", { filter, itemsSoFar: items.length });
      return items;
    }
    items.push(...pageItems);
    state = readGridState(html, state);
    if (!state.paginationKey) return items;
  }
  throw new RegistryValidationError("Amazon registry exceeded the verified pagination limit");
}
