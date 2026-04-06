"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { expandRecurrences, getMonthRange } from "@/lib/calendar";
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarImportSource,
  ExpandedCalendarEvent,
  Recurrence,
  StickyColor,
} from "@/lib/types";

export function useRealtimeCalendar(pinCode: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      const { data, error: fetchError } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("pin_code", pinCode)
        .order("event_date", { ascending: true });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRawEvents((data ?? []) as CalendarEvent[]);
        setError("");
      }

      setLoading(false);
    };

    void fetchEvents();

    const syncFromPayload = (payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
      setRawEvents((current) => {
        if (payload.eventType === "INSERT") {
          const newEvent = payload.new as CalendarEvent;
          return [...current.filter((e) => e.id !== newEvent.id), newEvent].sort(
            (a, b) => a.event_date.localeCompare(b.event_date),
          );
        }

        if (payload.eventType === "UPDATE") {
          return current
            .map((e) => (e.id === payload.new.id ? (payload.new as CalendarEvent) : e))
            .sort((a, b) => a.event_date.localeCompare(b.event_date));
        }

        return current.filter((e) => e.id !== payload.old.id);
      });
    };

    const channel = supabase
      .channel(`calendar:${pinCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_events",
          filter: `pin_code=eq.${pinCode}`,
        },
        syncFromPayload,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          void fetchEvents();
        }
      });

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [pinCode, supabase]);

  /** Expand recurring events for a specific month. */
  const getMonthEvents = useCallback(
    (year: number, month: number): ExpandedCalendarEvent[] => {
      const { start, end } = getMonthRange(year, month);
      return expandRecurrences(rawEvents, start, end);
    },
    [rawEvents],
  );

  const addEvent = async (data: {
    event_date: string;
    event_time?: string | null;
    title: string;
    note?: string;
    event_type: CalendarEventType;
    color: StickyColor;
    recurrence: Recurrence;
    recurrence_end?: string;
    notify_before: number;
    notify_channels: [];
  }) => {
    setIsWorking(true);

    const { error: insertError } = await supabase.from("calendar_events").insert({
      pin_code: pinCode,
      event_date: data.event_date,
      event_time: data.event_time ?? null,
      title: data.title,
      note: data.note,
      event_type: data.event_type,
      color: data.color,
      recurrence: data.recurrence,
      recurrence_end: data.recurrence_end || null,
      notify_before: data.notify_before,
      notify_channels: data.notify_channels,
    });

    setIsWorking(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setError("");
  };

  const toggleDone = async (event: CalendarEvent) => {
    setIsWorking(true);

    const { error: updateError } = await supabase
      .from("calendar_events")
      .update({ is_done: !event.is_done })
      .eq("id", event.id);

    setIsWorking(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setError("");
  };

  const removeEvent = async (eventId: string) => {
    setIsWorking(true);

    const { error: deleteError } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", eventId);

    setIsWorking(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setError("");
  };

  const importSource = async (source: CalendarImportSource, year: number) => {
    setIsWorking(true);

    try {
      const response = await fetch("/api/calendar/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source, year }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        imported?: number;
        skipped?: number;
        total?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not import that calendar.");
      }

      setError("");
      return {
        imported: payload.imported ?? 0,
        skipped: payload.skipped ?? 0,
        total: payload.total ?? 0,
      };
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import that calendar.");
      return null;
    } finally {
      setIsWorking(false);
    }
  };

  const createSyncLink = async () => {
    setIsWorking(true);

    try {
      const response = await fetch("/api/calendar/sync", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        feedUrl?: string;
        appleUrl?: string;
        googleUrl?: string;
      };

      if (!response.ok || !payload.feedUrl || !payload.appleUrl || !payload.googleUrl) {
        throw new Error(payload.error || "Could not create a sync link.");
      }

      setError("");
      return {
        feedUrl: payload.feedUrl,
        appleUrl: payload.appleUrl,
        googleUrl: payload.googleUrl,
      };
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not create a sync link.");
      return null;
    } finally {
      setIsWorking(false);
    }
  };

  return {
    rawEvents,
    getMonthEvents,
    loading,
    isWorking,
    error,
    addEvent,
    toggleDone,
    removeEvent,
    importSource,
    createSyncLink,
  };
}
