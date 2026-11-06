const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
// Set NEXT_PUBLIC_SITE_URL in Vercel; this is only a last resort.
const DEFAULT_SITE_URL = "https://fridgeboard.vercel.app";

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function getCanonicalSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

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
