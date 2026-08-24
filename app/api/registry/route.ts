const REGISTRY_URL = "https://my.babylist.com/janelle-fernando";

export async function GET() {
  return Response.json(
    {
      mode: "handoff",
      registryUrl: REGISTRY_URL,
      reason: "Automated mirroring is disabled until Babylist authorizes a production integration.",
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
