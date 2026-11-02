// Shared by the scheduled functions in netlify/functions.
// Calls one of the app's cron routes on the live site, using the CRON_SECRET
// that is already set in Netlify. URL is Netlify's main site URL.

export async function callCronRoute(path: string): Promise<Response> {
  const siteUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!siteUrl || !secret) {
    console.error(`[scheduler] Missing ${!siteUrl ? "URL" : "CRON_SECRET"}; skipped ${path}`);
    return new Response("Scheduler not configured", { status: 500 });
  }

  const response = await fetch(new URL(path, siteUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25_000), // scheduled functions stop at 30s
  });

  const body = await response.text();
  console.log(`[scheduler] ${path} -> HTTP ${response.status} ${body.slice(0, 300)}`);

  return new Response(body, { status: response.ok ? 200 : 502 });
}
