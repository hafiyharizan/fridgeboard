// POST /api/push/new-item
// Called by the client immediately after a new list item is inserted.
// Sends a Web Push notification to all subscribed devices for the given PIN
// so household members are notified in real time.

import { sendPushToPin } from "@/lib/push";
import { createSupabaseServiceClient } from "@/lib/supabase";

type NewItemBody = {
  pin: string;
  listName: string;
  itemText: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as NewItemBody;
  const { pin, listName, itemText } = body;

  if (!pin || !listName || !itemText) {
    return Response.json({ error: "Missing required fields: pin, listName, itemText" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  // supabase is passed to sendPushToPin so it can query push_subscriptions
  // and remove expired endpoints (410/404) without spinning up a second client.

  const sent = await sendPushToPin(
    pin,
    {
      title: `New item on ${listName}`,
      body: itemText,
      tag: `new-item-${pin}-${Date.now()}`,
      url: "/list",
    },
    supabase,
  );

  return Response.json({ sent });
}
