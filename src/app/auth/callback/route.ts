import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createSupabaseRouteClient(cookieStore);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session?.user) {
      const user = data.session.user;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("pin_code")
        .eq("user_id", user.id)
        .single();

      if (profile?.pin_code) {
        return NextResponse.redirect(`${origin}/list`);
      }

      return NextResponse.redirect(`${origin}/setup-pin`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
