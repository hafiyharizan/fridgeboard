"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AddEventModal } from "@/components/AddEventModal";
import { CalendarGrid } from "@/components/CalendarGrid";
import { EventDetail } from "@/components/EventDetail";
import { NotificationSettings } from "@/components/NotificationSettings";
import { useRealtimeCalendar } from "@/hooks/useRealtimeCalendar";
import { getMonthName } from "@/lib/calendar";
import type { ExpandedCalendarEvent } from "@/lib/types";

type CalendarTabProps = {
  pin: string;
};

export function CalendarTab({ pin }: CalendarTabProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ExpandedCalendarEvent | null>(null);

  const { getMonthEvents, availableChannels, loading, isWorking, error, addEvent, toggleDone, removeEvent } =
    useRealtimeCalendar(pin);

  const monthEvents = useMemo(() => getMonthEvents(year, month), [getMonthEvents, year, month]);

  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const handleDeleteAndClose = async (eventId: string) => {
    await removeEvent(eventId);
    setSelectedEvent(null);
  };

  const handleToggleAndClose = async (event: ExpandedCalendarEvent) => {
    await toggleDone(event);
    setSelectedEvent(null);
  };

  return (
    <section className="note-panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/80 px-4 pb-4 pt-4 sm:px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Calendar</p>
            <h2 className="text-3xl text-foreground sm:text-[2.2rem]">What&apos;s coming up?</h2>
          </div>
          <NotificationSettings pin={pin} />
        </div>

        {/* Month navigation */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="rounded-full border border-border p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
              onClick={goToPrevMonth}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.button>

            <h3 className="min-w-[10rem] text-center text-lg font-bold text-foreground">
              {getMonthName(month)} {year}
            </h3>

            <motion.button
              whileTap={{ scale: 0.9 }}
              className="rounded-full border border-border p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
              onClick={goToNextMonth}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>

          <button
            className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted transition hover:border-amber/40 hover:text-foreground"
            onClick={goToToday}
            type="button"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3 sm:px-4">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted">
            Loading calendar...
          </div>
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            events={monthEvents}
            onDayClick={setSelectedDate}
            onEventClick={setSelectedEvent}
          />
        )}
      </div>

      {/* Upcoming events summary */}
      {!loading && monthEvents.length > 0 ? (
        <div className="border-t border-border/50 px-4 py-3 sm:px-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
            {monthEvents.length} {monthEvents.length === 1 ? "note" : "notes"} this month
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="border-t border-border bg-danger/8 px-4 py-3 text-sm text-danger sm:px-5">
          {error}
        </div>
      ) : null}

      {/* Add event modal */}
      <AnimatePresence>
        {selectedDate ? (
          <AddEventModal
            availableChannels={availableChannels}
            busy={isWorking}
            dateKey={selectedDate}
            onAdd={addEvent}
            onClose={() => setSelectedDate(null)}
          />
        ) : null}
      </AnimatePresence>

      {/* Event detail modal */}
      <AnimatePresence>
        {selectedEvent ? (
          <EventDetail
            busy={isWorking}
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onDelete={handleDeleteAndClose}
            onToggle={handleToggleAndClose}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
