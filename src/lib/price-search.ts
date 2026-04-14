import type { PriceResult } from "@/lib/types";

/**
 * Parse a price string and return the numeric value, or null if not found.
 * Handles formats like "$3.49", "RM 12.90", "€5,99", "3.49", etc.
 */
export function extractPrice(text: string): number | null {
  // Match common price patterns: optional currency symbol/code, digits with optional decimals
  const match = text.match(
    /(?:[$€£¥₹]|RM|MYR|USD|EUR|GBP)?\s*(\d{1,}[.,]\d{1,2})/i,
  );
  if (match?.[1]) {
    return parseFloat(match[1].replace(",", "."));
  }
  // Try plain integer
  const intMatch = text.match(/(?:[$€£¥₹]|RM|MYR|USD|EUR|GBP)?\s*(\d+)/i);
  if (intMatch?.[1]) {
    return parseFloat(intMatch[1]);
  }
  return null;
}

/**
 * Extract the hostname from a URL as a human-friendly source name.
 */
export function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // Capitalise first letter of each segment
    return hostname
      .split(".")[0]
      .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
  } catch {
    return "Store";
  }
}

type GoogleSearchItem = {
  title?: string;
  link?: string;
  snippet?: string;
  pagemap?: {
    offer?: Array<{ price?: string; pricecurrency?: string }>;
    product?: Array<{ name?: string }>;
    cse_image?: Array<{ src?: string }>;
    cse_thumbnail?: Array<{ src?: string }>;
  };
};

type GoogleSearchResponse = {
  items?: GoogleSearchItem[];
};

/**
 * Search for grocery item prices using Google Custom Search API.
 *
 * Required env vars:
 *   GOOGLE_SEARCH_API_KEY  — Google Custom Search JSON API key
 *   GOOGLE_SEARCH_ENGINE_ID — Programmable Search Engine ID (configured for shopping)
 *
 * Returns up to `limit` results sorted by price ascending (cheapest first).
 */
export async function searchPrices(
  query: string,
  limit: number = 5,
): Promise<PriceResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !engineId) {
    return [];
  }

  const searchQuery = `${query} price buy`;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", engineId);
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("num", String(Math.min(limit * 2, 10))); // fetch extra to filter

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as GoogleSearchResponse;

  if (!data.items?.length) {
    return [];
  }

  const results: PriceResult[] = [];

  for (const item of data.items) {
    if (!item.link) continue;

    // Try to extract price from structured data first, then snippet, then title
    let priceValue: number | null = null;
    let priceStr = "";

    // Check pagemap offer data
    const offer = item.pagemap?.offer?.[0];
    if (offer?.price) {
      priceValue = extractPrice(offer.price);
      const currency = offer.pricecurrency ?? "";
      priceStr = currency ? `${currency} ${offer.price}` : offer.price;
    }

    // Fall back to snippet
    if (priceValue === null && item.snippet) {
      priceValue = extractPrice(item.snippet);
      if (priceValue !== null) {
        const priceMatch = item.snippet.match(
          /(?:[$€£¥₹]|RM|MYR|USD|EUR|GBP)?\s*\d{1,}[.,]\d{1,2}/i,
        );
        priceStr = priceMatch?.[0]?.trim() ?? String(priceValue);
      }
    }

    // Fall back to title
    if (priceValue === null && item.title) {
      priceValue = extractPrice(item.title);
      if (priceValue !== null) {
        const priceMatch = item.title.match(
          /(?:[$€£¥₹]|RM|MYR|USD|EUR|GBP)?\s*\d{1,}[.,]\d{1,2}/i,
        );
        priceStr = priceMatch?.[0]?.trim() ?? String(priceValue);
      }
    }

    // Skip results without a detectable price
    if (priceValue === null) continue;

    const thumbnail =
      item.pagemap?.cse_thumbnail?.[0]?.src ??
      item.pagemap?.cse_image?.[0]?.src;

    results.push({
      title: item.title ?? query,
      price: priceStr,
      priceValue,
      source: extractSource(item.link),
      url: item.link,
      thumbnail,
    });
  }

  // Sort by price ascending (cheapest first)
  results.sort((a, b) => a.priceValue - b.priceValue);

  return results.slice(0, limit);
}
