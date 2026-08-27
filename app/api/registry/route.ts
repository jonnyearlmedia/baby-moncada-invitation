import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { createAdminServerClient } from "@/lib/supabase-server";

const REGISTRY_ID = "10AIJQD53FRAQ";
const REGISTRY_URL = "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ";
const ITEMS_ENDPOINT = "https://www.amazon.com/baby-reg/visitor-view-load-more-items";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36";
const MAX_PAGES_PER_FILTER = 10;
const FRESH_FOR_MS = 10 * 60 * 1000;
const MAX_STALE_MS = 30 * 60 * 1000;
const SYNC_LOCK_MS = 2 * 60 * 1000;

type AmazonGridState = {
  designAsin: string;
  ownerCustomerId: string;
  lastItemCategory: string;
  paginationKey: string;
  registryId: string;
};

type AmazonSession = {
  cookie: string;
  csrf: string;
  state: AmazonGridState;
};

type RegistryItem = ReturnType<typeof parseItems>[number];

type RegistrySnapshot = {
  items: RegistryItem[];
  item_count: number;
  last_succeeded_at: string | null;
  syncing_until: string | null;
};

const categoryNames: Record<string, string> = {
  "activity-and-gear": "Activity & gear",
  "baby-clothing": "Baby clothing",
  bathing: "Bathing",
  diapering: "Diapering",
  feeding: "Feeding",
};

function amazonHeaders() {
  return {
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": USER_AGENT,
  };
}

function readCookies(headers: Headers) {
  const cookieHeaders = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? (headers.get("set-cookie")?.split(/,(?=[^;,]+=)/) ?? []);
  return cookieHeaders.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ");
}

function readGridState(html: string) {
  const $ = cheerio.load(html);
  for (const element of $("script[type='a-state']").toArray()) {
    try {
      const value = JSON.parse($(element).text()) as Partial<AmazonGridState> & { filters?: string };
      if (value.registryId === REGISTRY_ID && "filters" in value && value.designAsin && value.ownerCustomerId) {
        return {
          designAsin: value.designAsin,
          ownerCustomerId: value.ownerCustomerId,
          lastItemCategory: value.lastItemCategory ?? "",
          paginationKey: value.paginationKey ?? "",
          registryId: value.registryId,
        } satisfies AmazonGridState;
      }
    } catch {
      // Other Amazon state blocks are not registry pagination state.
    }
  }
  throw new Error("Amazon registry pagination data is unavailable");
}

function safeAmazonItemUrl(value: string | undefined, asin: string, itemId: string) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://www.amazon.com");
    const isAmazon = url.protocol === "https:" && (url.hostname === "www.amazon.com" || url.hostname === "amazon.com");
    const isExactItem = url.pathname.includes(`/dp/${asin}`)
      && url.searchParams.get("colid") === REGISTRY_ID
      && url.searchParams.get("coliid") === itemId;
    return isAmazon && isExactItem ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeAmazonImageUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "m.media-amazon.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parsePrice(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseItems(html: string) {
  const $ = cheerio.load(html);
  const cards = $(".aok-float-left[asin][category][itemid]");
  const items = cards.toArray().flatMap((element) => {
    const card = $(element);
    const itemId = card.attr("itemid");
    const asin = card.attr("asin");
    const purchaseMatch = card.text().match(/(\d+)\s+of\s+(\d+)\s+Purchased/i);
    if (!itemId || !asin || !purchaseMatch) return [];

    const title = card.find("h2[aria-label]").first().attr("aria-label")?.trim();
    const image = safeAmazonImageUrl(card.find("img.br-vv-item-card-image").first().attr("src"));
    const itemUrl = safeAmazonItemUrl(
      card.find(`a[href*="/dp/${asin}"][href*="colid="][href*="coliid="]`).first().attr("href"),
      asin,
      itemId,
    );
    if (!title || !image || !itemUrl) return [];

    const purchased = Number(purchaseMatch[1]);
    const quantity = Number(purchaseMatch[2]);
    if (!Number.isInteger(purchased) || !Number.isInteger(quantity) || quantity < 1 || purchased < 0 || purchased > quantity) return [];

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
        url: itemUrl,
        price: price ? parsePrice(price) : null,
        isRegistry: true,
        availability: quantityNeeded === 0 ? "purchased" : "available",
        availabilityText: `${purchased} of ${quantity} purchased`,
      }],
    }];
  });

  if (items.length !== cards.length) throw new Error("Amazon returned an incomplete registry item");
  return items;
}

async function fetchFilteredPage(session: AmazonSession, filter: "UNPURCHASED" | "PURCHASED", state: AmazonGridState) {
  const body = new URLSearchParams({
    designAsin: state.designAsin,
    visitorName: "",
    ownerCustomerId: state.ownerCustomerId,
    hasRegistry: "false",
    lastItemCategory: state.lastItemCategory,
    registryId: REGISTRY_ID,
    paginationKey: state.paginationKey,
    sort: "CATEGORY",
    filters: filter,
  });
  const response = await fetch(ITEMS_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...amazonHeaders(),
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "anti-csrftoken-a2z": session.csrf,
      Cookie: session.cookie,
      Referer: REGISTRY_URL,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Amazon registry items returned ${response.status}`);
  return response.text();
}

async function loadRemainingPages(session: AmazonSession, filter: "UNPURCHASED" | "PURCHASED", firstHtml?: string) {
  const items = firstHtml ? parseItems(firstHtml) : [];
  let state = firstHtml ? readGridState(firstHtml) : { ...session.state, lastItemCategory: "", paginationKey: "" };
  const seenPaginationKeys = new Set<string>();

  for (let page = firstHtml ? 1 : 0; page < MAX_PAGES_PER_FILTER; page += 1) {
    if (firstHtml && !state.paginationKey) break;
    if (state.paginationKey && seenPaginationKeys.has(state.paginationKey)) throw new Error("Amazon repeated a registry page");
    if (state.paginationKey) seenPaginationKeys.add(state.paginationKey);

    const html = await fetchFilteredPage(session, filter, state);
    items.push(...parseItems(html));
    state = readGridState(html);
    if (!state.paginationKey) return items;
  }

  if (state.paginationKey) throw new Error("Amazon registry has more pages than the verified limit");
  return items;
}

async function loadAmazonRegistry() {
  const response = await fetch(REGISTRY_URL, {
    cache: "no-store",
    headers: amazonHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Amazon registry returned ${response.status}`);

  const firstHtml = await response.text();
  if (!firstHtml.includes("Janelle Moncada") || !firstHtml.includes(REGISTRY_ID)) throw new Error("Amazon returned the wrong registry");
  const $ = cheerio.load(firstHtml);
  const csrf = $("#generic-registry-anticsrf-token").attr("content");
  const cookie = readCookies(response.headers);
  if (!csrf || !cookie) throw new Error("Amazon registry session could not be established");

  const session = { csrf, cookie, state: readGridState(firstHtml) } satisfies AmazonSession;
  const [neededItems, purchasedItems] = await Promise.all([
    loadRemainingPages(session, "UNPURCHASED", firstHtml),
    loadRemainingPages(session, "PURCHASED"),
  ]);
  const items = [...neededItems, ...purchasedItems];
  if (items.length === 0) throw new Error("Amazon returned no registry items");
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Amazon returned duplicate registry items");
  return items;
}

function hasUsableSnapshot(snapshot: RegistrySnapshot | null) {
  return Boolean(
    snapshot
    && Array.isArray(snapshot.items)
    && snapshot.items.length > 0
    && snapshot.items.length === snapshot.item_count
    && snapshot.last_succeeded_at,
  );
}

function snapshotAge(snapshot: RegistrySnapshot | null) {
  if (!snapshot?.last_succeeded_at) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(snapshot.last_succeeded_at).getTime();
}

function registryResponse(items: RegistryItem[], updatedAt: string, refreshState: "current" | "refreshing" = "current") {
  return Response.json(
    { items, updatedAt, source: "Amazon", registryUrl: REGISTRY_URL, refreshState },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

function handoffResponse(reason: string) {
  return Response.json(
    { mode: "handoff", registryUrl: REGISTRY_URL, reason },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

async function finishRun(admin: ReturnType<typeof createAdminServerClient>, runId: number | null, values: Record<string, unknown>) {
  if (runId == null) return;
  const { error } = await admin.from("registry_sync_runs").update({ ...values, finished_at: new Date().toISOString() }).eq("id", runId);
  if (error) console.error("registry_sync_run_update_failed", error);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let snapshot: RegistrySnapshot | null = null;
  try {
    const admin = createAdminServerClient();
    const snapshotResult = await admin.from("registry_sync_state").select("items,item_count,last_succeeded_at,syncing_until").eq("id", true).single();
    if (snapshotResult.error) throw snapshotResult.error;
    snapshot = snapshotResult.data as RegistrySnapshot;
    if (hasUsableSnapshot(snapshot) && snapshotAge(snapshot) <= FRESH_FOR_MS) {
      return registryResponse(snapshot.items, snapshot.last_succeeded_at!);
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - FRESH_FOR_MS).toISOString();
    const claimResult = await admin.from("registry_sync_state")
      .update({ last_started_at: now.toISOString(), syncing_until: new Date(now.getTime() + SYNC_LOCK_MS).toISOString(), last_error: null })
      .eq("id", true)
      .or(`syncing_until.is.null,syncing_until.lt.${now.toISOString()}`)
      .or(`last_succeeded_at.is.null,last_succeeded_at.lt.${staleBefore}`)
      .select("id")
      .maybeSingle();
    if (claimResult.error) throw claimResult.error;

    if (claimResult.data) {
      const startedRun = await admin.from("registry_sync_runs").insert({ status: "started", detail: "Amazon registry refresh" }).select("id").single();
      const runId = startedRun.data?.id ?? null;
      try {
        const items = await loadAmazonRegistry();
        const succeededAt = new Date().toISOString();
        const fulfilledCount = items.filter((item) => item.isFulfilled).length;
        const fingerprint = createHash("sha256").update(JSON.stringify(items)).digest("hex");
        const saveResult = await admin.from("registry_sync_state").update({
          source: "Amazon",
          registry_url: REGISTRY_URL,
          items,
          item_count: items.length,
          fulfilled_count: fulfilledCount,
          last_succeeded_at: succeededAt,
          syncing_until: null,
          last_error: null,
          updated_at: succeededAt,
        }).eq("id", true);
        if (saveResult.error) throw saveResult.error;
        await finishRun(admin, runId, { status: "succeeded", item_count: items.length, offer_count: items.length, source_fingerprint: fingerprint, detail: `${fulfilledCount} purchased` });
        return registryResponse(items, succeededAt);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Amazon registry refresh failed";
        await admin.from("registry_sync_state").update({ syncing_until: null, last_error: reason, updated_at: new Date().toISOString() }).eq("id", true);
        await finishRun(admin, runId, { status: "failed", detail: reason });
        if (hasUsableSnapshot(snapshot) && snapshotAge(snapshot) <= MAX_STALE_MS) {
          return registryResponse(snapshot.items, snapshot.last_succeeded_at!, "refreshing");
        }
        return handoffResponse(reason);
      }
    }

    if (hasUsableSnapshot(snapshot) && snapshotAge(snapshot) <= MAX_STALE_MS) {
      return registryResponse(snapshot.items, snapshot.last_succeeded_at!, "refreshing");
    }
    return handoffResponse("Amazon registry refresh is already in progress");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Registry refresh failed";
    if (hasUsableSnapshot(snapshot) && snapshotAge(snapshot) <= MAX_STALE_MS) {
      return registryResponse(snapshot!.items, snapshot!.last_succeeded_at!, "refreshing");
    }
    return handoffResponse(reason);
  }
}
