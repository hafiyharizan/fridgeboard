"use client";

import { motion } from "framer-motion";
import { Bell, Check, Repeat, Trash2, X } from "lucide-react";
import { NOTIFY_BEFORE_OPTIONS, RECURRENCE_LABELS } from "@/lib/calendar";
import type { ExpandedCalendarEvent, StickyColor } from "@/lib/types";

const STICKY_BG: Record<StickyColor, string> = {
  amber: "bg-amber/15",
  blue: "bg-blue/12",
  rose: "bg-danger/10",
  green: "bg-success/12",
  purple: "bg-[#c4b5fd]/15",
};

const TYPE_LABELS: Record<string, string> = {
  event: "Event",
  reminder: "Reminder",
  todo: "To-do",
};

type EventDetailProps = {
  event: ExpandedCalendarEvent;
  busy: boolean;
  onClose: () => void;
  onToggle: (event: ExpandedCalendarEvent) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
};

export function EventDetail({ event, busy, onClose, onToggle, onDelete }: EventDetailProps) {
  const displayDate = new Date(event.occurrence_date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const notifyLabel = NOTIFY_BEFORE_OPTIONS.find((o) => o.value === event.notify_before)?.label;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-white/60 shadow-[0_24px_64px_rgba(60,40,20,0.15)] backdrop-blur-xl ${STICKY_BG[event.color]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
            {TYPE_LABELS[event.event_type]} · {displayDate}
          </p>
          <button
            className="rounded-full p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-2 pt-2">
          <h3 className={`text-xl text-foreground ${event.is_done ? "line-through opacity-60" : ""}`}>
            {event.title}
          </h3>
          {event.note ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">{event.note}</p>
          ) : null}

          {/* Recurrence & notification badges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.recurrence !== "none" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white/60 px-2 py-0.5 text-[0.65rem] font-bold text-muted">
                <Repeat className="h-2.5 w-2.5" />
                {RECURRENCE_LABELS[event.recurrence]}
                {event.recurrence_end ? (
                  <span className="text-muted/60"> until {event.recurrence_end}</span>
                ) : null}
              </span>
            ) : null}

            {event.notify_before >= 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white/60 px-2 py-0.5 text-[0.65rem] font-bold text-muted">
                <Bell className="h-2.5 w-2.5" />
                {notifyLabel}
                {event.notify_channels.length > 0 ? (
                  <span className="text-muted/60">
                    via {event.notify_channels.join(", ")}
                  </span>
                ) : null}
              </span>
            ) : null}

            {event.is_recurrence ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue/30 bg-blue/10 px-2 py-0.5 text-[0.65rem] font-bold text-blue-deep">
                Recurring occurrence
              </span>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border/50 px-5 py-3">
          {(event.event_type === "todo" || event.event_type === "reminder") ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                event.is_done
                  ? "bg-success/15 text-[#4a6e3f]"
                  : "bg-foreground/5 text-foreground hover:bg-foreground/10"
              }`}
              disabled={busy}
              onClick={() => onToggle(event)}
              type="button"
            >
              <Check className="h-3.5 w-3.5" />
              {event.is_done ? "Done" : "Mark done"}
            </motion.button>
          ) : null}

          <motion.button
            whileTap={{ scale: 0.95 }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger/8 px-3 py-2.5 text-xs font-bold text-danger transition hover:bg-danger/15"
            disabled={busy}
            onClick={() => onDelete(event.id)}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {event.recurrence !== "none" ? "Delete all" : "Remove"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
