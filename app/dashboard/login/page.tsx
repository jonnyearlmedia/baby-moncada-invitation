import { redirect } from "next/navigation";
import { hasHostSession } from "@/lib/admin-session";
import LoginForm from "./login-form";

export default async function HostLoginPage() {
  if (await hasHostSession()) redirect("/dashboard");
  return <main className="admin-shell login-shell"><section className="admin-card login-card"><p className="admin-kicker">Baby Moncada</p><h1>Host dashboard</h1><p>Enter the shared host passcode to view RSVPs and manage invitation details.</p><LoginForm /></section></main>;
}
