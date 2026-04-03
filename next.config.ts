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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
