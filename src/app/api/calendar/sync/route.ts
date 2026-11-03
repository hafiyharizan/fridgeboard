import { isSameOriginRequest } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAppUrl } from "@/lib/site-url";
import { createSupabaseRouteClient } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cookieStore = await cookies();
  const supabase = createSupabaseRouteClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to create a calendar sync link." }, { status: 401 });
  }

  const { data: token, error } = await supabase.rpc("ensure_calendar_sync_token");

  if (error || !token) {
    return NextResponse.json({ error: error?.message || "Could not create a calendar sync link." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const feedUrl = buildAppUrl(`/api/calendar/feed/${token}`, origin);

  return NextResponse.json({
    feedUrl,
    appleUrl: feedUrl.replace(/^https?:\/\//, "webcal://"),
    googleUrl: "https://calendar.google.com/calendar/u/0/r/settings/addbyurl",
  });
}
