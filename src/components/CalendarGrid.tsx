"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, isToday, WEEKDAYS, EVENT_TYPE_ICONS } from "@/lib/calendar";
import type { ExpandedCalendarEvent, StickyColor } from "@/lib/types";

const STICKY_COLORS: Record<StickyColor, string> = {
  amber: "bg-amber/25 border-amber/50 text-amber-deep",
  blue: "bg-blue/20 border-blue/40 text-blue-deep",
  rose: "bg-danger/15 border-danger/35 text-danger",
  green: "bg-success/20 border-success/40 text-[#4a6e3f]",
  purple: "bg-[#c4b5fd]/25 border-[#c4b5fd]/50 text-[#6d28d9]",
};


type CalendarGridProps = {
  year: number;
  month: number;
  events: ExpandedCalendarEvent[];
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: ExpandedCalendarEvent) => void;
};

export function CalendarGrid({ year, month, events, onDayClick, onEventClick }: CalendarGridProps) {
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ExpandedCalendarEvent[]>();
    for (const event of events) {
      const key = event.occurrence_date;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            className="py-1 text-center text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted"
            key={day}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div className="min-h-[4.5rem]" key={`empty-${i}`} />;
          }

          const dateKey = formatDateKey(year, month, day);
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const today = isToday(year, month, day);

          return (
            <button
              className={`group relative min-h-[4.5rem] rounded-xl border p-1 text-left transition hover:border-amber/40 hover:bg-amber/5 ${
                today
                  ? "border-amber/50 bg-amber/8"
                  : "border-transparent"
              }`}
              key={dateKey}
              onClick={() => onDayClick(dateKey)}
              type="button"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                  today
                    ? "bg-amber text-foreground"
                    : "text-muted group-hover:text-foreground"
                }`}
              >
                {day}
              </span>

              <AnimatePresence>
                {dayEvents.slice(0, 3).map((event) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`mt-0.5 truncate rounded-md border px-1 py-0.5 text-[0.6rem] font-medium leading-tight ${
                      STICKY_COLORS[event.color]
                    } ${event.is_done ? "line-through opacity-50" : ""}`}
                    key={`${event.id}-${event.occurrence_date}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    title={event.title}
                  >
                    <span className="mr-0.5">{EVENT_TYPE_ICONS[event.event_type]}</span>
                    {event.is_recurrence ? "↻ " : ""}
                    {event.title}
                  </motion.div>
                ))}
                {dayEvents.length > 3 ? (
                  <div className="mt-0.5 text-center text-[0.55rem] font-bold text-muted">
                    +{dayEvents.length - 3} more
                  </div>
                ) : null}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
    </div>
  );
}
