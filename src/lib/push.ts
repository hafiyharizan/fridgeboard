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
  /**
   * Seconds the push service may hold the alert for an offline device. Past
   * that it is dropped, so a reminder never turns up hours late. Default 1 hour.
   */
  ttlSeconds?: number;
  /** "high" wakes a sleeping phone promptly (reminders, athan). */
  urgency?: "very-low" | "low" | "normal" | "high";
};

export type PushResult = {
  /** Devices subscribed for this household (after excludeUserId). */
  devices: number;
  sent: number;
  /** Failures worth retrying (not expired subscriptions, which are removed). */
  failed: number;
  /** False when VAPID keys are missing, so nothing could be sent. */
  configured: boolean;
};

const SEND_TIMEOUT_MS = 10_000;

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
  return (await sendPush(pinCode, payload, supabase, options)).sent;
}

/** Like sendPushToPin, with the detail the delivery queue needs to decide on a retry. */
export async function sendPush(
  pinCode: string,
  payload: PushPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  options: PushOptions = {},
): Promise<PushResult> {
  if (!initWebPush()) return { devices: 0, sent: 0, failed: 0, configured: false };

  let query = supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("pin_code", pinCode);
  if (options.excludeUserId) {
    // Devices with no owner yet still get the alert; `neq` alone would drop them.
    query = query.or(`user_id.is.null,user_id.neq.${options.excludeUserId}`);
  }
  const { data: subs, error } = await query;
  if (error) return { devices: 0, sent: 0, failed: 1, configured: true };
  if (!subs?.length) return { devices: 0, sent: 0, failed: 0, configured: true };

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
              {
                TTL: options.ttlSeconds ?? 3600,
                urgency: options.urgency ?? "normal",
                timeout: SEND_TIMEOUT_MS,
              },
            )
            .catch(async (err: { statusCode?: number; message?: string }) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
                throw new GoneError();
              }
              console.error("[Push] Send failed:", err.statusCode ?? "", err.message);
              throw err;
            })
        : Promise.reject(new GoneError()),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected" && !(r.reason instanceof GoneError)).length;
  return { devices: subs.length, sent, failed, configured: true };
}

/** A device that can never receive this push (unsubscribed or unsupported); not retried. */
class GoneError extends Error {}
