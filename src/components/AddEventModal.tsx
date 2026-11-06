"use client";

import { useModalSurface } from "@/hooks/useModalSurface";

import { FormEvent, useEffect, useRef, useState } from "react";
import { DISMISS_OVERLAYS_EVENT } from "@/lib/kitchen";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarRange, Clock, Repeat, X } from "lucide-react";
import { NOTIFY_BEFORE_OPTIONS, normalizeEndDate, RECURRENCE_LABELS } from "@/lib/calendar";
import { MemberAvatar, useEveryone } from "@/components/MemberTag";
import type {
  CalendarEventType,
  NotifyChannel,
  Recurrence,
  StickyColor,
} from "@/lib/types";

const COLOR_OPTIONS: { value: StickyColor; label: string; classes: string }[] =
  [
    { value: "amber", label: "Amber", classes: "bg-amber/30 border-amber/60" },
    { value: "blue", label: "Blue", classes: "bg-blue/25 border-blue/50" },
    { value: "rose", label: "Rose", classes: "bg-danger/20 border-danger/40" },
    {
      value: "green",
      label: "Green",
      classes: "bg-success/25 border-success/50",
    },
    {
      value: "purple",
      label: "Purple",
      classes: "bg-[#c4b5fd]/30 border-[#c4b5fd]/60",
    },
  ];

// No "to-do" in calendar — use the list tab for to-dos
const TYPE_OPTIONS: {
  value: CalendarEventType;
  label: string;
  icon: string;
}[] = [
  { value: "event", label: "Event", icon: "◆" },
  { value: "reminder", label: "Reminder", icon: "◎" },
];

const RECURRENCE_OPTIONS = Object.entries(RECURRENCE_LABELS) as [
  Recurrence,
  string,
][];

type AddEventModalProps = {
  dateKey: string;
  /** Pre-selected owner (the person adding); null = everyone. */
  defaultOwner: string | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onAdd: (data: {
    event_date: string;
    event_time: string | null;
    end_date?: string;
    title: string;
    note?: string;
    event_type: CalendarEventType;
    color: StickyColor;
    recurrence: Recurrence;
    recurrence_end?: string;
    notify_before: number;
    notify_channels: NotifyChannel[];
    owner_id: string | null;
    owner_person_id: string | null;
  }) => Promise<boolean>;
};

type Draft = {
  dateKey: string;
  title: string;
  note: string;
  eventType: CalendarEventType;
  color: StickyColor;
  recurrence: Recurrence;
  recurrenceEnd: string;
  endDate: string;
  eventTime: string;
  notifyBefore: number;
  owner: string | null;
};

// A form closed by the kitchen display's idle reset (not by the person) is
// parked here and restored the next time the form opens for the same day.
let parkedDraft: Draft | null = null;

export function AddEventModal({
  dateKey,
  defaultOwner,
  busy,
  error,
  onClose: closeModal,
  onAdd,
}: AddEventModalProps) {
  // Closing on purpose (or saving) discards any parked draft.
  const onClose = () => {
    parkedDraft = null;
    closeModal();
  };
  const modalRef = useModalSurface(onClose);
  const [initial] = useState(() =>
    parkedDraft?.dateKey === dateKey ? parkedDraft : null,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [eventType, setEventType] = useState<CalendarEventType>(initial?.eventType ?? "event");
  const [color, setColor] = useState<StickyColor>(initial?.color ?? "amber");
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? "none");
  const [recurrenceEnd, setRecurrenceEnd] = useState(initial?.recurrenceEnd ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [eventTime, setEventTime] = useState(initial?.eventTime ?? "");
  const [notifyBefore, setNotifyBefore] = useState(initial?.notifyBefore ?? -1);
  const everyone = useEveryone();
  // Owner key: a member's user id, "p:<id>" for someone without an account,
  // or null for everyone.
  const [owner, setOwner] = useState<string | null>(
    initial ? initial.owner : everyone.length > 1 ? defaultOwner : null,
  );
  const ownerEntry = everyone.find((entry) => entry.key === owner) ?? null;

  const draft = useRef<Draft | null>(null);
  useEffect(() => {
    draft.current = { dateKey, title, note, eventType, color, recurrence, recurrenceEnd, endDate, eventTime, notifyBefore, owner };
  });
  // Runs after useModalSurface's own dismiss handler (registered first), so
  // the draft is parked after that handler's discard.
  useEffect(() => {
    const park = () => {
      if (draft.current && (draft.current.title.trim() || draft.current.note.trim())) {
        parkedDraft = draft.current;
      }
    };
    window.addEventListener(DISMISS_OVERLAYS_EVENT, park);
    return () => window.removeEventListener(DISMISS_OVERLAYS_EVENT, park);
  }, []);

  const displayDate = new Date(dateKey + "T00:00:00").toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    },
  );

  // "Ends on" must be after the start day; it only applies to one-off events.
  const nextDay = (() => {
    const [y, m, d] = dateKey.split("-").map(Number);
    const next = new Date(y!, m! - 1, d! + 1, 12);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  })();

  // Reminder only makes sense when a specific time is set
  const canSetReminder = eventTime !== "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;

    const validEnd =
      recurrence === "none" ? normalizeEndDate(dateKey, endDate) : null;

    const saved = await onAdd({
      event_date: dateKey,
      event_time: eventTime || null,
      end_date: validEnd ?? undefined,
      title: trimmed,
      note: note.trim() || undefined,
      event_type: eventType,
      color,
      recurrence,
      recurrence_end:
        recurrence !== "none" && recurrenceEnd ? recurrenceEnd : undefined,
      notify_before: canSetReminder ? notifyBefore : -1,
      notify_channels: [] as NotifyChannel[],
      owner_id: ownerEntry?.userId ?? null,
      owner_person_id: ownerEntry?.personId ?? null,
    });

    if (saved) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add event or reminder"
        tabIndex={-1}
        className="calendar-overlay fixed inset-0 z-50 overflow-y-auto bg-foreground/20 p-3 backdrop-blur-sm sm:p-4"
        onClick={onClose}
      >
        <div className="flex min-h-full items-start justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/95 shadow-[0_24px_64px_rgba(60,40,20,0.15)] backdrop-blur-xl max-h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ---- Sticky header ---- */}
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-bold text-foreground">Pin a note</p>
                <p className="text-xs text-muted">{displayDate}</p>
              </div>
              <button
                className="rounded-full p-1.5 text-muted transition hover:bg-foreground/5 hover:text-foreground"
                onClick={onClose}
                type="button"
              >
                <span className="sr-only">Close dialog</span>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ---- Scrollable form body ---- */}
            {error && (
              <p className="data-status error" role="alert">
                {error}
              </p>
            )}
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={handleSubmit}
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 overscroll-y-contain">
                {/* Title */}
                <input
                  aria-label="Event title"
                autoFocus
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/55 focus:border-amber-deep focus:ring-3 focus:ring-amber/20"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's happening?"
                  value={title}
                />

                {/* Note */}
                <textarea
                aria-label="Event note"
                  className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground outline-none transition placeholder:text-muted/55 focus:border-amber-deep focus:ring-3 focus:ring-amber/20"
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  rows={2}
                  value={note}
                />

                {/* Owner — whose plan this is */}
                {everyone.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">
                      Whose is it?
                    </p>
                    <div className="owner-picker" role="radiogroup" aria-label="Whose is it?">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={owner === null}
                        className="member-chip"
                        onClick={() => setOwner(null)}
                      >
                        <span className="member-avatar is-everyone" aria-hidden>
                          All
                        </span>
                        Everyone
                      </button>
                      {everyone.map(({ key, look }) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={owner === key}
                          className="member-chip"
                          onClick={() => setOwner(key)}
                        >
                          <MemberAvatar look={look} />
                          {look.short}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Type — event / reminder only */}
                <div className="space-y-2">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">
                    Type
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        className={`flex min-h-[3rem] flex-col items-center justify-center gap-1 rounded-[1rem] border px-2 py-2 text-center text-[0.72rem] font-bold leading-tight transition ${
                          eventType === opt.value
                            ? "border-amber/55 bg-amber/14 text-foreground"
                            : "border-border bg-white text-muted hover:border-amber/35"
                        }`}
                        key={opt.value}
                        onClick={() => setEventType(opt.value)}
                        type="button"
                      >
                        <span className="text-[0.7rem] leading-none">
                          {opt.icon}
                        </span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">
                    Color
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        aria-label={opt.label}
                        className={`relative h-8 w-8 rounded-full border-2 transition ${opt.classes} ${
                          color === opt.value
                            ? "scale-105 shadow-[0_6px_14px_rgba(45,36,28,0.12)] ring-2 ring-foreground/12"
                            : "hover:scale-105"
                        }`}
                        key={opt.value}
                        onClick={() => setColor(opt.value)}
                        title={opt.label}
                        type="button"
                      >
                        <span className="absolute inset-[3px] rounded-full border border-white/65" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ends on — multi-day events; not combined with a repeat */}
                {recurrence === "none" ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <CalendarRange className="h-3 w-3 text-muted" />
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">
                        Ends on{" "}
                        <span className="normal-case font-normal">
                          (optional)
                        </span>
                      </p>
                    </div>
                    <input
                      aria-label="Ends on"
                      className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-amber-deep focus:ring-2 focus:ring-amber/20"
                      min={nextDay}
                      onChange={(e) => setEndDate(e.target.value)}
                      type="date"
                      value={endDate}
                    />
                  </div>
                ) : null}

                {/* Time — required to enable reminders */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted" />
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">
                      Time{" "}
                      <span className="normal-case font-normal">
                        (optional)
                      </span>
                    </p>
                  </div>
                  <input
                    className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-amber-deep focus:ring-2 focus:ring-amber/20"
                    onChange={(e) => {
                      setEventTime(e.target.value);
                      // Clear reminder if time is removed
                      if (!e.target.value) setNotifyBefore(-1);
                    }}
                    type="time"
                    value={eventTime}
                  />
                </div>

                {/* Recurrence */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Repeat className="h-3 w-3 text-muted" />
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">
                      Repeat
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-amber-deep focus:ring-2 focus:ring-amber/20"
                      onChange={(e) => {
                        const next = e.target.value as Recurrence;
                        setRecurrence(next);
                        if (next !== "none") setEndDate("");
                      }}
                      value={recurrence}
                    >
                      {RECURRENCE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>

                    {recurrence !== "none" ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="shrink-0 text-[0.6rem] uppercase tracking-wider">
                          until
                        </span>
                        <input
                          className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-foreground outline-none transition focus:border-amber-deep focus:ring-2 focus:ring-amber/20"
                          min={dateKey}
                          onChange={(e) => setRecurrenceEnd(e.target.value)}
                          type="date"
                          value={recurrenceEnd}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>

                {/* Remind me — only available when time is set */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Bell
                      className={`h-3 w-3 ${canSetReminder ? "text-muted" : "text-muted/40"}`}
                    />
                    <p
                      className={`text-[0.6rem] font-bold uppercase tracking-[0.18em] ${canSetReminder ? "text-muted" : "text-muted/40"}`}
                    >
                      Remind me
                    </p>
                    {!canSetReminder ? (
                      <span className="text-[0.55rem] text-muted/50">
                        — set a time first
                      </span>
                    ) : null}
                  </div>
                  <select
                    className={`w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none transition ${
                      canSetReminder
                        ? "focus:border-amber-deep focus:ring-2 focus:ring-amber/20"
                        : "cursor-not-allowed opacity-40"
                    }`}
                    disabled={!canSetReminder}
                    onChange={(e) => setNotifyBefore(Number(e.target.value))}
                    value={notifyBefore}
                  >
                    {NOTIFY_BEFORE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {canSetReminder && notifyBefore >= 0 ? (
                    <p className="text-[0.6rem] text-muted">
                      Push to all subscribed devices
                    </p>
                  ) : null}
                </div>
              </div>

              {/* ---- Sticky footer / submit ---- */}
              <div className="shrink-0 border-t border-border/60 px-4 py-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#2f241b] disabled:opacity-60"
                  disabled={busy || !title.trim()}
                  type="submit"
                >
                  Pin to calendar
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
