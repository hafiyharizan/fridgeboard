"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Repeat, X } from "lucide-react";
import { NOTIFY_BEFORE_OPTIONS, RECURRENCE_LABELS } from "@/lib/calendar";
import type { CalendarEventType, NotifyChannel, Recurrence, StickyColor } from "@/lib/types";

const COLOR_OPTIONS: { value: StickyColor; label: string; classes: string }[] = [
  { value: "amber", label: "Amber", classes: "bg-amber/30 border-amber/60" },
  { value: "blue", label: "Blue", classes: "bg-blue/25 border-blue/50" },
  { value: "rose", label: "Rose", classes: "bg-danger/20 border-danger/40" },
  { value: "green", label: "Green", classes: "bg-success/25 border-success/50" },
  { value: "purple", label: "Purple", classes: "bg-[#c4b5fd]/30 border-[#c4b5fd]/60" },
];

const TYPE_OPTIONS: { value: CalendarEventType; label: string; icon: string }[] = [
  { value: "event", label: "Event", icon: "◆" },
  { value: "reminder", label: "Reminder", icon: "◎" },
  { value: "todo", label: "To-do", icon: "☐" },
];

const RECURRENCE_OPTIONS = Object.entries(RECURRENCE_LABELS) as [Recurrence, string][];

const CHANNEL_OPTIONS: { value: NotifyChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "telegram", label: "Telegram" },
  { value: "webhook", label: "Webhook" },
];

type AddEventModalProps = {
  dateKey: string;
  busy: boolean;
  availableChannels: NotifyChannel[];
  onClose: () => void;
  onAdd: (data: {
    event_date: string;
    title: string;
    note?: string;
    event_type: CalendarEventType;
    color: StickyColor;
    recurrence: Recurrence;
    recurrence_end?: string;
    notify_before: number;
    notify_channels: NotifyChannel[];
  }) => Promise<void>;
};

export function AddEventModal({ dateKey, busy, availableChannels, onClose, onAdd }: AddEventModalProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("event");
  const [color, setColor] = useState<StickyColor>("amber");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [notifyBefore, setNotifyBefore] = useState(-1);
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannel[]>([]);

  const showRecurrence = eventType === "event" || eventType === "reminder";
  const showNotify = eventType === "event" || eventType === "reminder";

  const displayDate = new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const toggleChannel = (ch: NotifyChannel) => {
    setNotifyChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    await onAdd({
      event_date: dateKey,
      title: trimmed,
      note: note.trim() || undefined,
      event_type: eventType,
      color,
      recurrence,
      recurrence_end: recurrence !== "none" && recurrenceEnd ? recurrenceEnd : undefined,
      notify_before: showNotify ? notifyBefore : -1,
      notify_channels: showNotify && notifyBefore >= 0 ? notifyChannels : [],
    });

    onClose();
  };

  return (
    <AnimatePresence>
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
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-white/60 bg-white/95 shadow-[0_24px_64px_rgba(60,40,20,0.15)] backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Pin a note</p>
              <p className="mt-0.5 text-sm text-foreground">{displayDate}</p>
            </div>
            <button
              className="rounded-full p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form */}
          <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
            {/* Title */}
            <input
              autoFocus
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted/55 focus:border-amber-deep focus:ring-4 focus:ring-amber/20"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's happening?"
              value={title}
            />

            {/* Note */}
            <textarea
              className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/55 focus:border-amber-deep focus:ring-4 focus:ring-amber/20"
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              value={note}
            />

            {/* Type picker */}
            <div className="space-y-1.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">Type</p>
              <div className="flex gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      eventType === opt.value
                        ? "border-amber/50 bg-amber/15 text-foreground"
                        : "border-border bg-white text-muted hover:border-amber/30"
                    }`}
                    key={opt.value}
                    onClick={() => setEventType(opt.value)}
                    type="button"
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">Color</p>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    className={`h-7 w-7 rounded-full border-2 transition ${opt.classes} ${
                      color === opt.value ? "scale-110 ring-2 ring-foreground/20" : "hover:scale-105"
                    }`}
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    title={opt.label}
                    type="button"
                  />
                ))}
              </div>
            </div>

            {/* Recurrence — for events and reminders */}
            {showRecurrence ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Repeat className="h-3 w-3 text-muted" />
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">Repeat</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RECURRENCE_OPTIONS.map(([value, label]) => (
                    <button
                      className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-bold transition ${
                        recurrence === value
                          ? "border-amber/50 bg-amber/15 text-foreground"
                          : "border-border bg-white text-muted hover:border-amber/30"
                      }`}
                      key={value}
                      onClick={() => setRecurrence(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Recurrence end date */}
                {recurrence !== "none" ? (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <span className="shrink-0">Ends on</span>
                      <input
                        className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground outline-none transition focus:border-amber-deep focus:ring-2 focus:ring-amber/20"
                        min={dateKey}
                        onChange={(e) => setRecurrenceEnd(e.target.value)}
                        type="date"
                        value={recurrenceEnd}
                      />
                      <span className="text-muted/60">(optional)</span>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Notification — for events and reminders */}
            {showNotify ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Bell className="h-3 w-3 text-muted" />
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">Notify</p>
                </div>
                <select
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-amber-deep focus:ring-4 focus:ring-amber/20"
                  onChange={(e) => setNotifyBefore(Number(e.target.value))}
                  value={notifyBefore}
                >
                  {NOTIFY_BEFORE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Channel selection — only when a notification time is selected */}
                {notifyBefore >= 0 ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-muted">
                      Send via
                      {availableChannels.length === 0 ? (
                        <span className="ml-1 normal-case tracking-normal text-danger">
                          — configure channels in settings first
                        </span>
                      ) : null}
                    </p>
                    <div className="flex gap-2">
                      {CHANNEL_OPTIONS.filter((ch) => availableChannels.includes(ch.value)).map((ch) => (
                        <button
                          className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-bold transition ${
                            notifyChannels.includes(ch.value)
                              ? "border-blue/50 bg-blue/15 text-blue-deep"
                              : "border-border bg-white text-muted hover:border-blue/30"
                          }`}
                          key={ch.value}
                          onClick={() => toggleChannel(ch.value)}
                          type="button"
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#2f241b] disabled:opacity-60"
              disabled={busy || !title.trim()}
              type="submit"
            >
              Pin to calendar
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
