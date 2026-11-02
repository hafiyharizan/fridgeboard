import { cookies } from "next/headers";
import { buildCalendarFeed } from "@/lib/calendar-feed";
import { createSupabaseRouteClient } from "@/lib/supabase";
import type { CalendarEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/calendar/feed/[token]">) {
  const { token } = await context.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseRouteClient(cookieStore);

  const { data: isValid, error: validationError } = await supabase.rpc("validate_calendar_sync_token", {
    feed_token: token,
  });

  if (validationError || !isValid) {
    return new Response("Not found", { status: 404 });
  }

  const { data, error } = await supabase.rpc("get_calendar_feed", { feed_token: token });

  if (error) {
    console.error("[Calendar feed] Could not load feed:", error.message);
    return new Response("Could not load calendar", { status: 500 });
  }

  const feedUrl = new URL(request.url).toString();
  const ics = buildCalendarFeed((data ?? []) as CalendarEvent[], {
    calendarName: "Fridgeboard",
    calendarDescription: "Shared Fridgeboard calendar feed",
    calendarUrl: feedUrl,
  });

  return new Response(ics, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": 'inline; filename="fridgeboard.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
