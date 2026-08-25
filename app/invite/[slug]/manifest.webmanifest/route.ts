import { invitationManifest } from "@/lib/web-app-manifest";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  return Response.json(invitationManifest(slug), {
    headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
