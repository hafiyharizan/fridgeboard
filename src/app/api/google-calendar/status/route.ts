/**
 * GET /api/google-calendar/status
 *
 * Returns whether Google Calendar is connected for the authenticated user.
 * Also returns the CalDAV URL for Apple Calendar setup.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase";
import { getServiceClient } from "@/lib/google-calendar";
import { buildAppUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createSupabaseRouteClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false, caldavUrl: null });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("pin_code")
    .eq("user_id", user.id)
    .single();

  if (!profile?.pin_code) {
    return NextResponse.json({ connected: false, caldavUrl: null });
  }

  // Check Google Calendar connection
  const serviceClient = getServiceClient();
  const { data: tokenRow } = await serviceClient
    .from("google_calendar_tokens")
    .select("google_calendar_id, watch_expiration")
    .eq("pin_code", profile.pin_code)
    .single();

  // Fetch the CalDAV sync token
  const { data: syncToken } = await serviceClient
    .from("calendar_sync_tokens")
    .select("token")
    .eq("pin_code", profile.pin_code)
    .single();

  const origin = new URL(request.url).origin;
  const caldavUrl = syncToken?.token
    ? buildAppUrl(`/api/caldav/${syncToken.token}/`, origin)
    : null;

  return NextResponse.json({
    connected: Boolean(tokenRow),
    calendarId: (tokenRow?.google_calendar_id as string | undefined) ?? null,
    watchExpiration: (tokenRow?.watch_expiration as string | undefined) ?? null,
    caldavUrl,
  });
}
