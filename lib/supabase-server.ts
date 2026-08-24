import { createClient } from "@supabase/supabase-js";

const PUBLIC_PROJECT_URL = "https://nlwmbrddtunvphmiywuq.supabase.co";
const PUBLIC_PROJECT_KEY = "sb_publishable_AuG7oAeI-pRAxU0XdGK9rQ_O2mHI6wU";

function publicConfig(name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  if (name === "SUPABASE_URL") return process.env.SUPABASE_URL ?? PUBLIC_PROJECT_URL;
  return process.env.SUPABASE_PUBLISHABLE_KEY ?? PUBLIC_PROJECT_KEY;
}

export function createPublicServerClient() {
  return createClient(publicConfig("SUPABASE_URL"), publicConfig("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

export function createAdminServerClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured");
  return createClient(publicConfig("SUPABASE_URL"), secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}
