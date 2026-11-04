"use client";
import {
  getDaysInMonth,
  getFirstDayOfWeek,
  formatDateKey,
  isToday,
  WEEKDAYS,
} from "@/lib/calendar";
import type { ExpandedCalendarEvent } from "@/lib/types";
type CalendarGridProps = {
  year: number;
  month: number;
  events: ExpandedCalendarEvent[];
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: ExpandedCalendarEvent) => void;
};
export function CalendarGrid({
  year,
  month,
  events,
  onDayClick,
  onEventClick,
}: CalendarGridProps) {
  const cells: (number | null)[] = Array(getFirstDayOfWeek(year, month)).fill(
    null,
  );
  for (let day = 1; day <= getDaysInMonth(year, month); day++) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="py-2 text-center text-xs font-bold text-muted"
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null)
            return <div key={`blank-${index}`} aria-hidden="true" />;
          const date = formatDateKey(year, month, day);
          const daily = events.filter(
            (event) => event.occurrence_date === date,
          );
          const today = isToday(year, month, day);
          return (
            <div
              key={date}
              className={`calendar-month-cell${today ? " is-today" : ""}`}
            >
              <button
                className="calendar-day-button"
                aria-current={today ? "date" : undefined}
                aria-label={`Open ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${daily.length} events`}
                onClick={() => onDayClick(date)}
              >
                {day}
              </button>
              {daily.slice(0, 3).map((event) => (
                <button
                  className={`calendar-event-button event-${event.color} ${event.is_done ? "line-through opacity-60" : ""}`}
                  key={`${event.id}-${date}`}
                  title={event.title}
                  onClick={() => onEventClick(event)}
                >
                  {event.is_recurrence ? "↻ " : ""}
                  {event.title}
                </button>
              ))}
              {daily.length > 3 && (
                <button
                  className="text-xs font-bold text-muted"
                  onClick={() => onDayClick(date)}
                >
                  +{daily.length - 3} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
