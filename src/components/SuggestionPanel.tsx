"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { smartSuggest } from "@/lib/suggestions";

type SuggestionPanelProps = {
  listName: string;
  existingItems: string[];
  onAddItem: (text: string) => Promise<void>;
};

export function SuggestionPanel({
  listName,
  existingItems,
  onAddItem,
}: SuggestionPanelProps) {
  const suggestions = useMemo(
    () => smartSuggest(listName, existingItems, 5),
    [listName, existingItems],
  );

  if (!suggestions.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
        You might need
      </p>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {suggestions.map((text, i) => (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 py-1.5 pl-3 pr-2.5 text-sm font-medium text-foreground shadow-[0_1px_0_rgba(200,135,26,0.12)] transition-all duration-200 hover:border-amber-deep/50 hover:bg-amber/20 hover:shadow-[0_10px_24px_rgba(200,135,26,0.14)] focus:outline-none focus:ring-2 focus:ring-amber/50"
              key={text}
              onClick={() => onAddItem(text)}
              title={`Add "${text}"`}
              type="button"
            >
              <Plus className="h-3 w-3 text-amber-deep" strokeWidth={3} />
              {text}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
