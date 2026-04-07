/**
 * GET /api/google-calendar/callback?code=...&state=...
 *
 * OAuth2 redirect handler.  Exchanges the authorization code for tokens,
 * stores them, kicks off the first full sync, and registers a push-
 * notification watch channel.  Redirects the browser back to /list on
 * completion (with a ?gc=connected query param for the UI to pick up).
 */

import { NextResponse } from "next/server";
import { buildAppUrl } from "@/lib/site-url";
import {
  verifyOAuthState,
  exchangeCode,
  registerWatch,
  syncCalendar,
  getServiceClient,
} from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const origin = url.origin;

  // ── User denied access ────────────────────────────────────────────────────
  if (errorParam) {
    return NextResponse.redirect(buildAppUrl("/list?gc=denied", origin));
  }

  if (!code || !state) {
    return NextResponse.redirect(buildAppUrl("/list?gc=error", origin));
  }

  // ── Verify state ──────────────────────────────────────────────────────────
  const pinCode = await verifyOAuthState(state);
  if (!pinCode) {
    return NextResponse.redirect(buildAppUrl("/list?gc=error", origin));
  }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const tokens = await exchangeCode(code);
  if (!tokens) {
    return NextResponse.redirect(buildAppUrl("/list?gc=error", origin));
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const supabase = getServiceClient();

  // ── Upsert token row ──────────────────────────────────────────────────────
  const { error: upsertErr } = await supabase.from("google_calendar_tokens").upsert(
    {
      pin_code: pinCode,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      google_calendar_id: "primary",
      sync_token: null,
      watch_channel_id: null,
      watch_resource_id: null,
      watch_expiration: null,
    },
    { onConflict: "pin_code" },
  );

  if (upsertErr) {
    console.error("[Google Callback] Token upsert failed:", upsertErr.message);
    return NextResponse.redirect(buildAppUrl("/list?gc=error", origin));
  }

  // ── Register push-notification watch ─────────────────────────────────────
  const webhookUrl = buildAppUrl("/api/google-calendar/webhook", origin);
  const watch = await registerWatch(tokens.access_token, "primary", webhookUrl);
  if (watch) {
    await supabase
      .from("google_calendar_tokens")
      .update({
        watch_channel_id: watch.channelId,
        watch_resource_id: watch.resourceId,
        watch_expiration: new Date(watch.expiration).toISOString(),
      })
      .eq("pin_code", pinCode);
  }

  // ── Initial full sync (fire-and-forget; errors are logged, not fatal) ─────
  const appUrl = buildAppUrl("/list", origin);
  syncCalendar(pinCode, appUrl).then((result) => {
    console.log(
      `[Google Sync] Initial sync for ${pinCode}: pushed=${result.pushed} pulled=${result.pulled} errors=${result.errors.length}`,
    );
    if (result.errors.length > 0) {
      console.error("[Google Sync] Errors:", result.errors);
    }
  });

  return NextResponse.redirect(buildAppUrl("/list?gc=connected", origin));
}
