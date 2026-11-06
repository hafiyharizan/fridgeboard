import { describe, expect, it } from "vitest";
import { DEFAULT_STOCKS, formatChange, formatPrice, parseChart, priceCurrency, stocksFromEnv, stockUrl } from "@/lib/stocks";

const chart = (meta: Record<string, unknown>) => ({ chart: { result: [{ meta }], error: null } });

describe("defaults", () => {
  it("are SPUS, ASX 200, AUD/MYR and MYR/USD in order", () => {
    expect(DEFAULT_STOCKS).toEqual([
      { symbol: "SPUS", label: "SPUS" },
      { symbol: "^AXJO", label: "ASX 200" },
      { symbol: "AUDMYR=X", label: "AUD/MYR" },
      { symbol: "MYRUSD=X", label: "MYR/USD" },
    ]);
    expect(DEFAULT_STOCKS.length).toBeLessThanOrEqual(4);
  });
  it("formats the default prices", () => {
    expect(formatPrice({ symbol: "MYRUSD=X", price: 0.2381 })).toBe("0.2381");
    expect(formatPrice({ symbol: "AUDMYR=X", price: 2.8 })).toBe("2.8000");
    expect(formatPrice({ symbol: "SPUS", price: 49.5 })).toBe("49.50");
  });
});

describe("stocksFromEnv", () => {
  it("uses the defaults when unset or invalid", () => {
    expect(stocksFromEnv(undefined)).toBe(DEFAULT_STOCKS);
    expect(stocksFromEnv(" , <script>")).toBe(DEFAULT_STOCKS);
  });
  it("reads labelled symbols, max four", () => {
    expect(stocksFromEnv("BHP|BHP.AX, ^GSPC, bad symbol!, A, B, C")).toEqual([
      { symbol: "BHP.AX", label: "BHP" },
      { symbol: "^GSPC", label: "GSPC" },
      { symbol: "A", label: "A" },
      { symbol: "B", label: "B" },
    ]);
  });
  it("encodes symbols into the URL", () => {
    expect(stockUrl("^AXJO")).toContain("/chart/%5EAXJO?");
  });
});

describe("parseChart", () => {
  const asx = DEFAULT_STOCKS[1];
  it("reads price and change from the previous close", () => {
    const quote = parseChart(
      chart({ regularMarketPrice: 8800, chartPreviousClose: 8750, currency: "AUD", regularMarketTime: 1_762_400_000 }),
      asx,
    );
    expect(quote).toMatchObject({ symbol: "^AXJO", label: "ASX 200", price: 8800, change: 50, currency: "AUD" });
    expect(quote?.changePercent).toBeCloseTo(0.5714, 3);
    expect(quote?.at).toBe(new Date(1_762_400_000_000).toISOString());
  });
  it("falls back to previousClose and copes without one", () => {
    expect(parseChart(chart({ regularMarketPrice: 10, previousClose: 8 }), asx)?.change).toBe(2);
    expect(parseChart(chart({ regularMarketPrice: 10 }), asx)).toMatchObject({ change: null, changePercent: null });
  });
  it("rejects malformed responses", () => {
    expect(parseChart(null, asx)).toBeNull();
    expect(parseChart({ chart: { result: null } }, asx)).toBeNull();
    expect(parseChart(chart({ regularMarketPrice: "8800" }), asx)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats prices by kind", () => {
    expect(formatPrice({ symbol: "^AXJO", price: 8812.44 })).toBe("8,812.4");
    expect(formatPrice({ symbol: "AUDUSD=X", price: 0.66123 })).toBe("0.6612");
    expect(formatPrice({ symbol: "BHP.AX", price: 41.5 })).toBe("41.50");
  });
  it("formats changes with a sign", () => {
    expect(formatChange({ changePercent: 0.61 })).toBe("+0.6%");
    expect(formatChange({ changePercent: -1.24 })).toBe("−1.2%");
    expect(formatChange({ changePercent: 0.01 })).toBe("0.0%");
    expect(formatChange({ changePercent: null })).toBe("");
  });
});

describe("priceCurrency", () => {
  it("shows the currency of a share", () => expect(priceCurrency({ symbol: "SPUS", currency: "USD" })).toBe("USD"));
  it("none for an index", () => expect(priceCurrency({ symbol: "^AXJO", currency: "AUD" })).toBeNull());
  it("none for a currency pair", () => expect(priceCurrency({ symbol: "AUDMYR=X", currency: "MYR" })).toBeNull());
  it("none when the currency is unknown", () => expect(priceCurrency({ symbol: "SPUS", currency: null })).toBeNull());
});
