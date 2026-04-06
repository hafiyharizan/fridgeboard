// Server-side VAPID push utility
// Requires env vars: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

function initWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@fridgeboard.app";

  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID keys not set — push notifications disabled.");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

/**
 * Send a push notification to all subscribed devices for a given PIN.
 * Returns the number of successful sends. Expired subscriptions (410/404) are
 * automatically removed from the database.
 */
export async function sendPushToPin(
  pinCode: string,
  payload: PushPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<number> {
  if (!initWebPush()) return 0;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("pin_code", pinCode);

  if (!subs?.length) return 0;

  const message = JSON.stringify({ ...payload, url: payload.url ?? "/list" });

  const results = await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
      ).catch(async (err: { statusCode?: number; message?: string }) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else {
          console.error("[Push] Send failed:", err.message);
        }
        throw err;
      }),
    ),
  );

  return results.filter((r) => r.status === "fulfilled").length;
}
