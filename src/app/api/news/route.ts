// GET /api/news — latest headlines for the Home news card.
// RSS feeds don't allow browser (CORS) requests, so the server reads them.
// Only the configured feeds are fetched (NEWS_FEEDS or the ABC defaults),
// so this can't be used to proxy arbitrary URLs. Results are cached for
// 15 minutes per server instance and by Next's fetch cache.
import { mergeNews, newsFeedsFromEnv, parseFeed, type NewsItem } from "@/lib/news";

export const dynamic = "force-dynamic";

const CACHE_MS = 15 * 60_000;
const MAX_BYTES = 2_000_000;
let cache: { at: number; items: NewsItem[] } | null = null;

async function readFeed(url: string, source: string): Promise<NewsItem[]> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5", "User-Agent": "Fridgeboard/1.0 (household news)" },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
      next: { revalidate: 900 },
    });
    if (!response.ok) return [];
    const xml = (await response.text()).slice(0, MAX_BYTES);
    return parseFeed(xml, source);
  } catch {
    return [];
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return Response.json({ items: cache.items, updatedAt: new Date(cache.at).toISOString() }, { headers: { "Cache-Control": "no-store" } });
  }
  const feeds = newsFeedsFromEnv(process.env.NEWS_FEEDS);
  const groups = await Promise.all(feeds.map((feed) => readFeed(feed.url, feed.source)));
  const items = mergeNews(groups, 12);
  if (items.length) cache = { at: Date.now(), items };
  else if (cache) {
    // Feeds unreachable right now: keep serving the last good headlines.
    return Response.json({ items: cache.items, updatedAt: new Date(cache.at).toISOString(), stale: true }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(
    { items, updatedAt: new Date().toISOString() },
    { status: items.length ? 200 : 502, headers: { "Cache-Control": "no-store" } },
  );
}
