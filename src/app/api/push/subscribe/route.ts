import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-admin";
import {
  isPushSubscription,
  isSameOriginRequest,
} from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = createSupabaseRouteClient(await cookies());
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user)
    return Response.json(
      { error: "Sign in to enable notifications." },
      { status: 401 },
    );
  const { data: pin, error: pinError } = await client.rpc("current_user_pin");
  if (pinError || !pin)
    return Response.json({ error: "Join a household first." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Send a valid JSON subscription." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object")
    return Response.json({ error: "Invalid subscription." }, { status: 400 });
  const input = body as { pin?: unknown; subscription?: unknown };
  // Preserve the request contract, but never trust its household scope.
  if (input.pin !== undefined && input.pin !== pin)
    return Response.json(
      { error: "Household does not match your account." },
      { status: 403 },
    );
  if (!isPushSubscription(input.subscription))
    return Response.json(
      { error: "Invalid browser push subscription." },
      { status: 400 },
    );
  const subscription = input.subscription;
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      pin_code: pin,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error)
    return Response.json(
      { error: "Could not enable notifications. Please try again." },
      { status: 500 },
    );
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
