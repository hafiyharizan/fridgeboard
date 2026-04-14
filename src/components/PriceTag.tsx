"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, ShoppingCart, Tag } from "lucide-react";
import { usePriceSearch } from "@/hooks/usePriceSearch";

type PriceTagProps = {
  itemText: string;
  isChecked: boolean;
};

export function PriceTag({ itemText, isChecked }: PriceTagProps) {
  const [expanded, setExpanded] = useState(false);
  const { loading, results, cheapest } = usePriceSearch(
    itemText,
    !isChecked,
  );

  // Don't render anything for checked items or when no results
  if (isChecked) return null;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-1.5 flex items-center gap-1.5"
      >
        <Tag className="h-3 w-3 text-muted/40" />
        <div className="h-3 w-20 animate-pulse rounded-full bg-muted/15" />
      </motion.div>
    );
  }

  if (!cheapest) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mt-1.5"
    >
      {/* Cheapest price summary — always visible */}
      <div className="flex items-center gap-1.5">
        <Tag className="h-3 w-3 text-success" />
        <a
          className="group/price inline-flex items-center gap-1 text-xs font-medium text-success transition hover:text-success/80"
          href={cheapest.url}
          rel="noopener noreferrer"
          target="_blank"
          title={`View on ${cheapest.source}`}
        >
          <span className="font-bold">{cheapest.price}</span>
          <span className="text-muted/60">at {cheapest.source}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-0 transition group-hover/price:opacity-100" />
        </a>

        {results.length > 1 ? (
          <button
            className="ml-1 inline-flex cursor-pointer items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted/50 transition hover:bg-muted/8 hover:text-muted/80"
            onClick={() => setExpanded((prev) => !prev)}
            type="button"
          >
            {expanded ? (
              <>
                Less <ChevronUp className="h-2.5 w-2.5" />
              </>
            ) : (
              <>
                {results.length - 1} more <ChevronDown className="h-2.5 w-2.5" />
              </>
            )}
          </button>
        ) : null}
      </div>

      {/* Expanded price list */}
      <AnimatePresence>
        {expanded && results.length > 1 ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 overflow-hidden rounded-xl border border-border/50 bg-white/60"
          >
            {results.slice(1).map((result, i) => (
              <a
                className="flex items-center gap-2 border-b border-border/30 px-3 py-2 text-xs transition last:border-b-0 hover:bg-amber/5"
                href={result.url}
                key={`${result.url}-${i}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ShoppingCart className="h-3 w-3 shrink-0 text-muted/40" />
                <span className="min-w-0 flex-1 truncate text-muted">
                  {result.title}
                </span>
                <span className="shrink-0 font-bold text-foreground">
                  {result.price}
                </span>
                <span className="shrink-0 text-muted/50">{result.source}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted/30" />
              </a>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
