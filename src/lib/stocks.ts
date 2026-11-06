// Market numbers for the Home news card. /api/stocks reads Yahoo Finance's
// public chart endpoint on the server (no key, no CORS) for a fixed list of
// symbols (STOCK_SYMBOLS or the defaults), never a symbol from the client.

export type StockSymbol = { symbol: string; label: string };

export type StockQuote = {
  symbol: string;
  label: string;
  price: number;
  /** Change since the previous close (null if unknown). */
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  /** ISO time of the price. */
  at: string | null;
};

/** SPUS, the ASX 200, and the Aussie dollar and ringgit pairs. */
export const DEFAULT_STOCKS: StockSymbol[] = [
  { symbol: "SPUS", label: "SPUS" },
  { symbol: "^AXJO", label: "ASX 200" },
  { symbol: "AUDMYR=X", label: "AUD/MYR" },
  { symbol: "MYRUSD=X", label: "MYR/USD" },
];

const SYMBOL = /^[A-Za-z0-9^=.\-]{1,15}$/;

/**
 * STOCK_SYMBOLS overrides the defaults: comma-separated `SYMBOL` or
 * `Label|SYMBOL` entries in Yahoo Finance form (e.g. `BHP|BHP.AX`), max 4.
 */
export function stocksFromEnv(value: string | undefined): StockSymbol[] {
  if (!value?.trim()) return DEFAULT_STOCKS;
  const stocks = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry): StockSymbol[] => {
      const [label, raw] = entry.includes("|") ? entry.split("|", 2) : ["", entry];
      const symbol = raw.trim();
      if (!SYMBOL.test(symbol)) return [];
      return [{ symbol, label: label.trim().slice(0, 20) || symbol.replace(/^\^/, "") }];
    });
  return stocks.length ? stocks.slice(0, 4) : DEFAULT_STOCKS;
}

export const stockUrl = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Reads the price and day change from a Yahoo chart response. */
export function parseChart(json: unknown, stock: StockSymbol): StockQuote | null {
  if (typeof json !== "object" || json === null) return null;
  const chart = (json as { chart?: { result?: unknown } }).chart;
  const result = Array.isArray(chart?.result) ? chart.result[0] : null;
  const meta = typeof result === "object" && result !== null ? (result as { meta?: Record<string, unknown> }).meta : null;
  if (!meta) return null;
  const price = num(meta.regularMarketPrice);
  if (price === null) return null;
  const previous = num(meta.chartPreviousClose) ?? num(meta.previousClose);
  const change = previous === null ? null : price - previous;
  const time = num(meta.regularMarketTime);
  return {
    symbol: stock.symbol,
    label: stock.label,
    price,
    change,
    changePercent: change === null || !previous ? null : (change / previous) * 100,
    currency: typeof meta.currency === "string" ? meta.currency.slice(0, 5) : null,
    at: time === null ? null : new Date(time * 1000).toISOString(),
  };
}

/** "8,812.4" for indexes and shares, "0.6612" for currency pairs. */
export function formatPrice(quote: Pick<StockQuote, "symbol" | "price">): string {
  const digits = quote.symbol.endsWith("=X") ? 4 : quote.price >= 1000 ? 1 : 2;
  return quote.price.toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Currency to print beside a price ("USD" for a US-listed fund). Currency pairs
 * (`=X`) already say what they are, and an index (`^`) is points, so neither gets one.
 */
export function priceCurrency(quote: Pick<StockQuote, "symbol" | "currency">): string | null {
  return quote.symbol.endsWith("=X") || quote.symbol.startsWith("^") || !quote.currency ? null : quote.currency;
}

/** "+0.6%", "−1.2%" (or "" when unknown). */
export function formatChange(quote: Pick<StockQuote, "changePercent">): string {
  const pct = quote.changePercent;
  if (pct === null) return "";
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}
