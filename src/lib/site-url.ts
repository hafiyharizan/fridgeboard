const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DEFAULT_SITE_URL = "https://fridgeboard.netlify.app";

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

// Vercel sets the production domain (no scheme) on every build, and exposes
// the NEXT_PUBLIC_ copy to the browser bundle for Next.js projects.
function vercelProductionUrl() {
  const host =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : undefined;
}

export function getCanonicalSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    vercelProductionUrl();

  return trimTrailingSlash(configuredUrl || DEFAULT_SITE_URL);
}

export function resolveAppOrigin(origin?: string) {
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (LOCAL_HOSTS.has(parsed.hostname)) {
        return trimTrailingSlash(origin);
      }
    } catch {
      // Fall back to the canonical site URL below.
    }
  }

  return getCanonicalSiteUrl();
}

export function buildAppUrl(path: string, origin?: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveAppOrigin(origin)}${normalizedPath}`;
}
