import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const REGISTRY_ID = "10AIJQD53FRAQ";
const REGISTRY_URL = "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ";
const ITEMS_ENDPOINT = "https://www.amazon.com/baby-reg/visitor-view-load-more-items";
const MAX_PAGES_PER_FILTER = 10;
const dryRun = process.env.DRY_RUN === "true";

const categoryNames = {
  "activity-and-gear": "Activity & gear",
  "baby-clothing": "Baby clothing",
  bathing: "Bathing",
  diapering: "Diapering",
  feeding: "Feeding",
};

function readGridState(html, previous = {}) {
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

function safeItemUrl(value, asin, itemId) {
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

function safeImageUrl(value) {
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

function parsePrice(value) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseItems(html) {
  const $ = cheerio.load(html);
  const cards = $(".aok-float-left[asin][category][itemid]");
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
  if (cards.length === 0 || items.length !== cards.length) throw new Error(`Amazon returned an incomplete registry page (${items.length}/${cards.length} valid items)`);
  return items;
}

async function fetchFilteredPage(page, csrf, filter, state) {
  const result = await page.evaluate(async ({ endpoint, token, referer, fields }) => {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "anti-csrftoken-a2z": token,
        Referer: referer,
      },
      body: new URLSearchParams(fields),
    });
    return { status: response.status, body: await response.text() };
  }, {
    endpoint: ITEMS_ENDPOINT,
    token: csrf,
    referer: REGISTRY_URL,
    fields: {
      designAsin: state.designAsin,
      visitorName: "",
      ownerCustomerId: state.ownerCustomerId,
      hasRegistry: "false",
      lastItemCategory: state.lastItemCategory,
      registryId: REGISTRY_ID,
      paginationKey: state.paginationKey,
      sort: "CATEGORY",
      filters: filter,
    },
  });
  const responseDom = cheerio.load(result.body);
  console.log("amazon_registry_page_received", {
    filter,
    status: result.status,
    htmlBytes: result.body.length,
    itemCards: responseDom(".aok-float-left[asin][category][itemid]").length,
    stateBlocks: responseDom("script[type='a-state']").length,
    hadPaginationKey: Boolean(state.paginationKey),
  });
  if (result.status !== 200) throw new Error(`Amazon ${filter} page returned ${result.status}`);
  return result.body;
}

async function loadPages(page, csrf, baseState, filter, firstHtml) {
  const items = firstHtml ? parseItems(firstHtml) : [];
  let state = firstHtml ? readGridState(firstHtml) : { ...baseState, lastItemCategory: "", paginationKey: "" };
  const seenKeys = new Set();

  for (let index = firstHtml ? 1 : 0; index < MAX_PAGES_PER_FILTER; index += 1) {
    if (firstHtml && !state.paginationKey) return items;
    if (state.paginationKey && seenKeys.has(state.paginationKey)) throw new Error("Amazon repeated a registry page");
    if (state.paginationKey) seenKeys.add(state.paginationKey);
    const html = await fetchFilteredPage(page, csrf, filter, state);
    items.push(...parseItems(html));
    state = readGridState(html, state);
    if (!state.paginationKey) return items;
  }
  throw new Error("Amazon registry exceeded the verified pagination limit");
}

async function loadAmazonRegistry() {
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext({ locale: "en-US", timezoneId: "America/Los_Angeles" });
    page = await context.newPage();
    await page.route(/\.(?:png|jpe?g|gif|webp|svg|woff2?)(?:\?|$)/i, (route) => route.abort());
    const response = await page.goto(REGISTRY_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response || response.status() >= 400) throw new Error(`Amazon registry returned ${response?.status() ?? "no response"}`);
    const firstHtml = await page.content();
    const diagnostics = {
      status: response.status(),
      url: page.url(),
      title: await page.title(),
      htmlBytes: firstHtml.length,
      itemCards: cheerio.load(firstHtml)(".aok-float-left[asin][category][itemid]").length,
      stateBlocks: cheerio.load(firstHtml)("script[type='a-state']").length,
    };
    console.log("amazon_registry_page_loaded", diagnostics);
    if (!firstHtml.includes("Janelle Moncada") || !firstHtml.includes(REGISTRY_ID)) throw new Error(`Amazon returned the wrong page: ${await page.title()}`);
    const $ = cheerio.load(firstHtml);
    const csrf = $("#generic-registry-anticsrf-token").attr("content");
    if (!csrf) throw new Error("Amazon registry CSRF token is unavailable");
    const state = readGridState(firstHtml);
    const [needed, purchased] = await Promise.all([
      loadPages(page, csrf, state, "UNPURCHASED", firstHtml),
      loadPages(page, csrf, state, "PURCHASED"),
    ]);
    const items = [...needed, ...purchased];
    if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Amazon returned duplicate registry items");
    return items;
  } catch (error) {
    if (page) {
      await mkdir("artifacts", { recursive: true });
      await writeFile("artifacts/amazon-registry-debug.html", await page.content());
      await page.screenshot({ path: "artifacts/amazon-registry-debug.png", fullPage: true });
    }
    throw error;
  } finally {
    await browser.close();
  }
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for a live sync");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function saveSnapshot(items) {
  const admin = adminClient();
  const currentResult = await admin.from("registry_sync_state").select("items,item_count").eq("id", true).single();
  if (currentResult.error) throw currentResult.error;
  const previousIds = new Set((currentResult.data.items ?? []).map((item) => item.id));
  const retained = items.filter((item) => previousIds.has(item.id)).length;
  if (previousIds.size > 0 && retained / previousIds.size < 0.75) {
    throw new Error(`Safety check blocked a large registry drop (${retained}/${previousIds.size} prior items retained)`);
  }

  const now = new Date().toISOString();
  const fulfilled = items.filter((item) => item.isFulfilled).length;
  const fingerprint = createHash("sha256").update(JSON.stringify(items)).digest("hex");
  const updateResult = await admin.from("registry_sync_state").update({
    source: "Amazon",
    registry_url: REGISTRY_URL,
    items,
    item_count: items.length,
    fulfilled_count: fulfilled,
    last_started_at: now,
    last_succeeded_at: now,
    syncing_until: null,
    last_error: null,
    updated_at: now,
  }).eq("id", true);
  if (updateResult.error) throw updateResult.error;
  const runResult = await admin.from("registry_sync_runs").insert({
    status: "succeeded",
    item_count: items.length,
    offer_count: items.length,
    source_fingerprint: fingerprint,
    detail: `GitHub browser sync: ${fulfilled} purchased`,
    finished_at: now,
  });
  if (runResult.error) throw runResult.error;
}

async function recordFailure(error) {
  if (dryRun || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return;
  const admin = adminClient();
  const detail = error instanceof Error ? error.message : String(error);
  const now = new Date().toISOString();
  await admin.from("registry_sync_state").update({ last_error: detail, syncing_until: null, updated_at: now }).eq("id", true);
  await admin.from("registry_sync_runs").insert({ status: "failed", detail: `GitHub browser sync: ${detail}`, finished_at: now });
}

try {
  console.log("amazon_registry_sync_started", { dryRun, registryId: REGISTRY_ID });
  const items = await loadAmazonRegistry();
  const summary = {
    total: items.length,
    needed: items.filter((item) => !item.isFulfilled).length,
    purchased: items.filter((item) => item.isFulfilled).length,
    exactLinks: items.filter((item) => item.offers[0].url.includes(`colid=${REGISTRY_ID}`) && item.offers[0].url.includes("coliid=")).length,
  };
  if (!dryRun) await saveSnapshot(items);
  console.log("amazon_registry_sync_succeeded", summary);
} catch (error) {
  await recordFailure(error);
  console.error("amazon_registry_sync_failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
