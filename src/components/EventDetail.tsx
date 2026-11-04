"use client";

import { Bell, CalendarDays, Check, Clock, Download, Repeat, RotateCcw, StickyNote, Trash2 } from "lucide-react";
import { ModalFrame } from "@/components/ModalFrame";
import { formatEventTime, NOTIFY_BEFORE_OPTIONS, RECURRENCE_LABELS } from "@/lib/calendar";
import type { ExpandedCalendarEvent } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  event: "Event",
  reminder: "Reminder",
  todo: "To-do",
};

type EventDetailProps = {
  event: ExpandedCalendarEvent;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onToggle: (event: ExpandedCalendarEvent) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
};

const formatDay = (key: string) =>
  new Date(key + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

export function EventDetail({ event, busy, error, onClose, onToggle, onDelete }: EventDetailProps) {
  const notifyLabel = NOTIFY_BEFORE_OPTIONS.find((o) => o.value === event.notify_before)?.label;
  const repeats = event.recurrence !== "none";
  const canComplete = event.event_type === "todo" || event.event_type === "reminder";

  return (
    <ModalFrame
      label="Event details"
      title={<span className={event.is_done ? "line-through decoration-1 opacity-60" : undefined}>{event.title}</span>}
      description={TYPE_LABELS[event.event_type]}
      leading={<span className={`tone-${event.color} event-swatch`} aria-hidden />}
      onClose={onClose}
    >
      <div className="modal-body">
        <dl className="detail-list">
          <div>
            <dt>
              <CalendarDays size={15} />
              <span className="sr-only">Date</span>
            </dt>
            <dd>{formatDay(event.occurrence_date)}</dd>
          </div>
          <div>
            <dt>
              <Clock size={15} />
              <span className="sr-only">Time</span>
            </dt>
            <dd className="tabular">{event.event_time ? formatEventTime(event.event_time) : "All day"}</dd>
          </div>
          {repeats && (
            <div>
              <dt>
                <Repeat size={15} />
                <span className="sr-only">Repeats</span>
              </dt>
              <dd>
                {RECURRENCE_LABELS[event.recurrence]}
                {event.recurrence_end ? (
                  <span className="text-muted"> until {formatDay(event.recurrence_end)}</span>
                ) : null}
              </dd>
            </div>
          )}
          {event.notify_before >= 0 && notifyLabel && (
            <div>
              <dt>
                <Bell size={15} />
                <span className="sr-only">Reminder</span>
              </dt>
              <dd>{notifyLabel}</dd>
            </div>
          )}
          {event.note && (
            <div>
              <dt>
                <StickyNote size={15} />
                <span className="sr-only">Note</span>
              </dt>
              <dd className="whitespace-pre-line">{event.note}</dd>
            </div>
          )}
          {event.source_type !== "manual" && event.source_label && (
            <div>
              <dt>
                <Download size={15} />
                <span className="sr-only">Source</span>
              </dt>
              <dd className="text-muted">Imported from {event.source_label}</dd>
            </div>
          )}
        </dl>
        {event.is_done && (
          <p className="alert alert-success mt-4">
            <Check size={15} /> Marked as done.
          </p>
        )}
        {error && (
          <p className="alert alert-error mt-4" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="btn btn-danger mr-auto"
          disabled={busy}
          onClick={() => onDelete(event.id)}
          type="button"
        >
          <Trash2 size={15} />
          {repeats ? "Delete series" : "Delete"}
        </button>
        {canComplete ? (
          <button
            className={`btn ${event.is_done ? "btn-secondary" : "btn-primary"}`}
            disabled={busy}
            onClick={() => onToggle(event)}
            type="button"
          >
            {event.is_done ? <RotateCcw size={15} /> : <Check size={15} />}
            {event.is_done ? "Mark not done" : "Mark done"}
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Close
          </button>
        )}
      </div>
    </ModalFrame>
  );
}
