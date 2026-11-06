// GET /api/stocks — market numbers for the Home news card (ASX 200 and
// AUD/USD by default). Only the configured symbols are fetched, from one
// fixed host, with no redirects and a small body cap. Cached 5 minutes per
// server instance; concurrent requests share one refresh, and the last good
// numbers are served if the source is down.
import { parseChart, stocksFromEnv, stockUrl, type StockQuote, type StockSymbol } from "@/lib/stocks";

export const dynamic = "force-dynamic";

const CACHE_MS = 5 * 60_000;
const MAX_BYTES = 200_000;
let cache: { at: number; quotes: StockQuote[] } | null = null;
let refreshing: Promise<StockQuote[]> | null = null;

async function readQuote(stock: StockSymbol): Promise<StockQuote | null> {
  try {
    const response = await fetch(stockUrl(stock.symbol), {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Fridgeboard household display)" },
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_BYTES) {
      await response.body?.cancel();
      return null;
    }
    const text = await response.text();
    if (text.length > MAX_BYTES) return null;
    return parseChart(JSON.parse(text), stock);
  } catch {
    return null;
  }
}

async function refresh(): Promise<StockQuote[]> {
  const stocks = stocksFromEnv(process.env.STOCK_SYMBOLS);
  const quotes = (await Promise.all(stocks.map(readQuote))).filter((quote): quote is StockQuote => quote !== null);
  if (quotes.length) cache = { at: Date.now(), quotes };
  return quotes;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return json({ quotes: cache.quotes, updatedAt: new Date(cache.at).toISOString() });
  }
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  const quotes = await refreshing;
  if (quotes.length) return json({ quotes, updatedAt: new Date().toISOString() });
  if (cache) return json({ quotes: cache.quotes, updatedAt: new Date(cache.at).toISOString(), stale: true });
  return json({ quotes: [], updatedAt: new Date().toISOString() }, 502);
}
