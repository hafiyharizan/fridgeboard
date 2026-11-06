import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Repeat, Trash2 } from "lucide-react";
import { MemberTag } from "@/components/MemberTag";
import {
  daysOverdue,
  daysSince,
  lastDoneLabel,
  REPEAT_CHOICES,
  repeatLabel,
  routineState,
} from "@/lib/routine";
import type { Item } from "@/lib/types";

const UNDO_MS = 10_000;
const ONE_OFF = "one-off";

type RoutineRowProps = {
  busy: boolean;
  item: Item;
  now: Date;
  onDone: (item: Item) => Promise<boolean>;
  onRestore: (item: Item, previous: { at: string | null; by: string | null }) => Promise<boolean>;
  onSchedule: (item: Item, routine: { repeatDays: number | null } | null) => Promise<boolean>;
  onDelete: (itemId: string) => Promise<boolean>;
};

/** A routine: "Change bed sheets · 9 days ago · Every week". Tap the ring when it's done again. */
export function RoutineRow({
  busy,
  item,
  now,
  onDone,
  onRestore,
  onSchedule,
  onDelete,
}: RoutineRowProps) {
  const [undo, setUndo] = useState<{ at: string | null; by: string | null } | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const days = daysSince(item.last_done_at, now);
  const state = routineState(item, now);
  const doneToday = days === 0;
  const late = daysOverdue(item, now);
  const every = repeatLabel(item.repeat_days);

  const markDone = async () => {
    const previous = { at: item.last_done_at ?? null, by: item.last_done_by ?? null };
    if (await onDone(item)) setUndo(previous);
  };

  const presets = REPEAT_CHOICES.some((choice) => choice.days === (item.repeat_days ?? null));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`list-row${state === "overdue" ? " is-overdue" : ""}`}
    >
      <button
        aria-label={`Done ${item.text} today`}
        className="check-control"
        disabled={busy}
        onClick={() => void markDone()}
        type="button"
      >
        <span className={`check-ring${doneToday ? " is-checked" : ""}`}>
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1 py-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="text-[1.0625rem] font-semibold leading-6 text-foreground">{item.text}</p>
          {state === "overdue" && (
            <span className="pill pill-rose">
              {late === 1 ? "1 day overdue" : `${late} days overdue`}
            </span>
          )}
          {state === "due" && <span className="pill pill-amber">Due</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>
            <span className="sr-only">Last done </span>
            <span className="font-bold text-foreground">{lastDoneLabel(days)}</span>
          </span>
          {item.last_done_at && (
            <MemberTag userId={item.last_done_by} label="Done by" />
          )}
          <span aria-hidden>·</span>
          <label className="inline-flex items-center gap-1">
            <Repeat className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">How often</span>
            <select
              className="min-h-8 cursor-pointer rounded-full bg-transparent pr-1 text-sm font-semibold text-muted hover:text-foreground"
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value;
                void onSchedule(
                  item,
                  value === ONE_OFF ? null : { repeatDays: value ? Number(value) : null },
                );
              }}
              value={item.repeat_days ?? ""}
            >
              {!presets && item.repeat_days && (
                <option value={item.repeat_days}>{every}</option>
              )}
              {REPEAT_CHOICES.map((choice) => (
                <option key={choice.label} value={choice.days ?? ""}>
                  {choice.label}
                </option>
              ))}
              <option value={ONE_OFF}>Make it a one-off to-do</option>
            </select>
          </label>
          {undo && (
            <button
              className="min-h-8 cursor-pointer rounded-full px-2 font-bold text-foreground underline underline-offset-2"
              disabled={busy}
              onClick={() => {
                const previous = undo;
                setUndo(null);
                void onRestore(item, previous);
              }}
              type="button"
            >
              Undo
            </button>
          )}
        </div>
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
