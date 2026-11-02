// POST /api/push/subscribe
// Saves a Web Push subscription for the signed-in user's household.
// Called by the client after navigator.serviceWorker + pushManager.subscribe().
//
// The household comes from the session (current_user_pin), never from the
// request body, so nobody can subscribe to another household's notifications.

import { cookies } from "next/headers";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase";

type SubscribeBody = {
  subscription?: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
};

const MAX_FIELD_LENGTH = 2048;

function isShortString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_FIELD_LENGTH;
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createSupabaseRouteClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in to turn on notifications." }, { status: 401 });
  }

  const { data: pinCode, error: pinError } = await supabase.rpc("current_user_pin");

  if (pinError || !pinCode) {
    return Response.json({ error: "Join a household before turning on notifications." }, { status: 403 });
  }

  let body: SubscribeBody;

  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return Response.json({ error: "Send a JSON body with a subscription." }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;

  if (!isShortString(endpoint) || !isHttpsUrl(endpoint) || !isShortString(p256dh) || !isShortString(auth)) {
    return Response.json({ error: "Missing or invalid subscription fields" }, { status: 400 });
  }

  // push_subscriptions is service-role only; the household was resolved above.
  const service = createSupabaseServiceClient();
  const { error } = await service.from("push_subscriptions").upsert(
    {
      pin_code: pinCode,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[Push] Could not save subscription:", error.message);
    return Response.json({ error: "Could not save subscription" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
