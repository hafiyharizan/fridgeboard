// Email (Resend), Telegram and webhook senders for event reminders.
// Each returns null on success, or why it failed and whether a retry could help.

import "server-only";
import { isAllowedWebhookUrl } from "@/lib/webhook-url";

const TIMEOUT_MS = 10_000;

export type SendFailure = { reason: string; retry: boolean };

const permanent = (reason: string): SendFailure => ({ reason, retry: false });
const transient = (reason: string): SendFailure => ({ reason, retry: true });

/** Server errors and rate limits may pass; other 4xx (bad chat id, bad key) won't. */
async function failure(res: Response, label: string): Promise<SendFailure> {
  const detail = await res.text().catch(() => res.statusText);
  console.error(`[${label}] HTTP ${res.status}: ${detail.slice(0, 300)}`);
  const reason = `${label} HTTP ${res.status}`;
  return res.status >= 500 || res.status === 429 ? transient(reason) : permanent(reason);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<SendFailure | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return permanent("RESEND_API_KEY not set");
  const from = process.env.RESEND_FROM_EMAIL || "Fridgeboard <noreply@fridgeboard.app>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text: body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? null : failure(res, "email");
  } catch {
    return transient("email unreachable");
  }
}

/**
 * Plain text, no parse_mode: with Markdown on, an event title containing
 * `_`, `*` or `[` made Telegram reject the message every time.
 */
export async function sendTelegram(chatId: string, text: string): Promise<SendFailure | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return permanent("TELEGRAM_BOT_TOKEN not set");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? null : failure(res, "telegram");
  } catch {
    return transient("telegram unreachable");
  }
}

export async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<SendFailure | null> {
  if (!isAllowedWebhookUrl(url)) return permanent("webhook URL not allowed");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? null : failure(res, "webhook");
  } catch {
    return transient("webhook unreachable");
  }
}
