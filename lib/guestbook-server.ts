import type { SupabaseClient } from "@supabase/supabase-js";
import { GUESTBOOK_BUCKET, type GuestbookEntry, type GuestbookRow } from "@/lib/guestbook";

export function toGuestbookEntry(client: SupabaseClient, row: GuestbookRow, includeHidden = false): GuestbookEntry {
  return {
    id: row.id,
    name: row.guest_name,
    message: row.message,
    frame: row.frame,
    photoUrl: row.photo_path ? client.storage.from(GUESTBOOK_BUCKET).getPublicUrl(row.photo_path).data.publicUrl : null,
    createdAt: row.created_at,
    ...(includeHidden ? { hidden: row.hidden } : {}),
  };
}
