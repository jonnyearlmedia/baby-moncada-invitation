import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase-server";
import { createHostSession, hashIp, HOST_COOKIE, hostCookieOptions, verifyHostPasscode } from "@/lib/admin-session";

export const runtime = "nodejs";

const loginSchema = z.object({ passcode: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Enter the host passcode." }, { status: 400 });
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = hashIp(forwarded);
    const admin = createAdminServerClient();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin.from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("attempted_at", cutoff).eq("succeeded", false);
    if (countError) throw countError;
    if ((count ?? 0) >= 8) return Response.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });

    const succeeded = verifyHostPasscode(parsed.data.passcode);
    const { error: auditError } = await admin.from("admin_login_attempts").insert({ ip_hash: ipHash, succeeded });
    if (auditError) throw auditError;
    if (!succeeded) return Response.json({ error: "That passcode is not correct." }, { status: 401 });

    (await cookies()).set(HOST_COOKIE, createHostSession(), hostCookieOptions);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("host_login_failed", error);
    return Response.json({ error: "Host sign-in is temporarily unavailable." }, { status: 500 });
  }
}

export async function DELETE() {
  (await cookies()).set(HOST_COOKIE, "", { ...hostCookieOptions, maxAge: 0 });
  return Response.json({ ok: true });
}
