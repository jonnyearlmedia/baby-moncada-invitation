const BABYLIST_FEED =
  "https://my.babylist.com/api/v3/registries/janelle-fernando/reg_items/minimal?limit=100&offset=0";

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

function safeUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const response = await fetch(BABYLIST_FEED, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

    if (!response.ok) throw new Error(`Babylist returned ${response.status}`);
    const raw = (await response.json()) as BabylistItem[];
    if (!Array.isArray(raw)) throw new Error("Babylist returned an unexpected response");

    const items = raw.flatMap((item) => {
      if (!item.id || !item.title || !item.img_url) return [];
      const offers = (item.offers ?? []).flatMap((offer) => {
        const url = safeUrl(offer.url);
        if (!url) return [];
        return [{
          id: offer.id ?? 0,
          store: offer.store_display_name || offer.store_name || "Retailer",
          url,
          price: typeof offer.price === "number" ? offer.price : null,
          isBabylist: Boolean(offer.is_babylist),
          availability: offer.stock_status?.availability ?? null,
          availabilityText: offer.stock_status?.text ?? null,
        }];
      });

      const quantity = Math.max(1, item.quantity ?? 1);
      const quantityNeeded = Math.max(0, item.quantity_needed ?? quantity);
      return [{
        id: item.id,
        title: item.title,
        image: item.img_url,
        category: categoryNames[item.category_id ?? 0] ?? "General",
        price: item.price || null,
        quantity,
        quantityNeeded,
        isFulfilled: quantityNeeded === 0,
        reservedCount: Math.max(0, quantity - quantityNeeded),
        offers,
      }];
    });

    return Response.json(
      { items, updatedAt: new Date().toISOString(), source: "Babylist" },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "The registry could not be refreshed right now.",
        detail: error instanceof Error ? error.message : "Unknown registry error",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
