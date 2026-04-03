import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Only refresh auth session if Supabase auth cookies are present.
  // PIN-only users have no auth cookies, so skip the network call for them.
  const hasAuthCookies = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (hasAuthCookies) {
    const supabase = createSupabaseMiddlewareClient(request, response);
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
