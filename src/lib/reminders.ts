// Calendar reminders: push to the household's devices, plus any email /
// Telegram / webhook channels the event asks for. Called by /api/cron/tick.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToPin } from "@/lib/push";
import { isReminderDue, reminderTriggerAt, safeTimeZone } from "@/lib/local-time";
import type { Database, NotifyChannel } from "@/lib/types";
import { isAllowedWebhookUrl } from "@/lib/webhook-url";

const UNIQUE_VIOLATION = "23505";
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Channel dispatchers
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Fridgeboard <noreply@fridgeboard.app>";

  if (!apiKey) {
    console.log(`[EMAIL] RESEND_API_KEY not set — skipping. To: ${to}`);
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text: body }),
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    console.error(`[EMAIL] Resend error (${res.status}): ${error}`);
  }

  return res.ok;
}

async function sendTelegram(chatId: string, message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[TELEGRAM] No bot token. Chat: ${chatId} | Message: ${message}`);
    return false;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    console.error(`[TELEGRAM] API error (${res.status}): ${error}`);
  }

  return res.ok;
}

async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!isAllowedWebhookUrl(url)) {
    console.warn("[Notifications] Skipped webhook with a non-public or non-https URL");
    return false;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Due reminders
// ---------------------------------------------------------------------------

function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Sends every reminder that is due now. The push goes out once per event
 * (claimed in notification_log first, so overlapping runs can't both send).
 * Email / Telegram / webhook channels are retried each run while they keep
 * failing and the reminder is still inside its catch-up window.
 */
export async function sendDueReminders(supabase: SupabaseClient<Database>, now: Date) {
  // Every household-local "today" is within a day of the UTC date; reminders
  // fire at most a couple of hours before the event.
  const t = now.getTime();
  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("id, pin_code, event_date, event_time, title, note, event_type, notify_channels, notify_before")
    .gte("event_date", utcDateKey(t - DAY_MS))
    .lte("event_date", utcDateKey(t + 2 * DAY_MS))
    .gte("notify_before", 0)
    .not("event_time", "is", null);

  if (error) throw new Error(`Could not load events: ${error.message}`);
  if (!events?.length) return { due: 0, sent: 0 };

  const pins = [...new Set(events.map((event) => event.pin_code))];
  const { data: settings } = await supabase
    .from("household_settings")
    .select("pin_code, timezone")
    .in("pin_code", pins);
  const zoneByPin = new Map((settings ?? []).map((row) => [row.pin_code, row.timezone]));

  const due = events.filter((event) =>
    isReminderDue(reminderTriggerAt(event, safeTimeZone(zoneByPin.get(event.pin_code))), now),
  );
  if (!due.length) return { due: 0, sent: 0 };

  const { data: logs } = await supabase
    .from("notification_log")
    .select("event_id, channel_type")
    .in("event_id", due.map((event) => event.id))
    .eq("status", "sent");
  const sentByEvent = new Map<string, Set<string>>();
  for (const log of logs ?? []) {
    const set = sentByEvent.get(log.event_id) ?? new Set<string>();
    set.add(log.channel_type);
    sentByEvent.set(log.event_id, set);
  }

  const counts = await Promise.all(
    due.map(async (event) => {
      const alreadySent = sentByEvent.get(event.id) ?? new Set<string>();
      let sent = 0;
      const body = event.note ? event.note : `Reminder · ${event.event_date}`;

      // Push: claim first. A unique index allows one "push" row per event.
      if (!alreadySent.has("push")) {
        const { error: claimError } = await supabase
          .from("notification_log")
          .insert({ event_id: event.id, channel_type: "push", status: "sent" });
        if (!claimError) {
          sent += await sendPushToPin(
            event.pin_code,
            { title: event.title, body, tag: `calendar-${event.id}`, url: "/list" },
            supabase,
          );
        } else if (claimError.code !== UNIQUE_VIOLATION) {
          console.error("[reminders] push claim failed:", claimError.message);
        }
      }

      const wanted = (event.notify_channels ?? []).filter(
        (channel) => !alreadySent.has(channel),
      );
      if (!wanted.length) return sent;

      const { data: channelConfigs } = await supabase
        .from("notification_channels")
        .select("channel_type, channel_value")
        .eq("pin_code", event.pin_code)
        .eq("is_enabled", true)
        .in("channel_type", wanted);
      if (!channelConfigs?.length) return sent;

      const message = `📌 *Fridgeboard Reminder*\n\n*${event.title}*${event.note ? `\n${event.note}` : ""}\n\n📅 ${event.event_date}`;
      const subject = `Fridgeboard: ${event.title}`;
      const results: { event_id: string; channel_type: NotifyChannel; status: "sent" | "failed" }[] = [];

      for (const config of channelConfigs) {
        const channelType = config.channel_type;
        let success = false;
        switch (channelType) {
          case "email":
            success = await sendEmail(config.channel_value, subject, message);
            break;
          case "telegram":
            success = await sendTelegram(config.channel_value, message);
            break;
          case "webhook":
            success = await sendWebhook(config.channel_value, {
              event_id: event.id,
              title: event.title,
              note: event.note,
              event_date: event.event_date,
              event_type: event.event_type,
            });
            break;
          default: {
            const _exhaustive: never = channelType;
            void _exhaustive;
          }
        }
        results.push({ event_id: event.id, channel_type: channelType, status: success ? "sent" : "failed" });
        if (success) sent++;
      }

      if (results.length) {
        // Separate inserts: (event_id, channel_type, sent_at) is unique, and
        // two configs of one type would share sent_at in a single insert.
        for (const row of results) await supabase.from("notification_log").insert(row);
      }
      return sent;
    }),
  );

  return { due: due.length, sent: counts.reduce((sum, n) => sum + n, 0) };
}
