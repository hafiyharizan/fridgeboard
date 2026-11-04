import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import type { Item } from "@/lib/types";

type ItemRowProps = {
  busy: boolean;
  item: Item;
  onDelete: (itemId: string) => Promise<boolean>;
  onToggle: (item: Item) => Promise<boolean>;
};

export function ItemRow({ busy, item, onDelete, onToggle }: ItemRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`list-row ${item.is_checked ? "is-tinted opacity-70" : ""}`}
    >
      <button
        aria-label={item.is_checked ? `Uncheck ${item.text}` : `Check ${item.text}`}
        className="check-control"
        disabled={busy}
        onClick={() => onToggle(item)}
        type="button"
      >
        <span className={`check-ring${item.is_checked ? " is-checked" : ""}`}>
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[1.0625rem] font-semibold leading-6 ${
            item.is_checked ? "text-muted line-through" : "text-foreground"
          }`}
        >
          {item.text}
        </p>
      </div>

      <button
        aria-label={`Delete ${item.text}`}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
        disabled={busy}
        onClick={() => onDelete(item.id)}
        type="button"
      >
        <Trash2 className="h-[18px] w-[18px]" />
      </button>
    </motion.div>
  );
}
