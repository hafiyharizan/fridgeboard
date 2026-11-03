// GET /api/version — which deploy is live. Kitchen displays poll this and
// reload themselves (while idle) when it changes.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
