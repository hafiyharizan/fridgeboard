"use client";
import { Repeat } from "lucide-react";
import {
  formatDateKey,
  formatEventTime,
  getDaysInMonth,
  getFirstDayOfWeek,
  isToday,
  WEEKDAYS,
} from "@/lib/calendar";
import type { ExpandedCalendarEvent } from "@/lib/types";

type CalendarGridProps = {
  year: number;
  month: number;
  events: ExpandedCalendarEvent[];
  loading?: boolean;
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: ExpandedCalendarEvent) => void;
};

const MAX_VISIBLE = 3;

export function CalendarGrid({
  year,
  month,
  events,
  loading = false,
  onDayClick,
  onEventClick,
}: CalendarGridProps) {
  const cells: (number | null)[] = Array(getFirstDayOfWeek(year, month)).fill(null);
  for (let day = 1; day <= getDaysInMonth(year, month); day++) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return (
    <div className={`month-grid${loading ? " is-loading" : ""}`} aria-busy={loading}>
      <div className="month-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day, index) => (
          <span key={day} className={index === 0 || index === 6 ? "is-weekend" : undefined}>
            {day}
          </span>
        ))}
      </div>
      <div className="month-cells">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} className="month-cell is-blank" aria-hidden="true" />;
          const date = formatDateKey(year, month, day);
          const daily = events
            .filter((event) => event.occurrence_date === date)
            .sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
          const today = isToday(year, month, day);
          const weekend = index % 7 === 0 || index % 7 === 6;
          return (
            <div
              key={date}
              className={`month-cell${today ? " is-today" : ""}${weekend ? " is-weekend" : ""}`}
            >
              <button
                className="month-day"
                aria-current={today ? "date" : undefined}
                aria-label={`Open ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${daily.length} ${daily.length === 1 ? "event" : "events"}`}
                onClick={() => onDayClick(date)}
                type="button"
              >
                <span className="month-day-number tabular">{day}</span>
              </button>
              <div className="month-events">
                {daily.slice(0, MAX_VISIBLE).map((event) => (
                  <button
                    className={`month-event tone-${event.color}${event.is_done ? " is-done" : ""}`}
                    key={`${event.id}-${date}`}
                    title={event.title}
                    onClick={() => onEventClick(event)}
                    type="button"
                  >
                    {event.event_time ? (
                      <span className="month-event-time tabular">
                        {formatEventTime(event.event_time).replace(":00", "").replace(" ", "").toLowerCase()}
                      </span>
                    ) : null}
                    {event.recurrence !== "none" ? (
                      <Repeat size={11} className="month-event-repeat" aria-label="Repeats" />
                    ) : null}
                    <span className="month-event-title">{event.title}</span>
                  </button>
                ))}
                {daily.length > MAX_VISIBLE && (
                  <button className="month-more" onClick={() => onDayClick(date)} type="button">
                    +{daily.length - MAX_VISIBLE} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
