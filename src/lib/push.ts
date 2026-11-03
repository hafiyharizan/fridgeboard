// Server-side VAPID push utility
// Requires env vars: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import "server-only";
import webpush from "web-push";
import { isPushSubscription } from "@/lib/request-security";
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

export type PushOptions = {
  /** Skip devices owned by this member (e.g. the person who made the change). */
  excludeUserId?: string;
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
  options: PushOptions = {},
): Promise<number> {
  if (!initWebPush()) return 0;

  let query = supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("pin_code", pinCode);
  if (options.excludeUserId) {
    // Devices with no owner yet still get the alert; `neq` alone would drop them.
    query = query.or(`user_id.is.null,user_id.neq.${options.excludeUserId}`);
  }
  const { data: subs } = await query;

  if (!subs?.length) return 0;

  const message = JSON.stringify({ ...payload, url: payload.url ?? "/list" });

  const results = await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      isPushSubscription({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      })
        ? webpush
            .sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              message,
            )
            .catch(async (err: { statusCode?: number; message?: string }) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
              } else {
                console.error("[Push] Send failed:", err.message);
              }
              throw err;
            })
        : Promise.reject(new Error("Unsupported push destination")),
    ),
  );

  return results.filter((r) => r.status === "fulfilled").length;
}
