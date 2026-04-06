import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasAuthCookies = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  if (pathname.startsWith("/setup-household") || pathname.startsWith("/list")) {
    if (!hasAuthCookies) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  const response = NextResponse.next({ request });

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
