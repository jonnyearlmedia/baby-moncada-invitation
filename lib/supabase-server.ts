import { createClient } from "@supabase/supabase-js";

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createPublicServerClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

export function createAdminServerClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured");
  return createClient(requireEnv("SUPABASE_URL"), secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}
