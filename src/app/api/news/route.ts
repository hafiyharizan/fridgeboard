// GET /api/news — latest headlines for the Home news card.
// RSS feeds don't allow browser (CORS) requests, so the server reads them.
// Only the configured feeds are fetched (NEWS_FEEDS or the ABC defaults),
// never a URL from the request, so this can't proxy arbitrary URLs.
// Redirects are followed by hand and must stay on https; bodies are capped
// while downloading. Results are cached 15 minutes per server instance,
// and concurrent requests share one refresh.
import { mergeNews, newsFeedsFromEnv, parseFeed, type NewsItem } from "@/lib/news";

export const dynamic = "force-dynamic";

const CACHE_MS = 15 * 60_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
let cache: { at: number; items: NewsItem[] } | null = null;
let refreshing: Promise<NewsItem[]> | null = null;

/** Reads at most MAX_BYTES of the body, then stops downloading. */
async function readCapped(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES) throw new Error("Feed too large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readFeed(url: string, source: string): Promise<NewsItem[]> {
  try {
    const signal = AbortSignal.timeout(8_000);
    let target = new URL(url);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (target.protocol !== "https:" || target.username || target.password) return [];
      const response = await fetch(target, {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5",
          "User-Agent": "Fridgeboard/1.0 (household news)",
        },
        signal,
        redirect: "manual",
        cache: "no-store",
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) return [];
        target = new URL(location, target);
        continue;
      }
      if (!response.ok) return [];
      return parseFeed(await readCapped(response), source);
    }
    return [];
  } catch {
    return [];
  }
}

async function refresh(): Promise<NewsItem[]> {
  const feeds = newsFeedsFromEnv(process.env.NEWS_FEEDS);
  const groups = await Promise.all(feeds.map((feed) => readFeed(feed.url, feed.source)));
  const items = mergeNews(groups, 12);
  if (items.length) cache = { at: Date.now(), items };
  return items;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return json({ items: cache.items, updatedAt: new Date(cache.at).toISOString() });
  }
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  const items = await refreshing;
  if (items.length) return json({ items, updatedAt: new Date().toISOString() });
  // Feeds unreachable right now: keep serving the last good headlines.
  if (cache) return json({ items: cache.items, updatedAt: new Date(cache.at).toISOString(), stale: true });
  return json({ items: [], updatedAt: new Date().toISOString() }, 502);
}
