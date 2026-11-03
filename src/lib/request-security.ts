/** Browser mutations must originate from this application. No CORS is enabled. */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  return !origin || origin === new URL(request.url).origin;
}

export function isPushSubscription(
  value: unknown,
): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== "object") return false;
  const subscription = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (
    typeof subscription.endpoint !== "string" ||
    subscription.endpoint.length > 4096
  )
    return false;
  if (
    typeof subscription.keys?.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string"
  )
    return false;
  if (
    !/^[A-Za-z0-9_-]{87}={0,2}$/.test(subscription.keys.p256dh) ||
    !/^[A-Za-z0-9_-]{22}={0,2}$/.test(subscription.keys.auth)
  )
    return false;
  try {
    const url = new URL(subscription.endpoint);
    // Web Push is an outbound server request: accept browser push services only.
    const host = url.hostname;
    const allowed =
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") ||
      host === "web.push.apple.com" ||
      host.endsWith(".notify.windows.com");
    return (
      allowed &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash
    );
  } catch {
    return false;
  }
}
