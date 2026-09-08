import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import {
  ITEMS_ENDPOINT,
  ITEM_CARD_SELECTOR,
  REGISTRY_ID,
  REGISTRY_SUMMARY_SELECTOR,
  RegistryValidationError,
  REGISTRY_URL,
  assertNoDuplicateItems,
  collectFilterPages,
  parseRegistrySummary,
  parseSummaryCounts,
  readGridState,
  summarizeItems,
  verifyRegistryTotals,
} from "./amazon-registry-parser.mjs";

const dryRun = process.env.DRY_RUN === "true";
const MAX_ATTEMPTS = 3;

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
    itemCards: responseDom(ITEM_CARD_SELECTOR).length,
    anyItemIdCards: responseDom("[itemid]").length,
    stateBlocks: responseDom("script[type='a-state']").length,
    hadPaginationKey: Boolean(state.paginationKey),
  });
  if (result.status !== 200) throw new Error(`Amazon ${filter} page returned ${result.status}`);
  return result.body;
}

async function readRegistry() {
  const browser = await chromium.launch({ headless: true });
  let page;
  const readPages = [];
  try {
    const context = await browser.newContext({ locale: "en-US", timezoneId: "America/Los_Angeles" });
    page = await context.newPage();
    await page.route(/\.(?:png|jpe?g|gif|webp|svg|woff2?)(?:\?|$)/i, (route) => route.abort());
    const response = await page.goto(REGISTRY_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response || response.status() >= 400) throw new Error(`Amazon registry returned ${response?.status() ?? "no response"}`);
    // Amazon ships the header element empty and fills in the counts after DOMContentLoaded, so
    // waiting for the element is not enough: wait until it actually carries the numbers. Without
    // this the completeness check reads nothing and passes every run, which is worse than
    // not having it at all.
    const headerText = await page.waitForFunction(
      (selector) => {
        const element = document.querySelector(selector);
        const text = element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return /\d+\s*\/\s*\d+/.test(text) ? text : null;
      },
      REGISTRY_SUMMARY_SELECTOR,
      { timeout: 20_000, polling: 250 },
    ).then((handle) => handle.jsonValue()).catch(() => null);

    const firstHtml = await page.content();
    const summary = parseSummaryCounts(headerText) ?? parseRegistrySummary(firstHtml);
    if (!summary) {
      console.warn("amazon_registry_summary_unreadable", {
        selector: REGISTRY_SUMMARY_SELECTOR,
        headerText,
        headerHtml: await page.evaluate((selector) => document.querySelector(selector)?.outerHTML ?? null, REGISTRY_SUMMARY_SELECTOR),
        bodyMentionsPurchased: /items?\s+purchased/i.test(firstHtml),
      });
    }
    console.log("amazon_registry_page_loaded", {
      status: response.status(),
      url: page.url(),
      title: await page.title(),
      htmlBytes: firstHtml.length,
      itemCards: cheerio.load(firstHtml)(ITEM_CARD_SELECTOR).length,
      anyItemIdCards: cheerio.load(firstHtml)("[itemid]").length,
      stateBlocks: cheerio.load(firstHtml)("script[type='a-state']").length,
      reportedTotals: summary,
    });
    if (!firstHtml.includes("Janelle Moncada") || !firstHtml.includes(REGISTRY_ID)) throw new Error(`Amazon returned the wrong page: ${await page.title()}`);
    const $ = cheerio.load(firstHtml);
    const csrf = $("#generic-registry-anticsrf-token").attr("content");
    if (!csrf) throw new Error("Amazon registry CSRF token is unavailable");
    const state = readGridState(firstHtml);
    const fetchPage = (filter, pageState) => fetchFilteredPage(page, csrf, filter, pageState);
    readPages.push({ filter: "FIRST", index: 0, html: firstHtml });
    const onPage = (fetched) => readPages.push(fetched);
    const [needed, purchased] = await Promise.all([
      collectFilterPages({ filter: "UNPURCHASED", firstHtml, baseState: state, fetchPage, log: console.log, onPage }),
      collectFilterPages({ filter: "PURCHASED", baseState: state, fetchPage, log: console.log, onPage }),
    ]);

    // A filter that returns nothing at all is a failed read, not an empty registry, unless
    // Amazon's own header says that filter really is empty.
    if (needed.length === 0 && (!summary || summary.totalUnits > summary.purchasedUnits)) {
      throw new RegistryValidationError("Amazon returned no still-needed registry items");
    }
    if (purchased.length === 0 && (!summary || summary.purchasedUnits > 0)) {
      throw new RegistryValidationError("Amazon returned no purchased registry items");
    }

    const items = [...needed, ...purchased];
    assertNoDuplicateItems(items);

    const totals = verifyRegistryTotals(items, summary);
    console.log("amazon_registry_totals", totals);
    if (totals.checked && !totals.matched) {
      throw new RegistryValidationError(`Amazon registry totals disagree: read ${totals.scraped.purchasedUnits}/${totals.scraped.totalUnits} units, Amazon reports ${totals.reported.purchasedUnits}/${totals.reported.totalUnits}`);
    }
    if (!totals.checked) console.warn("amazon_registry_totals_unverified", "Amazon no longer prints a purchased/total header; the completeness check is inactive");
    return items;
  } catch (error) {
    if (page) {
      await mkdir("artifacts", { recursive: true });
      await writeFile("artifacts/amazon-registry-debug.html", await page.content());
      await page.screenshot({ path: "artifacts/amazon-registry-debug.png", fullPage: true });
      // The paged responses are where a miscounted registry actually shows up, and they are not
      // in the rendered page, so a failed read has to keep them too.
      for (const fetched of readPages) {
        await writeFile(`artifacts/amazon-registry-${fetched.filter}-${fetched.index}.html`, fetched.html);
      }
    }
    throw error;
  } finally {
    await browser.close();
  }
}

async function loadAmazonRegistry() {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await readRegistry();
    } catch (error) {
      lastError = error;
      console.warn("amazon_registry_attempt_failed", { attempt, of: MAX_ATTEMPTS, permanent: Boolean(error?.permanent), detail: error instanceof Error ? error.message : String(error) });
      if (error?.permanent) break;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 15_000));
    }
  }
  throw lastError;
}

function syncClient() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for a live sync");
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function saveSnapshot(items) {
  const client = syncClient();
  const token = process.env.REGISTRY_SYNC_TOKEN;
  if (!token) throw new Error("REGISTRY_SYNC_TOKEN is required for a live sync");
  const fingerprint = createHash("sha256").update(JSON.stringify(items)).digest("hex");
  const result = await client.rpc("commit_amazon_registry_sync", {
    p_token: token,
    p_items: items,
    p_source_fingerprint: fingerprint,
  });
  if (result.error) throw result.error;
}

async function recordFailure(error) {
  if (dryRun || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.REGISTRY_SYNC_TOKEN) return;
  const client = syncClient();
  const detail = error instanceof Error ? error.message : String(error);
  await client.rpc("record_amazon_registry_sync_failure", {
    p_token: process.env.REGISTRY_SYNC_TOKEN,
    p_detail: detail,
  });
}

try {
  console.log("amazon_registry_sync_started", { dryRun, registryId: REGISTRY_ID });
  const items = await loadAmazonRegistry();
  const summary = {
    ...summarizeItems(items),
    exactLinks: items.filter((item) => item.offers[0].url.includes(`colid=${REGISTRY_ID}`) && item.offers[0].url.includes("coliid=")).length,
  };
  if (!dryRun) await saveSnapshot(items);
  console.log("amazon_registry_sync_succeeded", summary);
} catch (error) {
  await recordFailure(error);
  console.error("amazon_registry_sync_failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
