"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarGrid } from "@/components/CalendarGrid";
import { CalendarSettings } from "@/components/CalendarSettings";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { useCalendarData } from "@/components/WorkspaceData";
import { DataStatus } from "@/components/HomeDashboard";
import { getMonthName } from "@/lib/calendar";
import type { CalendarImportSource, ExpandedCalendarEvent } from "@/lib/types";

type CalendarTabProps = {
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
};

export function CalendarTab({ onDay, onEvent }: CalendarTabProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { getMonthEvents, loading, isWorking, error, importSource, createSyncLink, connected, retry } =
    useCalendarData();

  const monthEvents = useMemo(() => getMonthEvents(year, month), [getMonthEvents, year, month]);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

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

  const handleImport = async (source: CalendarImportSource) => importSource(source, year);

  return (
    <section className="panel calendar-panel" aria-label="Calendar">
      <div className="calendar-toolbar">
        <div className="calendar-heading">
          <h2 className="calendar-month" aria-live="polite">
            {getMonthName(month)} <span className="tabular">{year}</span>
          </h2>
          <p className="panel-desc">
            {loading
              ? "Loading…"
              : monthEvents.length
                ? `${monthEvents.length} ${monthEvents.length === 1 ? "event" : "events"} this month`
                : "Nothing planned this month"}
          </p>
        </div>
        <div className="calendar-controls">
          <div className="button-group" role="group" aria-label="Change month">
            <button className="btn btn-secondary btn-sm" aria-label="Previous month" onClick={goToPrevMonth} type="button">
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={goToToday}
              disabled={isCurrentMonth}
              type="button"
            >
              Today
            </button>
            <button className="btn btn-secondary btn-sm" aria-label="Next month" onClick={goToNextMonth} type="button">
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="toolbar-divider" aria-hidden />
          <PushNotificationButton />
          <CalendarSettings
            busy={isWorking}
            onCreateSyncLink={createSyncLink}
            onImport={handleImport}
            year={year}
          />
        </div>
      </div>

      {(error || (!connected && !loading)) && (
        <div className="panel-body pb-0">
          <DataStatus retry={retry} loading={false} error={error} connected={connected} />
        </div>
      )}

      <CalendarGrid
        year={year}
        month={month}
        events={monthEvents}
        loading={loading}
        onDayClick={onDay}
        onEventClick={onEvent}
      />
    </section>
  );
}
