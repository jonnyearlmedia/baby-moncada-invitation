"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error ?? "Sign-in failed."); setBusy(false); return; }
    router.replace("/dashboard"); router.refresh();
  }
  return <form className="admin-form" onSubmit={submit}><label>Shared passcode<input type="password" autoComplete="current-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} required /></label>{error && <p className="admin-error" role="alert">{error}</p>}<button disabled={busy}>{busy ? "Checking…" : "Open dashboard"}</button></form>;
}
