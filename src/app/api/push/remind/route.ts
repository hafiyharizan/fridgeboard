// POST /api/push/remind?mode=grocery|summary
// Cron-triggered route that sends proactive push notifications.
//
// grocery  — fires when a household has unchecked grocery items.
//            Schedule daily (e.g. 8 am local time via Netlify Scheduled Functions).
// summary  — morning briefing: today's events + grocery count.
//            Schedule daily (e.g. 7 am).
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { sendPushToPin } from "@/lib/push";
import { createSupabaseServiceClient } from "@/lib/supabase";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(request: Request) {
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const rawMode = url.searchParams.get("mode");
  if (rawMode !== "grocery" && rawMode !== "summary") {
    return Response.json({ error: "mode must be grocery or summary" }, { status: 400 });
  }
  const mode = rawMode;

  const supabase = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Collect all distinct PINs that have push subscriptions
  const { data: allSubs } = await supabase.from("push_subscriptions").select("pin_code");

  if (!allSubs?.length) {
    return Response.json({ sent: 0, message: "No push subscriptions found" });
  }

  const pins = [...new Set(allSubs.map((s: { pin_code: string }) => s.pin_code))];

  // Batch-fetch data for all PINs upfront to avoid N+1 queries
  const [{ data: allLists }, { data: allItems }, { data: allEvents }] = await Promise.all([
    supabase
      .from("lists")
      .select("id, pin_code, name")
      .in("pin_code", pins),
    supabase
      .from("items")
      .select("list_id, text, is_checked")
      .eq("is_checked", false),
    mode === "summary"
      ? supabase
          .from("calendar_events")
          .select("pin_code, title")
          .in("pin_code", pins)
          .eq("event_date", today)
          .eq("is_done", false)
      : Promise.resolve({ data: [] as { pin_code: string; title: string }[] | null }),
  ]);

  const results = await Promise.all(
    pins.map(async (pin) => {
      if (mode === "grocery") {
        const list = allLists?.find(
          (l) => l.pin_code === pin && l.name.toLowerCase().startsWith("groc"),
        );
        if (!list) return 0;

        const items = allItems?.filter((i) => i.list_id === list.id) ?? [];
        if (!items.length) return 0;

        const body =
          items.length === 1
            ? `${items[0].text} is still on the grocery list`
            : `${items.length} items still on the grocery list`;

        return sendPushToPin(
          pin,
          { title: "Grocery reminder", body, tag: `grocery-${today}`, url: "/list" },
          supabase,
        );
      }

      // summary mode
      const events = allEvents?.filter((e) => e.pin_code === pin) ?? [];
      const list = allLists?.find(
        (l) => l.pin_code === pin && l.name.toLowerCase().startsWith("groc"),
      );
      const unchecked = list
        ? (allItems?.filter((i) => i.list_id === list.id).length ?? 0)
        : 0;

      const parts: string[] = [];
      if (events.length) parts.push(`${events.length} event${events.length > 1 ? "s" : ""} today`);
      if (unchecked > 0) parts.push(`${unchecked} grocery item${unchecked > 1 ? "s" : ""} to grab`);
      if (!parts.length) return 0;

      return sendPushToPin(
        pin,
        {
          title: "Good morning — Fridgeboard",
          body: parts.join(" · "),
          tag: `summary-${today}`,
          url: "/list",
        },
        supabase,
      );
    }),
  );

  const totalSent = results.reduce((sum, n) => sum + n, 0);
  return Response.json({ sent: totalSent, pins: pins.length, mode });
}
