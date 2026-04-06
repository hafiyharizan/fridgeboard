"use client";

import { motion } from "framer-motion";
import { Bell, Clock, Plus, Repeat, X } from "lucide-react";
import { EVENT_TYPE_ICONS, formatEventTime, NOTIFY_BEFORE_OPTIONS, RECURRENCE_LABELS } from "@/lib/calendar";
import type { ExpandedCalendarEvent, StickyColor } from "@/lib/types";

const STICKY_LEFT: Record<StickyColor, string> = {
  amber: "bg-amber",
  blue: "bg-blue",
  rose: "bg-danger",
  green: "bg-success",
  purple: "bg-[#c4b5fd]",
};

const STICKY_ROW: Record<StickyColor, string> = {
  amber: "bg-amber/8 border-amber/20",
  blue: "bg-blue/6 border-blue/18",
  rose: "bg-danger/6 border-danger/15",
  green: "bg-success/6 border-success/18",
  purple: "bg-[#c4b5fd]/10 border-[#c4b5fd]/25",
};


type DayDetailSheetProps = {
  dateKey: string;
  events: ExpandedCalendarEvent[];
  onClose: () => void;
  onAddEvent: () => void;
  onSelectEvent: (event: ExpandedCalendarEvent) => void;
};

export function DayDetailSheet({
  dateKey,
  events,
  onClose,
  onAddEvent,
  onSelectEvent,
}: DayDetailSheetProps) {
  const displayDate = new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Sort by time (timed events first, then untimed alphabetically)
  const sorted = [...events].sort((a, b) => {
    if (a.event_time && b.event_time) return a.event_time.localeCompare(b.event_time);
    if (a.event_time) return -1;
    if (b.event_time) return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="flex max-h-[70vh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-white/60 bg-white/95 shadow-[0_-8px_40px_rgba(60,40,20,0.12)] backdrop-blur-xl sm:max-w-md sm:rounded-[1.5rem] sm:shadow-[0_24px_64px_rgba(60,40,20,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted">
              {sorted.length} {sorted.length === 1 ? "note" : "notes"}
            </p>
            <p className="text-sm font-bold text-foreground">{displayDate}</p>
          </div>
          <button
            className="rounded-full p-1.5 text-muted transition hover:bg-foreground/5 hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nothing on this day yet.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((event) => {
                const notifyLabel =
                  event.notify_before >= 0
                    ? NOTIFY_BEFORE_OPTIONS.find((o) => o.value === event.notify_before)?.label
                    : null;

                return (
                  <button
                    className={`group flex w-full items-stretch gap-0 overflow-hidden rounded-xl border text-left transition hover:shadow-sm ${STICKY_ROW[event.color]}`}
                    key={`${event.id}-${event.occurrence_date}`}
                    onClick={() => {
                      onClose();
                      onSelectEvent(event);
                    }}
                    type="button"
                  >
                    {/* Color stripe */}
                    <span className={`w-1 shrink-0 ${STICKY_LEFT[event.color]}`} />

                    <div className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium text-foreground ${event.is_done ? "line-through opacity-50" : ""}`}>
                          <span className="mr-1 text-xs">{EVENT_TYPE_ICONS[event.event_type]}</span>
                          {event.title}
                        </span>
                        {event.event_time ? (
                          <span className="flex shrink-0 items-center gap-1 text-[0.65rem] font-bold text-muted">
                            <Clock className="h-2.5 w-2.5" />
                            {formatEventTime(event.event_time)}
                          </span>
                        ) : null}
                      </div>

                      {event.note ? (
                        <p className="truncate text-xs text-muted">{event.note}</p>
                      ) : null}

                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {event.recurrence !== "none" ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-white/60 px-1.5 py-0.5 text-[0.55rem] font-bold text-muted">
                            <Repeat className="h-2 w-2" />
                            {RECURRENCE_LABELS[event.recurrence]}
                          </span>
                        ) : null}
                        {notifyLabel ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-white/60 px-1.5 py-0.5 text-[0.55rem] font-bold text-muted">
                            <Bell className="h-2 w-2" />
                            {notifyLabel}
                          </span>
                        ) : null}
                        {event.is_done ? (
                          <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[0.55rem] font-bold text-[#4a6e3f]">
                            Done
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#2f241b]"
            onClick={() => {
              onClose();
              onAddEvent();
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add to this day
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
