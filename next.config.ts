import type { NextConfig } from "next";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
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

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
