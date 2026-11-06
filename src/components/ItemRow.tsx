import { motion } from "framer-motion";
import { Check, Repeat, Trash2 } from "lucide-react";
import { MemberTag } from "@/components/MemberTag";
import type { Item } from "@/lib/types";

type ItemRowProps = {
  busy: boolean;
  item: Item;
  onDelete: (itemId: string) => Promise<boolean>;
  onToggle: (item: Item) => Promise<boolean>;
  /** To-Do only: keep it as a routine that tracks when it was last done. */
  onMakeRoutine?: (item: Item) => Promise<boolean>;
};

export function ItemRow({ busy, item, onDelete, onToggle, onMakeRoutine }: ItemRowProps) {
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

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
        <p
          className={`text-[1.0625rem] font-semibold leading-6 ${
            item.is_checked ? "text-muted line-through" : "text-foreground"
          }`}
        >
          {item.text}
        </p>
        <MemberTag userId={item.added_by ?? item.created_by} label="Added by" />
      </div>

      {onMakeRoutine && (
        <button
          aria-label={`Track ${item.text} as a routine`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted hover:bg-success/10 hover:text-foreground"
          disabled={busy}
          onClick={() => onMakeRoutine(item)}
          title="Track when it was last done"
          type="button"
        >
          <Repeat className="h-[18px] w-[18px]" />
        </button>
      )}

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
