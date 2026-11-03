"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarGrid } from "@/components/CalendarGrid";
import { CalendarSettings } from "@/components/CalendarSettings";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { useCalendarData } from "@/components/WorkspaceData";
import { DataStatus } from "@/components/HomeDashboard";
import { getMonthName } from "@/lib/calendar";
import type { CalendarImportSource, ExpandedCalendarEvent } from "@/lib/types";

type CalendarTabProps = {
  pin: string;
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
};

export function CalendarTab({ pin, onDay, onEvent }: CalendarTabProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const {
    getMonthEvents,
    loading,
    isWorking,
    error,
    importSource,
    createSyncLink,
    connected,
    retry,
  } = useCalendarData();

  const monthEvents = useMemo(
    () => getMonthEvents(year, month),
    [getMonthEvents, year, month],
  );

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

  const handleImport = async (source: CalendarImportSource) => {
    return importSource(source, year);
  };

  return (
    <section className="note-panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/80 px-4 pb-4 pt-4 sm:px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
              Calendar
            </p>
            <h2 className="text-3xl text-foreground sm:text-[2.2rem]">
              What&apos;s coming up?
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <CalendarSettings
              busy={isWorking}
              onCreateSyncLink={createSyncLink}
              onImport={handleImport}
              year={year}
            />
            <PushNotificationButton pin={pin} />
          </div>
        </div>

        {/* Month navigation */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="rounded-full border border-border p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
              aria-label="Previous month"
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
              aria-label="Next month"
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
            onDayClick={onDay}
            onEventClick={onEvent}
          />
        )}
      </div>

      {/* Upcoming events summary */}
      {!loading && monthEvents.length > 0 ? (
        <div className="border-t border-border/50 px-4 py-3 sm:px-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
            {monthEvents.length} {monthEvents.length === 1 ? "note" : "notes"}{" "}
            this month
          </p>
        </div>
      ) : null}

      <DataStatus
        retry={retry}
        loading={false}
        error={error}
        connected={connected}
      />
    </section>
  );
}
