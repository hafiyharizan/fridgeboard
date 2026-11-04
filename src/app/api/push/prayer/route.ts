// POST /api/push/prayer
// Called every minute by the event-reminders Netlify scheduled function.
// For households with athan alerts on, sends a push when a prayer time
// arrives. prayer_push_log makes each one single-use.
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getAppTimezone } from "@/lib/local-time";
import { dayInZone, dayKey, duePrayer, prayerSchedule, type DayParts } from "@/lib/prayer";
import { sendPushToPin } from "@/lib/push";
import { createSupabaseServiceClient } from "@/lib/supabase-admin";

const UNIQUE_VIOLATION = "23505";

function safeDay(now: Date, timeZone: string): { day: DayParts; zone: string } {
  try {
    return { day: dayInZone(now, timeZone), zone: timeZone };
  } catch {
    // Unknown zone name: fall back to the app default rather than skipping.
    const zone = getAppTimezone();
    return { day: dayInZone(now, zone), zone };
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: households, error } = await supabase
    .from("household_settings")
    .select("*")
    .eq("prayer_enabled", true)
    .eq("athan_enabled", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) return Response.json({ error: "Could not load settings" }, { status: 500 });

  const now = new Date();
  let sent = 0;
  let due = 0;

  for (const home of households ?? []) {
    if (home.latitude === null || home.longitude === null) continue;
    const { day, zone } = safeDay(now, home.timezone || getAppTimezone());
    const prayer = duePrayer(
      prayerSchedule(home.latitude, home.longitude, day, home.prayer_method, home.prayer_madhab),
      now,
    );
    if (!prayer) continue;
    due += 1;

    // Claim first so overlapping cron runs can't both send.
    const { error: claimError } = await supabase
      .from("prayer_push_log")
      .insert({ pin_code: home.pin_code, prayer: prayer.name, prayer_date: dayKey(day) });
    if (claimError) {
      if (claimError.code !== UNIQUE_VIOLATION) console.error("[athan] log failed:", claimError.message);
      continue;
    }

    const time = prayer.time.toLocaleTimeString("en-AU", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    });
    sent += await sendPushToPin(
      home.pin_code,
      {
        title: `Time for ${prayer.label}`,
        body: `${prayer.label} · ${time}${home.location_name ? ` in ${home.location_name.split(",")[0]}` : ""}`,
        tag: `athan-${prayer.name}-${dayKey(day)}`,
        url: "/list",
      },
      supabase,
    );
  }

  return Response.json({ sent, due, households: households?.length ?? 0 });
}
