/**
 * GET /api/google-calendar/authorize?pin=<pin_code>
 *
 * Returns the Google OAuth2 authorization URL.  The caller (CalendarSettings)
 * redirects the user's browser to it.  The pin_code is embedded in the state
 * parameter, HMAC-signed so it cannot be tampered with.
 */

import { NextResponse } from "next/server";
import { createOAuthState, googleConfig } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const { clientId, redirectUri, scopes } = googleConfig();

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured on this server." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const pin = url.searchParams.get("pin");
  if (!pin) {
    return NextResponse.json({ error: "Missing pin parameter." }, { status: 400 });
  }

  const state = await createOAuthState(pin);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // force consent to get refresh_token
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authUrl: authUrl.toString() });
}
