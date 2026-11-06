// Athan pushes for households with prayer times and athan alerts on.
// Called by /api/cron/tick. Also saves today's and tomorrow's prayer times in
// prayer_times, so the database's once-a-minute check (cron_tick_due) can
// tell when a prayer is due without running this code.

import type { SupabaseClient } from "@supabase/supabase-js";
import { safeTimeZone } from "@/lib/local-time";
import { dayInZone, dayKey, duePrayer, prayerSchedule, type DayParts } from "@/lib/prayer";
import { sendPushToPin } from "@/lib/push";
import type { Database, HouseholdSettings } from "@/lib/types";

const UNIQUE_VIOLATION = "23505";

type AthanHome = HouseholdSettings & { latitude: number; longitude: number };

async function athanHouseholds(supabase: SupabaseClient<Database>): Promise<AthanHome[]> {
  const { data, error } = await supabase
    .from("household_settings")
    .select("*")
    .eq("prayer_enabled", true)
    .eq("athan_enabled", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return (data ?? []).filter(
    (home): home is AthanHome => home.latitude !== null && home.longitude !== null,
  );
}

function nextDay(day: DayParts): DayParts {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function scheduleFor(home: AthanHome, day: DayParts) {
  return prayerSchedule(home.latitude, home.longitude, day, home.prayer_method, home.prayer_madhab);
}

/** Sends the athan push for any prayer that has just started. */
async function sendDuePrayers(supabase: SupabaseClient<Database>, homes: AthanHome[], now: Date) {
  let sent = 0;
  let due = 0;

  for (const home of homes) {
    const zone = safeTimeZone(home.timezone);
    const day = dayInZone(now, zone);
    const prayer = duePrayer(scheduleFor(home, day), now);
    if (!prayer) continue;
    due += 1;

    // Claim first so overlapping runs can't both send.
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

  return { due, sent };
}

/** Saves today's and tomorrow's prayer times and drops older days. */
async function savePrayerTimes(supabase: SupabaseClient<Database>, homes: AthanHome[], now: Date) {
  let saved = 0;
  for (const home of homes) {
    const today = dayInZone(now, safeTimeZone(home.timezone));
    const days = [today, nextDay(today)];
    const rows = days.flatMap((day) =>
      scheduleFor(home, day)
        .filter((slot) => Number.isFinite(slot.time.getTime()))
        .map((slot) => ({
          pin_code: home.pin_code,
          prayer: slot.name,
          prayer_date: dayKey(day),
          prayer_at: slot.time.toISOString(),
        })),
    );
    if (!rows.length) continue;

    const { error } = await supabase
      .from("prayer_times")
      .upsert(rows, { onConflict: "pin_code,prayer,prayer_date" });
    if (error) {
      console.error("[athan] saving prayer times failed:", error.message);
      continue;
    }
    saved += rows.length;
    await supabase.from("prayer_times").delete().eq("pin_code", home.pin_code).lt("prayer_date", dayKey(today));
  }
  return saved;
}

export async function runAthan(supabase: SupabaseClient<Database>, now: Date) {
  const homes = await athanHouseholds(supabase);
  const pushes = await sendDuePrayers(supabase, homes, now);
  const saved = await savePrayerTimes(supabase, homes, now);
  return { ...pushes, households: homes.length, timesSaved: saved };
}
