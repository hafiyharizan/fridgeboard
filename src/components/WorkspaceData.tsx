"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRealtimeItems } from "@/hooks/useRealtimeItems";
import { useRealtimeCalendar } from "@/hooks/useRealtimeCalendar";
import { useHouseholdPeople } from "@/hooks/useHouseholdPeople";
import type { FridgeList } from "@/lib/types";

type ListController = ReturnType<typeof useRealtimeItems>;
const ListsContext = createContext<Record<string, ListController>>({});
const CalendarContext = createContext<ReturnType<
  typeof useRealtimeCalendar
> | null>(null);
const PeopleContext = createContext<ReturnType<typeof useHouseholdPeople> | null>(null);

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
  lists,
  children,
}: {
  pin: string;
  lists: FridgeList[];
  children: ReactNode;
}) {
  const calendar = useRealtimeCalendar(pin);
  const people = useHouseholdPeople(pin);
  return (
    <CalendarContext.Provider value={calendar}>
      <PeopleContext.Provider value={people}>
        {lists.length ? <ListData lists={lists}>{children}</ListData> : children}
      </PeopleContext.Provider>
    </CalendarContext.Provider>
  );
}

export function useListData(id: string) {
  const lists = useContext(ListsContext);
  if (!lists[id]) throw new Error("List controller is unavailable.");
  return lists[id];
}

/** Every list controller, keyed by list id (for household-wide summaries). */
export function useAllListData() {
  return useContext(ListsContext);
}

export function usePeople() {
  const people = useContext(PeopleContext);
  if (!people) throw new Error("People controller is unavailable.");
  return people;
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
