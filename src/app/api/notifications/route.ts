import type { NotifyChannel } from "@/lib/types";
import { sendPushToPin } from "@/lib/push";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getLocalDateTime, isReminderDue } from "@/lib/local-time";
import { createSupabaseServiceClient } from "@/lib/supabase-admin";
import { isAllowedWebhookUrl } from "@/lib/webhook-url";

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
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Auth check
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  // Event dates/times are household-local; the server runs in UTC.
  const { dateKey: todayKey, minutes: nowMinutes } = getLocalDateTime(new Date());

  // Find events happening today that have notifications enabled
  const { data: events, error: eventsError } = await supabase
    .from("calendar_events")
    .select("id, pin_code, event_date, event_time, title, note, event_type, notify_channels, notify_before")
    .eq("event_date", todayKey)
    .gte("notify_before", 0);

  if (eventsError || !events?.length) {
    return Response.json({ sent: 0, message: eventsError?.message || "No events to notify" });
  }

  // Filter to events in the trigger window (skip events with no time)
  const triggeredEvents = events.filter((event) => {
    if (!event.event_time) return false;
    return isReminderDue(event.event_time as string, event.notify_before as number, nowMinutes);
  });

  const counts = await Promise.all(
    triggeredEvents.map(async (event) => {
      const channels = (event.notify_channels as NotifyChannel[]) ?? [];
      if (channels.length === 0) return 0;

      // Only skip if a prior run succeeded — failed attempts are retried each minute.
      const { data: existingLog } = await supabase
        .from("notification_log")
        .select("id")
        .eq("event_id", event.id)
        .eq("status", "sent")
        .limit(1);

      if (existingLog && existingLog.length > 0) return 0;

      // Fetch channel configs for this PIN
      const { data: channelConfigs } = await supabase
        .from("notification_channels")
        .select("*")
        .eq("pin_code", event.pin_code)
        .eq("is_enabled", true);

      if (!channelConfigs?.length) return 0;

      const message = `📌 *Fridgeboard Reminder*\n\n*${event.title}*${event.note ? `\n${event.note}` : ""}\n\n📅 ${todayKey}`;
      const subject = `Fridgeboard: ${event.title}`;

      const logs: { event_id: string; channel_type: NotifyChannel; status: "sent" | "failed" }[] = [];
      let eventSent = 0;

      for (const channelType of channels) {
        const configs = channelConfigs.filter((c) => c.channel_type === channelType);

        for (const config of configs) {
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

          logs.push({ event_id: event.id, channel_type: channelType, status: success ? "sent" : "failed" });
          if (success) eventSent++;
        }
      }

      if (logs.length > 0) {
        await supabase.from("notification_log").insert(logs);
      }

      // Push notification — sent to all subscribed devices for this PIN regardless of channel config
      const pushSent = await sendPushToPin(
        event.pin_code,
        {
          title: event.title,
          body: event.note ? event.note : `Reminder · ${todayKey}`,
          tag: `calendar-${event.id}`,
          url: "/list",
        },
        supabase,
      );

      return eventSent + pushSent;
    }),
  );

  const sent = counts.reduce((sum, n) => sum + n, 0);
  return Response.json({ sent, checked: events.length });
}
