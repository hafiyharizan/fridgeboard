/**
 * POST /api/google-calendar/disconnect
 *
 * Stops the push-notification watch, revokes the access token, and removes
 * the google_calendar_tokens row for the authenticated household.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase";
import { stopWatch, getServiceClient } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createSupabaseRouteClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("pin_code")
    .eq("user_id", user.id)
    .single();

  if (!profile?.pin_code) {
    return NextResponse.json({ error: "No household found." }, { status: 400 });
  }

  const serviceClient = getServiceClient();
  const { data: tokenRow } = await serviceClient
    .from("google_calendar_tokens")
    .select("*")
    .eq("pin_code", profile.pin_code)
    .single();

  if (tokenRow) {
    // Stop the push-notification watch
    if (tokenRow.watch_channel_id && tokenRow.watch_resource_id) {
      // Best-effort; ignore errors from Google's side
      try {
        const { getValidAccessToken } = await import("@/lib/google-calendar");
        const at = await getValidAccessToken(profile.pin_code);
        if (at) {
          await stopWatch(at, tokenRow.watch_channel_id, tokenRow.watch_resource_id);
        }
      } catch {
        // Non-fatal
      }
    }

    // Revoke the token with Google
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenRow.access_token as string)}`,
        { method: "POST" },
      );
    } catch {
      // Non-fatal
    }

    // Remove the DB row
    await serviceClient
      .from("google_calendar_tokens")
      .delete()
      .eq("pin_code", profile.pin_code);
  }

  // Clear google_event_id from all events for this household
  await serviceClient
    .from("calendar_events")
    .update({ google_event_id: null })
    .eq("pin_code", profile.pin_code);

  return NextResponse.json({ ok: true });
}
