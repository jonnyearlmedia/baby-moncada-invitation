import { redirect } from "next/navigation";
import { hasHostSession } from "@/lib/admin-session";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await hasHostSession())) redirect("/dashboard/login");
  return <DashboardClient />;
}
