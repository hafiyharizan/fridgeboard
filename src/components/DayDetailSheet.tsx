"use client";

import { Bell, CalendarPlus, ChevronRight, Clock, Repeat } from "lucide-react";
import { ModalFrame } from "@/components/ModalFrame";
import { formatEventTime, NOTIFY_BEFORE_OPTIONS, RECURRENCE_LABELS } from "@/lib/calendar";
import type { ExpandedCalendarEvent } from "@/lib/types";

type DayDetailSheetProps = {
  dateKey: string;
  events: ExpandedCalendarEvent[];
  onClose: () => void;
  onAddEvent: () => void;
  onSelectEvent: (event: ExpandedCalendarEvent) => void;
};

export function DayDetailSheet({ dateKey, events, onClose, onAddEvent, onSelectEvent }: DayDetailSheetProps) {
  const displayDate = new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Timed events first, in time order, then all-day events alphabetically.
  const sorted = [...events].sort((a, b) => {
    if (a.event_time && b.event_time) return a.event_time.localeCompare(b.event_time);
    if (a.event_time) return -1;
    if (b.event_time) return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <ModalFrame
      label="Day details"
      title={displayDate}
      description={sorted.length ? `${sorted.length} ${sorted.length === 1 ? "event" : "events"}` : "Nothing planned"}
      onClose={onClose}
      sheet
    >
      <div className="modal-body">
        {sorted.length === 0 ? (
          <div className="empty-state py-6">
            <span className="empty-state-icon">
              <CalendarPlus size={18} />
            </span>
            <h3>A free day</h3>
            <p>Add an event or a reminder and everyone at home will see it.</p>
          </div>
        ) : (
          <ul className="event-list">
            {sorted.map((event) => {
              const notifyLabel =
                event.notify_before >= 0
                  ? NOTIFY_BEFORE_OPTIONS.find((o) => o.value === event.notify_before)?.label
                  : null;
              return (
                <li key={`${event.id}-${event.occurrence_date}`}>
                  <button
                    className={`event-row tone-${event.color}${event.is_done ? " is-done" : ""}`}
                    onClick={() => {
                      onClose();
                      onSelectEvent(event);
                    }}
                    type="button"
                  >
                    <span className="event-row-time tabular">
                      {event.event_time ? formatEventTime(event.event_time) : "All day"}
                    </span>
                    <span className="event-row-main">
                      <span className="event-row-title">{event.title}</span>
                      {event.note ? <span className="event-row-note">{event.note}</span> : null}
                      {(event.recurrence !== "none" || notifyLabel || event.is_done || event.event_type === "reminder") && (
                        <span className="event-row-meta">
                          {event.event_type === "reminder" && (
                            <span className="badge badge-outline">
                              <Clock size={11} /> Reminder
                            </span>
                          )}
                          {event.recurrence !== "none" && (
                            <span className="badge badge-outline">
                              <Repeat size={11} /> {RECURRENCE_LABELS[event.recurrence]}
                            </span>
                          )}
                          {notifyLabel && (
                            <span className="badge badge-outline">
                              <Bell size={11} /> {notifyLabel}
                            </span>
                          )}
                          {event.is_done && <span className="badge badge-accent">Done</span>}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={16} className="event-row-chevron" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="btn btn-primary btn-block sm:w-auto"
          onClick={() => {
            onClose();
            onAddEvent();
          }}
          type="button"
        >
          <CalendarPlus size={16} />
          Add to this day
        </button>
      </div>
    </ModalFrame>
  );
}
