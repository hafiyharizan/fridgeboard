"use client";

import { FormEvent, useState } from "react";
import { BellRing, CalendarDays, Check, type LucideIcon } from "lucide-react";
import { ModalFrame } from "@/components/ModalFrame";
import { NOTIFY_BEFORE_OPTIONS, RECURRENCE_LABELS } from "@/lib/calendar";
import type {
  CalendarEventType,
  NotifyChannel,
  Recurrence,
  StickyColor,
} from "@/lib/types";

const COLOR_OPTIONS: { value: StickyColor; label: string }[] = [
  { value: "amber", label: "Amber" },
  { value: "blue", label: "Blue" },
  { value: "rose", label: "Rose" },
  { value: "green", label: "Green" },
  { value: "purple", label: "Purple" },
];

// No "to-do" in calendar — use the list tab for to-dos
const TYPE_OPTIONS: { value: CalendarEventType; label: string; Icon: LucideIcon }[] = [
  { value: "event", label: "Event", Icon: CalendarDays },
  { value: "reminder", label: "Reminder", Icon: BellRing },
];

const RECURRENCE_OPTIONS = Object.entries(RECURRENCE_LABELS) as [
  Recurrence,
  string,
][];

type AddEventModalProps = {
  dateKey: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onAdd: (data: {
    event_date: string;
    event_time: string | null;
    title: string;
    note?: string;
    event_type: CalendarEventType;
    color: StickyColor;
    recurrence: Recurrence;
    recurrence_end?: string;
    notify_before: number;
    notify_channels: NotifyChannel[];
  }) => Promise<boolean>;
};

export function AddEventModal({
  dateKey,
  busy,
  error,
  onClose,
  onAdd,
}: AddEventModalProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("event");
  const [color, setColor] = useState<StickyColor>("amber");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [notifyBefore, setNotifyBefore] = useState(-1);

  const displayDate = new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Reminder only makes sense when a specific time is set
  const canSetReminder = eventTime !== "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;

    const saved = await onAdd({
      event_date: dateKey,
      event_time: eventTime || null,
      title: trimmed,
      note: note.trim() || undefined,
      event_type: eventType,
      color,
      recurrence,
      recurrence_end:
        recurrence !== "none" && recurrenceEnd ? recurrenceEnd : undefined,
      notify_before: canSetReminder ? notifyBefore : -1,
      notify_channels: [] as NotifyChannel[],
    });

    if (saved) onClose();
  };

  return (
    <ModalFrame label="Add event or reminder" title="New event" description={displayDate} onClose={onClose} size="lg">
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <div className="modal-body form-stack">
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          <div className="field">
            <label className="field-label" htmlFor="event-title">
              Title
            </label>
            <input
              id="event-title"
              aria-label="Event title"
              data-autofocus
              className="input"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Swimming lesson"
              value={title}
            />
          </div>

          <div className="field">
            <span className="field-label" id="event-type-label">
              Type
            </span>
            <div className="segmented" role="group" aria-labelledby="event-type-label">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  aria-pressed={eventType === opt.value}
                  key={opt.value}
                  onClick={() => setEventType(opt.value)}
                  type="button"
                >
                  <opt.Icon size={15} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="event-time">
                Time <span className="optional">Optional</span>
              </label>
              <input
                id="event-time"
                className="input tabular"
                onChange={(e) => {
                  setEventTime(e.target.value);
                  // A reminder needs a time, so clear it when the time goes.
                  if (!e.target.value) setNotifyBefore(-1);
                }}
                type="time"
                value={eventTime}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="event-reminder">
                Remind me
              </label>
              <select
                id="event-reminder"
                className="select"
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
              <span className="field-hint">
                {canSetReminder
                  ? notifyBefore >= 0
                    ? "Sent to every device with notifications on."
                    : "Choose when to send a push notification."
                  : "Set a time to choose a reminder."}
              </span>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="event-repeat">
                Repeat
              </label>
              <select
                id="event-repeat"
                className="select"
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                value={recurrence}
              >
                {RECURRENCE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {recurrence !== "none" ? (
              <div className="field">
                <label className="field-label" htmlFor="event-until">
                  Until <span className="optional">Optional</span>
                </label>
                <input
                  id="event-until"
                  className="input tabular"
                  min={dateKey}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                  type="date"
                  value={recurrenceEnd}
                />
              </div>
            ) : null}
          </div>

          <div className="field">
            <span className="field-label" id="event-colour-label">
              Colour
            </span>
            <div className="swatches" role="group" aria-labelledby="event-colour-label">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  aria-label={opt.label}
                  aria-pressed={color === opt.value}
                  className={`swatch tone-${opt.value}`}
                  key={opt.value}
                  onClick={() => setColor(opt.value)}
                  title={opt.label}
                  type="button"
                >
                  {color === opt.value ? <Check size={14} strokeWidth={3} /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="event-note">
              Note <span className="optional">Optional</span>
            </label>
            <textarea
              id="event-note"
              aria-label="Event note"
              className="textarea"
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything people should know"
              rows={2}
              value={note}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !title.trim()} type="submit">
            {busy ? "Adding…" : "Add to calendar"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
