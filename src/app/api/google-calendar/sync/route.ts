/**
 * POST /api/google-calendar/sync
 *
 * Triggers a full bidirectional sync for the authenticated household.
 * Can also be called from a cron job with the Bearer CRON_SECRET header
 * to re-sync all connected households.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase";
import { syncCalendar, getServiceClient } from "@/lib/google-calendar";
import { buildAppUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const appUrl = buildAppUrl("/list", origin);
  const CRON_SECRET = process.env.CRON_SECRET ?? "";

  // ── Allow cron / server-to-server calls ──────────────────────────────────
  const auth = request.headers.get("authorization");
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) {
    // Sync ALL connected households
    const supabase = getServiceClient();
    const { data: rows } = await supabase
      .from("google_calendar_tokens")
      .select("pin_code");

    const results = await Promise.all(
      (rows ?? []).map((row) =>
        syncCalendar(row.pin_code as string, appUrl).then((r) => ({
          pin_code: row.pin_code,
          ...r,
        })),
      ),
    );

    return NextResponse.json({ synced: results.length, results });
  }

  // ── Authenticated household sync ─────────────────────────────────────────
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

  const result = await syncCalendar(profile.pin_code, appUrl);
  return NextResponse.json(result);
}
