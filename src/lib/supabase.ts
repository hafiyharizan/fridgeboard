import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "in your Vercel project settings (Settings → Environment Variables) " +
        "then redeploy.",
    );
  }

  return { url, key };
}

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, key } = getSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, key);

  return browserClient;
}

/**
 * Creates a Supabase client for use in middleware.
 * Accepts the NextRequest/NextResponse so it can read and write cookies.
 */
export function createSupabaseMiddlewareClient(
  request: { cookies: { getAll(): Array<{ name: string; value: string }> } },
  response: {
    cookies: {
      set(name: string, value: string, options?: Record<string, unknown>): void;
    };
  },
) {
  const { url, key } = getSupabaseEnv();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
}

/**
 * Creates a Supabase client for use in route handlers.
 * Accepts a cookies() store from next/headers.
 */
export function createSupabaseRouteClient(
  cookieStore: {
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: Record<string, unknown>): void;
  },
) {
  const { url, key } = getSupabaseEnv();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/** Service-role client for use in API route handlers only (never in browser code). */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient<Database>(url, key);
}
