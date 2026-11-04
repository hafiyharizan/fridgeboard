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
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 600, damping: 42 }}
      className={`item-row${item.is_checked ? " is-checked" : ""}`}
    >
      <button
        aria-label={item.is_checked ? `Uncheck ${item.text}` : `Check ${item.text}`}
        aria-pressed={item.is_checked}
        className="check"
        disabled={busy}
        onClick={() => onToggle(item)}
        type="button"
      >
        <span className="check-box">
          <Check size={13} strokeWidth={3} />
        </span>
      </button>
      <span className="item-text">{item.text}</span>
      <button
        aria-label={`Delete ${item.text}`}
        className="icon-btn icon-btn-danger item-delete"
        disabled={busy}
        onClick={() => onDelete(item.id)}
        type="button"
      >
        <Trash2 size={16} />
      </button>
    </motion.li>
  );
}
