"use client";

import type { Item } from "@/lib/types";

type ItemRowProps = {
  busy: boolean;
  item: Item;
  onDelete: (itemId: string) => Promise<void>;
  onToggle: (item: Item) => Promise<void>;
};

export function ItemRow({ busy, item, onDelete, onToggle }: ItemRowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[1.4rem] border border-border bg-white/85 px-4 py-3 shadow-[0_10px_24px_rgba(95,65,36,0.06)] transition ${
        item.is_checked ? "opacity-70" : ""
      }`}
    >
      <button
        aria-label={item.is_checked ? `Uncheck ${item.text}` : `Check ${item.text}`}
        className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
          item.is_checked
            ? "border-success bg-success text-white"
            : "border-muted/35 bg-white text-transparent hover:border-amber-deep"
        }`}
        disabled={busy}
        onClick={() => onToggle(item)}
        type="button"
      >
        ✓
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-base leading-6 text-foreground transition sm:text-[1.05rem] ${
            item.is_checked ? "line-through text-muted" : ""
          }`}
        >
          {item.text}
        </p>
      </div>

      <button
        aria-label={`Delete ${item.text}`}
        className="rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-muted transition hover:bg-danger/10 hover:text-danger"
        disabled={busy}
        onClick={() => onDelete(item.id)}
        type="button"
      >
        Delete
      </button>
    </div>
  );
}
