/**
 * POST /api/google-calendar/webhook
 *
 * Receives Google Calendar push-notification payloads (RFC 3229 channel
 * notifications).  Google sends a minimal notification:
 *
 *   X-Goog-Channel-ID: <channel-id>
 *   X-Goog-Resource-ID: <resource-id>
 *   X-Goog-Resource-State: sync | exists | not_exists
 *   X-Goog-Channel-Token: (optional, unused here)
 *
 * On receiving "exists" or "sync" we trigger an incremental sync for the
 * matching household.  Google expects a 200 OK quickly — the sync runs
 * asynchronously.
 */

import { NextResponse } from "next/server";
import { getServiceClient, syncCalendar } from "@/lib/google-calendar";
import { buildAppUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceState = request.headers.get("x-goog-resource-state");

  // Respond immediately — Google will retry on failure
  if (!channelId) {
    return new NextResponse(null, { status: 400 });
  }

  // The "sync" state is the initial handshake — acknowledge only
  if (resourceState === "not_exists") {
    return new NextResponse(null, { status: 200 });
  }

  // Resolve which household owns this channel
  const supabase = getServiceClient();
  const { data: tokenRow } = await supabase
    .from("google_calendar_tokens")
    .select("pin_code")
    .eq("watch_channel_id", channelId)
    .single();

  if (!tokenRow) {
    // Channel not found (possibly stale) — 200 to stop retries
    return new NextResponse(null, { status: 200 });
  }

  const pinCode = tokenRow.pin_code as string;
  const origin = new URL(request.url).origin;
  const appUrl = buildAppUrl("/list", origin);

  // Trigger sync asynchronously — return 200 before it finishes
  void syncCalendar(pinCode, appUrl).then((result) => {
    console.log(
      `[Google Webhook] Sync for ${pinCode}: pushed=${result.pushed} pulled=${result.pulled} deleted=${result.deleted}`,
    );
    if (result.errors.length > 0) {
      console.error("[Google Webhook] Sync errors:", result.errors);
    }
  });

  // Renew the watch if expiring within 24 hours
  const { data: fullRow } = await supabase
    .from("google_calendar_tokens")
    .select("watch_expiration, access_token, refresh_token, expires_at, google_calendar_id")
    .eq("pin_code", pinCode)
    .single();

  if (fullRow?.watch_expiration) {
    const expiresIn = new Date(fullRow.watch_expiration as string).getTime() - Date.now();
    if (expiresIn < 24 * 60 * 60 * 1000) {
      // Import lazily to avoid circular deps at module load time
      const { registerWatch, getValidAccessToken } = await import("@/lib/google-calendar");
      const at = await getValidAccessToken(pinCode);
      if (at) {
        const webhookUrl = buildAppUrl("/api/google-calendar/webhook", origin);
        const watch = await registerWatch(
          at,
          (fullRow.google_calendar_id as string) ?? "primary",
          webhookUrl,
        );
        if (watch) {
          await supabase
            .from("google_calendar_tokens")
            .update({
              watch_channel_id: watch.channelId,
              watch_resource_id: watch.resourceId,
              watch_expiration: new Date(watch.expiration).toISOString(),
            })
            .eq("pin_code", pinCode);
        }
      }
    }
  }

  return new NextResponse(null, { status: 200 });
}
