"use client";

import { useId, useMemo } from "react";
import { Plus } from "lucide-react";
import { smartSuggest } from "@/lib/suggestions";

type SuggestionPanelProps = {
  listName: string;
  existingItems: string[];
  onAddItem: (text: string) => Promise<boolean>;
};

export function SuggestionPanel({ listName, existingItems, onAddItem }: SuggestionPanelProps) {
  const labelId = useId();
  const suggestions = useMemo(
    () => smartSuggest(listName, existingItems, 5),
    [listName, existingItems],
  );

  if (!suggestions.length) return null;

  return (
    <div className="suggestions">
      <span className="suggestions-label" id={labelId}>
        Suggestions
      </span>
      <div className="suggestions-chips" role="group" aria-labelledby={labelId}>
        {suggestions.map((text) => (
          <button
            className="chip"
            key={text}
            onClick={() => onAddItem(text)}
            aria-label={`Add ${text}`}
            type="button"
          >
            <Plus size={13} strokeWidth={2.4} />
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
