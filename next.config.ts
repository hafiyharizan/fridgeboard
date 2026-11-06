import type { NextConfig } from "next";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error(
    "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
  );
}
// Catch a pasted value with quotes, spaces or no https:// here, with a clear
// message, rather than as "Invalid supabaseUrl" while prerendering pages.
{
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let valid = false;
  try {
    const parsed = new URL(url);
    valid = (parsed.protocol === "https:" || parsed.protocol === "http:") && url.trim() === url;
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be the plain project URL, like " +
        "https://abcdefgh.supabase.co (no quotes or spaces, starting with https://). " +
        `It is set to ${url.length} characters starting with "${url.slice(0, 8)}".`,
    );
  }
}
if (
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
) {
  throw new Error(
    "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "(or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)",
  );
}

// Stamped into both server and browser code, so a long-running kitchen tablet
// can tell when a newer deploy is live. Vercel sets these at build time.
const appVersion =
  process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { APP_VERSION: appVersion },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  images: {
    qualities: [75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
