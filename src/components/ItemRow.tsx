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
      className={`group flex items-center gap-3 rounded-2xl bg-[#f4f8f4] px-4 py-2.5 transition hover:bg-[#eaf1ea] ${
        item.is_checked ? "opacity-70" : ""
      }`}
    >
      <button
        aria-label={item.is_checked ? `Uncheck ${item.text}` : `Check ${item.text}`}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
          item.is_checked
            ? "border-[#7fa886] bg-[#7fa886] text-white"
            : "border-2 border-[#b6c4b9] bg-white text-transparent hover:border-primary hover:text-primary/50"
        }`}
        disabled={busy}
        onClick={() => onToggle(item)}
        type="button"
      >
        <Check className="h-4 w-4" strokeWidth={3} />
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
        disabled={busy}
        onClick={() => onDelete(item.id)}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
