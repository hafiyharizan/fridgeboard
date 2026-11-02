/**
 * Webhook URLs are user-supplied and the server POSTs to them, so only allow
 * public HTTPS hosts. Blocks localhost, private/link-local IP literals (which
 * include cloud metadata at 169.254.169.254) and credentials in the URL.
 * This doesn't stop a public hostname that resolves to a private IP, but on
 * serverless hosting there is no private network worth reaching that way.
 */
export function isAllowedWebhookUrl(raw: string): boolean {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return false;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      return false;
    }
  }

  if (host.includes(":")) {
    // IPv6 literal: block loopback, unspecified, unique-local, link-local and IPv4-mapped.
    if (host === "::1" || host === "::" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith("::ffff:")) {
      return false;
    }
  }

  return true;
}
