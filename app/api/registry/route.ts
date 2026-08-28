import { createAdminServerClient } from "@/lib/supabase-server";

const REGISTRY_URL = "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ";
const SCHEDULE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SCHEDULE_GRACE_MS = 90 * 60 * 1000;

type RegistryItem = {
  id: string;
  title: string;
  image: string;
  category: string;
  price: string | null;
  quantity: number;
  quantityNeeded: number;
  isFulfilled: boolean;
  reservedCount: number;
  offers: Array<{
    id: string;
    store: "Amazon";
    url: string;
    price: number | null;
    isRegistry: true;
    availability: "available" | "purchased";
    availabilityText: string;
  }>;
};

type RegistrySnapshot = {
  items: RegistryItem[];
  item_count: number;
  last_succeeded_at: string | null;
};

function hasUsableSnapshot(snapshot: RegistrySnapshot | null) {
  return Boolean(
    snapshot
    && Array.isArray(snapshot.items)
    && snapshot.items.length > 0
    && snapshot.items.length === snapshot.item_count
    && snapshot.last_succeeded_at,
  );
}

function isScheduleCurrent(updatedAt: string) {
  const age = Date.now() - new Date(updatedAt).getTime();
  return Number.isFinite(age) && age <= SCHEDULE_INTERVAL_MS + SCHEDULE_GRACE_MS;
}

function handoffResponse(reason: string) {
  return Response.json(
    { mode: "handoff", registryUrl: REGISTRY_URL, reason },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = createAdminServerClient();
    const result = await admin
      .from("registry_sync_state")
      .select("items,item_count,last_succeeded_at")
      .eq("id", true)
      .single();
    if (result.error) throw result.error;

    const snapshot = result.data as RegistrySnapshot;
    if (!hasUsableSnapshot(snapshot)) {
      return handoffResponse("No complete verified Amazon snapshot is available");
    }

    const updatedAt = snapshot.last_succeeded_at!;
    return Response.json(
      {
        items: snapshot.items,
        updatedAt,
        source: "Amazon",
        registryUrl: REGISTRY_URL,
        refreshState: isScheduleCurrent(updatedAt) ? "current" : "refreshing",
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Registry snapshot unavailable";
    console.error("registry_snapshot_load_failed", reason);
    return handoffResponse(reason);
  }
}
