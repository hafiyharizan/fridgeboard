"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { HouseholdPerson, PersonColor } from "@/lib/types";

const sortPeople = (people: HouseholdPerson[]) =>
  [...people].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  );

// Before the household_people migration runs, PostgREST answers with these.
const isMissingTable = (code?: string) => code === "42P01" || code === "PGRST205";

/** The household's crew, kept live. `available` is false until the migration runs. */
export function useHouseholdPeople(pinCode: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [people, setPeople] = useState<HouseholdPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  useEffect(() => {
    let mounted = true;
    const fetchPeople = async () => {
      const { data, error: fetchError } = await supabase
        .from("household_people")
        .select("*")
        .eq("pin_code", pinCode);
      if (!mounted) return;
      if (fetchError) {
        if (isMissingTable(fetchError.code)) setAvailable(false);
        else setError(fetchError.message);
      } else {
        setAvailable(true);
        setPeople(sortPeople((data ?? []) as HouseholdPerson[]));
        setError("");
      }
      setLoading(false);
    };
    void fetchPeople();

    const channel = supabase
      .channel(`people:${pinCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_people", filter: `pin_code=eq.${pinCode}` },
        (payload: RealtimePostgresChangesPayload<HouseholdPerson>) => {
          setPeople((current) => {
            if (payload.eventType === "DELETE") return current.filter((p) => p.id !== payload.old.id);
            const next = payload.new as HouseholdPerson;
            return sortPeople([...current.filter((p) => p.id !== next.id), next]);
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && mounted) void fetchPeople();
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchPeople();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [pinCode, supabase]);

  const run = useCallback(async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    try {
      const { error: actionError } = await action();
      if (actionError) {
        setError(actionError.message);
        return false;
      }
      setError("");
      return true;
    } catch {
      setError("Couldn't save that change. Check your connection and try again.");
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);

  const addPerson = useCallback(
    async (name: string, color: PersonColor) => {
      const trimmed = name.trim().slice(0, 40);
      if (!trimmed) return false;
      const ok = await run(() =>
        supabase.from("household_people").insert({
          pin_code: pinCode,
          name: trimmed,
          color,
          sort_order: people.length,
        }),
      );
      return ok;
    },
    [people.length, pinCode, run, supabase],
  );

  const removePerson = useCallback(
    (id: string) => run(() => supabase.from("household_people").delete().eq("id", id)),
    [run, supabase],
  );

  const recolorPerson = useCallback(
    (id: string, color: PersonColor) =>
      run(() => supabase.from("household_people").update({ color }).eq("id", id)),
    [run, supabase],
  );

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  return { people, byId, loading, available, error, busy, addPerson, removePerson, recolorPerson };
}
