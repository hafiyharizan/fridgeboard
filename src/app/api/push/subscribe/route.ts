// POST /api/push/subscribe
// Saves a Web Push subscription for the given PIN.
// Called by the client after navigator.serviceWorker + pushManager.subscribe().

import { createSupabaseServiceClient } from "@/lib/supabase";

type SubscribeBody = {
  pin: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
};

export async function POST(request: Request) {
  const body = (await request.json()) as SubscribeBody;
  const { pin, subscription } = body;

  if (
    !pin ||
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    return Response.json({ error: "Missing pin or subscription fields" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      pin_code: pin,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
