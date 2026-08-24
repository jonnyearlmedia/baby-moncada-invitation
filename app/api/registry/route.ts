const REGISTRY_URL = "https://my.babylist.com/janelle-fernando";
const REGISTRY_UUID = "4A887B3F-BCE3-4FF3-9012-1A2832F39F4B";
const BABYLIST_ITEMS_URL = `https://www.babylist.com/api/v3/registries/${REGISTRY_UUID}/reg_items/minimal?offset=0&limit=100`;

const categoryNames: Record<number, string> = {
  [-17]: "Sleeping",
  [-15]: "Baby gear",
  [-13]: "Cash & gift cards",
  [-10]: "Playing",
  [-9]: "Health & safety",
  [-7]: "Diapering",
  [-6]: "Bathing",
  [-5]: "Feeding",
  0: "General",
};

type BabylistOffer = {
  id?: number;
  is_babylist?: boolean;
  price?: number | null;
  stock_status?: { availability?: string | null; text?: string | null } | null;
  store_display_name?: string;
  store_name?: string;
  url?: string;
};

type BabylistItem = {
  id?: number;
  title?: string;
  img_url?: string;
  category_id?: number;
  quantity?: number;
  quantity_needed?: number;
  is_reserved?: boolean;
  price?: string | null;
  offers?: BabylistOffer[];
};

function safeHttpsUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function transformItems(raw: BabylistItem[]) {
  return raw.flatMap((item) => {
    const image = safeHttpsUrl(item.img_url);
    if (!item.id || !item.title || !image) return [];

    const offers = (item.offers ?? []).flatMap((offer, offerIndex) => {
      const url = safeHttpsUrl(offer.url);
      if (!url) return [];
      return [{
        id: offer.id ?? Number(`${item.id}${offerIndex}`),
        store: offer.store_display_name || offer.store_name || "Retailer",
        url,
        price: typeof offer.price === "number" ? offer.price : null,
        isBabylist: Boolean(offer.is_babylist),
        availability: offer.stock_status?.availability ?? null,
        availabilityText: offer.stock_status?.text ?? null,
      }];
    });

    const quantity = Math.max(1, item.quantity ?? 1);
    const quantityNeeded = Math.max(0, Math.min(quantity, item.quantity_needed ?? quantity));
    const isFulfilled = Boolean(item.is_reserved) || quantityNeeded === 0;
    return [{
      id: item.id,
      title: item.title,
      image,
      category: categoryNames[item.category_id ?? 0] ?? "General",
      price: item.price || null,
      quantity,
      quantityNeeded,
      isFulfilled,
      reservedCount: isFulfilled ? Math.max(1, quantity - quantityNeeded) : Math.max(0, quantity - quantityNeeded),
      offers,
    }];
  });
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(BABYLIST_ITEMS_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Babylist returned ${response.status}`);

    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new Error("Babylist returned an unexpected response");
    const items = transformItems(raw as BabylistItem[]);
    if (items.length === 0) throw new Error("Babylist returned no usable registry items");

    return Response.json(
      { items, updatedAt: new Date().toISOString(), source: "Babylist", registryUrl: REGISTRY_URL },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return Response.json(
      {
        mode: "handoff",
        registryUrl: REGISTRY_URL,
        reason: error instanceof Error ? error.message : "Registry refresh failed",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
