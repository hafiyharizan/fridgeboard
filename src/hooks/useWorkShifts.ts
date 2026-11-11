"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { watchWake } from "@/hooks/watchWake";
import type { WorkPlace, WorkShift } from "@/lib/types";

export type ShiftInput = {
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  note?: string | null;
  /** Null clears the place. Leave out to keep what is saved. */
  work_place?: WorkPlace | null;
  location?: string | null;
};

const byDate = (a: WorkShift, b: WorkShift) =>
  a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time);

/**
 * The household's work roster from `from` (YYYY-MM-DD) onward, kept live.
 * One shift per member per day: saving a day replaces that day's shift.
 */
export function useWorkShifts(pin: string, from: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const working = useRef(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from("work_shifts")
        .select("*")
        .eq("pin_code", pin)
        .gte("shift_date", from)
        .order("shift_date", { ascending: true });
      if (!alive) return;
      if (fetchError) setError(fetchError.message);
      else {
        setShifts(data ?? []);
        setError("");
      }
      setLoading(false);
    };
    void load();

    const sync = (payload: RealtimePostgresChangesPayload<WorkShift>) => {
      setShifts((current) => {
        if (payload.eventType === "DELETE") {
          return current.filter((shift) => shift.id !== payload.old.id);
        }
        const row = payload.new;
        if (row.shift_date < from) return current;
        return [
          ...current.filter(
            (shift) =>
              shift.id !== row.id &&
              !(shift.user_id === row.user_id && shift.shift_date === row.shift_date),
          ),
          row,
        ].sort(byDate);
      });
    };
    const channel = supabase
      .channel(`work:${pin}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_shifts", filter: `pin_code=eq.${pin}` },
        sync,
      )
      .subscribe((status) => {
        if (alive && status !== "SUBSCRIBED") void load();
      });
    const stop = watchWake(
      () => void load(),
      () => setRevision((value) => value + 1),
    );
    return () => {
      alive = false;
      stop();
      void supabase.removeChannel(channel);
    };
  }, [pin, from, supabase, revision]);

  const run = useCallback(async (action: () => Promise<string | null>) => {
    if (working.current) return false;
    if (!navigator.onLine) {
      setError("You’re offline. Reconnect and try again.");
      return false;
    }
    working.current = true;
    setIsWorking(true);
    try {
      const failure = await action();
      setError(failure ?? "");
      return !failure;
    } catch {
      setError("Could not save your change. Please try again.");
      return false;
    } finally {
      working.current = false;
      setIsWorking(false);
    }
  }, []);

  /** Saves (or replaces) shifts, one per member per day. */
  const saveShifts = useCallback(
    (inputs: ShiftInput[]) =>
      run(async () => {
        if (!inputs.length) return null;
        const { data, error: saveError } = await supabase
          .from("work_shifts")
          .upsert(
            inputs.map((input) => ({ ...input, note: input.note || null, pin_code: pin })),
            { onConflict: "user_id,shift_date" },
          )
          .select("*");
        if (saveError) return saveError.message;
        const saved = data ?? [];
        setShifts((current) =>
          [
            ...current.filter(
              (shift) =>
                !saved.some(
                  (row) => row.user_id === shift.user_id && row.shift_date === shift.shift_date,
                ),
            ),
            ...saved,
          ].sort(byDate),
        );
        return null;
      }),
    [pin, run, supabase],
  );

  /** Marks a member as off (no shift) on the given days. */
  const clearShifts = useCallback(
    (userId: string, days: string[]) =>
      run(async () => {
        const { error: deleteError } = await supabase
          .from("work_shifts")
          .delete()
          .eq("pin_code", pin)
          .eq("user_id", userId)
          .in("shift_date", days);
        if (deleteError) return deleteError.message;
        setShifts((current) =>
          current.filter((shift) => !(shift.user_id === userId && days.includes(shift.shift_date))),
        );
        return null;
      }),
    [pin, run, supabase],
  );

  return { shifts, loading, error, isWorking, saveShifts, clearShifts };
}
