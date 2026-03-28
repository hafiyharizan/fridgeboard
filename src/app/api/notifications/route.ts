import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Cron-callable notification sender
// Call via: POST /api/notifications with Authorization: Bearer <CRON_SECRET>
//
// Checks calendar_events where notify_before >= 0, matches against current
// time, and dispatches to configured channels. Idempotent via notification_log.
//
// Set up a cron (Vercel Cron, GitHub Actions, etc.) to call this every minute.
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET || "";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}

// ---------------------------------------------------------------------------
// Channel dispatchers — add real integrations here
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
  return res.ok;
}

async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabase();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Find events happening today that have notifications enabled
  const { data: events, error: eventsError } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("event_date", todayKey)
    .gte("notify_before", 0);

  if (eventsError || !events?.length) {
    return Response.json({ sent: 0, message: eventsError?.message || "No events to notify" });
  }

  let sent = 0;

  for (const event of events) {
    const channels = (event.notify_channels as string[]) ?? [];
    if (channels.length === 0) continue;

    // Check notification_log to avoid duplicates
    const { data: existingLog } = await supabase
      .from("notification_log")
      .select("id")
      .eq("event_id", event.id)
      .eq("status", "sent")
      .limit(1);

    if (existingLog && existingLog.length > 0) continue;

    // Fetch channel configs for this PIN
    const { data: channelConfigs } = await supabase
      .from("notification_channels")
      .select("*")
      .eq("pin_code", event.pin_code)
      .eq("is_enabled", true);

    if (!channelConfigs?.length) continue;

    const message = `📌 *Fridgeboard Reminder*\n\n*${event.title}*${event.note ? `\n${event.note}` : ""}\n\n📅 ${todayKey}`;
    const subject = `Fridgeboard: ${event.title}`;

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
        }

        await supabase.from("notification_log").insert({
          event_id: event.id,
          channel_type: channelType,
          status: success ? "sent" : "failed",
        });

        if (success) sent++;
      }
    }
  }

  return Response.json({ sent, checked: events.length });
}
