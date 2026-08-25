import { dashboardManifest } from "@/lib/web-app-manifest";

export function GET() {
  return Response.json(dashboardManifest(), {
    headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
