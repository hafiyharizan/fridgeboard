// POST /api/push/new-item  { itemId }
// Called by the browser right after it adds a list item. Tells the rest of the
// household's devices about it.
//
// The browser only names the item. Everything in the message (list, text, who
// added it) is read on the server, and only the member who added the item can
// announce it, once, within a few minutes of adding it.

import { cookies } from "next/headers";
import { buildNewItemPush, isRecentItem } from "@/lib/new-item-push";
import { sendPushToPin } from "@/lib/push";
import { isSameOriginRequest } from "@/lib/request-security";
import { createSupabaseRouteClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-admin";
import { getUserDisplayName } from "@/lib/user-profile";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const client = createSupabaseRouteClient(await cookies());
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user)
    return Response.json({ error: "Sign in first." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send valid JSON." }, { status: 400 });
  }
  const itemId = (body as { itemId?: unknown } | null)?.itemId;
  if (typeof itemId !== "string" || !UUID.test(itemId))
    return Response.json({ error: "Invalid item." }, { status: 400 });

  // Read with the member's own client so RLS limits this to their household.
  const { data: item } = await client
    .from("items")
    .select("id, list_id, text, created_by, created_at")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.created_by !== user.id)
    return Response.json({ error: "Item not found." }, { status: 404 });
  if (!isRecentItem(item.created_at))
    return Response.json({ sent: 0, skipped: "stale" }, { headers: noStore });

  const [{ data: list }, { data: profile }] = await Promise.all([
    client.from("lists").select("name, pin_code").eq("id", item.list_id).maybeSingle(),
    client.from("user_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!list) return Response.json({ error: "Item not found." }, { status: 404 });

  const admin = createSupabaseServiceClient();
  // Claim the announcement first so retries and replays can't send it twice.
  const { error: claimError } = await admin
    .from("item_push_log")
    .insert({ item_id: item.id });
  if (claimError) {
    if (claimError.code === UNIQUE_VIOLATION)
      return Response.json({ sent: 0, skipped: "duplicate" }, { headers: noStore });
    return Response.json({ error: "Could not send notification." }, { status: 500 });
  }

  const sent = await sendPushToPin(
    list.pin_code,
    buildNewItemPush({
      adderName: getUserDisplayName(user, profile),
      itemText: item.text,
      listId: item.list_id,
      listName: list.name,
    }),
    admin,
    { excludeUserId: user.id },
  );

  return Response.json({ sent }, { headers: noStore });
}
