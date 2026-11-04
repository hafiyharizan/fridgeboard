"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRealtimeItems } from "@/hooks/useRealtimeItems";
import { useRealtimeCalendar } from "@/hooks/useRealtimeCalendar";
import { useHouseholdInfo } from "@/hooks/useHouseholdInfo";
import type { FridgeList } from "@/lib/types";
import { upcomingEvents, weekDates } from "@/lib/dashboard";
import { saveSnapshot } from "@/lib/offline-snapshot";

type ListController = ReturnType<typeof useRealtimeItems>;
const ListsContext = createContext<Record<string, ListController>>({});
const CalendarContext = createContext<ReturnType<
  typeof useRealtimeCalendar
> | null>(null);

type HouseholdValue = ReturnType<typeof useHouseholdInfo> & {
  /** Signed-in account (on a kitchen tablet, whoever set it up). */
  userId: string;
  /** Member credited for new items on this device; null = the account. */
  adderId: string | null;
  setAdderId: (id: string | null) => void;
};
const HouseholdContext = createContext<HouseholdValue | null>(null);

// One hook owner per list, including any additional household lists.
function ListData({
  lists,
  children,
}: {
  lists: FridgeList[];
  children: ReactNode;
}) {
  const inherited = useContext(ListsContext);
  const controller = useRealtimeItems(lists[0].id);
  return (
    <ListsContext.Provider value={{ ...inherited, [lists[0].id]: controller }}>
      {lists.length > 1 ? (
        <ListData lists={lists.slice(1)}>{children}</ListData>
      ) : (
        children
      )}
    </ListsContext.Provider>
  );
}

export function WorkspaceData({
  pin,
  userId,
  lists,
  children,
}: {
  pin: string;
  userId: string;
  lists: FridgeList[];
  children: ReactNode;
}) {
  const calendar = useRealtimeCalendar(pin);
  const info = useHouseholdInfo(pin);
  const [adderId, setAdderId] = useState<string | null>(null);
  return (
    <HouseholdContext.Provider value={{ ...info, userId, adderId, setAdderId }}>
      <CalendarContext.Provider value={calendar}>
        {lists.length ? <ListData lists={lists}>{children}</ListData> : children}
      </CalendarContext.Provider>
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const household = useContext(HouseholdContext);
  if (!household) throw new Error("Household data is unavailable.");
  return household;
}

export function useListData(id: string) {
  const lists = useContext(ListsContext);
  if (!lists[id]) throw new Error("List controller is unavailable.");
  return lists[id];
}

export function useCalendarData() {
  const calendar = useContext(CalendarContext);
  if (!calendar) throw new Error("Calendar controller is unavailable.");
  return calendar;
}

/** Household-wide freshness: live only if every feed is, synced as of the oldest. */
export function useSyncStatus(): { connected: boolean; syncedAt: number | null } {
  const lists = useContext(ListsContext);
  const calendar = useContext(CalendarContext);
  const feeds = [...Object.values(lists), ...(calendar ? [calendar] : [])];
  const times = feeds
    .map((feed) => feed.syncedAt)
    .filter((time): time is number => time !== null);
  return {
    connected: feeds.length > 0 && feeds.every((feed) => feed.connected),
    syncedAt:
      times.length > 0 && times.length === feeds.length ? Math.min(...times) : null,
  };
}

/** Keeps the offline copy of the board up to date. Renders nothing. */
export function OfflineSnapshotWriter({ lists, today }: { lists: FridgeList[]; today: string }) {
  const controllers = useContext(ListsContext);
  const calendar = useContext(CalendarContext);
  const ready =
    Boolean(calendar && !calendar.loading) &&
    lists.every((list) => controllers[list.id] && !controllers[list.id].loading);

  useEffect(() => {
    if (!ready || !calendar) return;
    const timer = window.setTimeout(() => {
      saveSnapshot({
        savedAt: new Date().toISOString(),
        lists: lists.map((list) => ({
          name: list.name,
          items: (controllers[list.id]?.items ?? [])
            .filter((item) => !item.is_checked)
            .map((item) => item.text),
        })),
        events: upcomingEvents(calendar.rawEvents, today, weekDates(today)[6]).map((event) => ({
          date: event.occurrence_date,
          time: event.event_time,
          title: event.title,
        })),
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [ready, lists, controllers, calendar, today]);

  return null;
}
