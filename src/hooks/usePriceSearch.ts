"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PriceResult } from "@/lib/types";

/** Simple in-memory cache keyed by lowercase item text. */
const priceCache = new Map<string, { results: PriceResult[]; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedResults(key: string): PriceResult[] | null {
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.results;
  }
  return null;
}

type FetchResult = {
  key: string;
  results: PriceResult[];
};

/**
 * Fetch and cache price results for a grocery item.
 *
 * - Only fetches for non-empty, unchecked items.
 * - Uses an in-memory cache to avoid repeated API calls for the same item.
 * - Returns { loading, results, cheapest } where cheapest is the first result (lowest price).
 */
export function usePriceSearch(
  itemText: string,
  enabled: boolean,
) {
  const key = itemText.trim().toLowerCase();
  const shouldFetch = enabled && key.length > 0;

  // Check cache synchronously — no effect or setState needed
  const cached = useMemo(
    () => (shouldFetch ? getCachedResults(key) : null),
    [shouldFetch, key],
  );

  // Stores the result of the last completed fetch
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Only run the effect when we actually need to fetch (not cached)
  const needsFetch = shouldFetch && cached === null;

  useEffect(() => {
    if (!needsFetch) return;

    // Abort previous request if still running
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // No synchronous setState here — loading is derived below

    fetch(`/api/price-search?q=${encodeURIComponent(key)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as { results: PriceResult[] };
        if (!controller.signal.aborted) {
          const fetched = data.results ?? [];
          priceCache.set(key, { results: fetched, ts: Date.now() });
          setFetchResult({ key, results: fetched });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFetchResult({ key, results: [] });
        }
      });

    return () => {
      controller.abort();
    };
  }, [key, needsFetch]);

  // Derive final values without any synchronous setState
  const results = useMemo(() => {
    if (!shouldFetch) return [];
    if (cached) return cached;
    if (fetchResult && fetchResult.key === key) return fetchResult.results;
    return [];
  }, [shouldFetch, cached, fetchResult, key]);

  // Loading = we need a fetch, have no cache, and no completed fetch for this key
  const loading = needsFetch && (!fetchResult || fetchResult.key !== key);
  const cheapest = results.length > 0 ? results[0] : null;

  return { loading, results, cheapest };
}

