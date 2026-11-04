"use client";

import { createPortal } from "react-dom";
import { AddEventModal } from "@/components/AddEventModal";
import { DayDetailSheet } from "@/components/DayDetailSheet";
import { EventDetail } from "@/components/EventDetail";
import { useCalendarData, useHousehold } from "@/components/WorkspaceData";
import { useKitchenEnabled } from "@/hooks/useKitchenDisplay";
import { expandRecurrences } from "@/lib/calendar";
import type { ExpandedCalendarEvent } from "@/lib/types";

export function CalendarDialogs({
  day,
  setDay,
  adding,
  setAdding,
  selected,
  setSelected,
}: {
  day: string | null;
  setDay: (day: string | null) => void;
  adding: string | null;
  setAdding: (day: string | null) => void;
  selected: ExpandedCalendarEvent | null;
  setSelected: (event: ExpandedCalendarEvent | null) => void;
}) {
  const data = useCalendarData();
  const { userId, adderId } = useHousehold();
  // On the kitchen display, plans default to whoever is picked in "Who's adding?".
  const kitchen = useKitchenEnabled();
  if (!day && !adding && !selected) return null;
  // Outside the animated/hidden panels: overlays remain viewport-relative.
  return createPortal(
    <>
      {day && !adding && !selected && (
        <DayDetailSheet
          dateKey={day}
          events={expandRecurrences(data.rawEvents, day, day)}
          onClose={() => setDay(null)}
          onAddEvent={() => {
            setAdding(day);
            setDay(null);
          }}
          onSelectEvent={(event) => {
            setDay(null);
            setSelected(event);
          }}
        />
      )}
      {adding && (
        <AddEventModal
          dateKey={adding}
          defaultOwner={kitchen ? (adderId ?? userId) : userId}
          busy={data.isWorking}
          error={data.error}
          onAdd={data.addEvent}
          onClose={() => setAdding(null)}
        />
      )}
      {selected && (
        <EventDetail
          event={selected}
          busy={data.isWorking}
          error={data.error}
          onClose={() => setSelected(null)}
          onDelete={async (id) => {
            if (await data.removeEvent(id)) setSelected(null);
          }}
          onToggle={async (event) => {
            if (await data.toggleDone(event)) setSelected(null);
          }}
        />
      )}
    </>,
    document.body,
  );
}
