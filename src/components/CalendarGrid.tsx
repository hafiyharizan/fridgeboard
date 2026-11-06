"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
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

const ADD_VARIANTS = {
  rest: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1 },
};

function chipClasses(
  event: ExpandedCalendarEvent,
  hasPrev: boolean,
  hasNext: boolean,
): string {
  const classes = [`calendar-event-button event-${event.color}`];
  if (event.is_done) classes.push("line-through opacity-60");
  if (event.day_count > 1) {
    const start = event.day_index === 1;
    const end = event.day_index === event.day_count;
    classes.push("is-multi");
    if (start) classes.push("is-start");
    if (end) classes.push("is-end");
    // Bleed into the neighbouring cell only when the run continues into it.
    if (!start && hasPrev) classes.push("bleed-l");
    if (!start && !hasPrev) classes.push("is-edge-l");
    if (!end && hasNext) classes.push("bleed-r");
    if (!end && !hasNext) classes.push("is-edge-r");
  }
  return classes.join(" ");
}

function chipLabel(event: ExpandedCalendarEvent, rowStart: boolean): string {
  const prefix = event.is_recurrence ? "↻ " : "";
  if (event.day_count > 1 && event.day_index > 1 && !rowStart) {
    return `${prefix}${event.title} · day ${event.day_index}/${event.day_count}`;
  }
  return `${prefix}${event.title}`;
}

function DayCell({
  date,
  day,
  today,
  weekend,
  column,
  hasPrev,
  hasNext,
  daily,
  onDayClick,
  onEventClick,
}: {
  date: string;
  day: number;
  today: boolean;
  weekend: boolean;
  column: number;
  hasPrev: boolean;
  hasNext: boolean;
  daily: ExpandedCalendarEvent[];
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: ExpandedCalendarEvent) => void;
}) {
  const [focused, setFocused] = useState(false);
  const reduce = useReducedMotion();
  const longDate = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <motion.div
      className={`calendar-month-cell${today ? " is-today" : ""}${weekend ? " is-weekend" : ""}`}
      initial="rest"
      animate={focused ? "show" : "rest"}
      whileHover="show"
      transition={{ duration: reduce ? 0 : 0.15 }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <button
        className="calendar-day-button"
        aria-current={today ? "date" : undefined}
        aria-label={`Open ${longDate}, ${daily.length} events`}
        onClick={() => onDayClick(date)}
      >
        <span className="calendar-day-number">{day}</span>
      </button>
      <motion.button
        type="button"
        className="calendar-add-button"
        variants={ADD_VARIANTS}
        aria-label={`Add to ${longDate}`}
        title="Add"
        onClick={() => onDayClick(date)}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </motion.button>
      {daily.slice(0, 3).map((event) => (
        <button
          className={chipClasses(event, hasPrev, hasNext)}
          key={`${event.id}-${date}`}
          title={event.title}
          onClick={() => onEventClick(event)}
        >
          {chipLabel(event, column === 0)}
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
    </motion.div>
  );
}

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
          const column = index % 7;
          return (
            <DayCell
              key={date}
              date={date}
              day={day}
              today={isToday(year, month, day)}
              weekend={column === 0 || column === 6}
              column={column}
              hasPrev={column > 0 && cells[index - 1] != null}
              hasNext={column < 6 && cells[index + 1] != null}
              daily={events.filter((event) => event.occurrence_date === date)}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
            />
          );
        })}
      </div>
    </div>
  );
}
