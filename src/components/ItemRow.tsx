import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import type { Item } from "@/lib/types";

type ItemRowProps = {
  busy: boolean;
  item: Item;
  onDelete: (itemId: string) => Promise<void>;
  onToggle: (item: Item) => Promise<void>;
};

export function ItemRow({ busy, item, onDelete, onToggle }: ItemRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`group flex items-center gap-3 rounded-[1.4rem] border border-border bg-white/85 px-4 py-3 shadow-[0_10px_24px_rgba(95,65,36,0.06)] transition ${
        item.is_checked ? "opacity-70" : ""
      }`}
    >
      <button
        aria-label={item.is_checked ? `Uncheck ${item.text}` : `Check ${item.text}`}
        className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
          item.is_checked
            ? "border-success bg-success text-white"
            : "border-muted/35 bg-transparent text-transparent hover:border-amber-deep"
        }`}
        disabled={busy}
        onClick={() => onToggle(item)}
        type="button"
      >
        {item.is_checked ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-base leading-6 text-foreground transition sm:text-[1.05rem] ${
            item.is_checked ? "line-through text-muted/60" : ""
          }`}
        >
          {item.text}
        </p>
      </div>

      <button
        aria-label={`Delete ${item.text}`}
        className="rounded-full p-2 text-muted/40 transition hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        disabled={busy}
        onClick={() => onDelete(item.id)}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
