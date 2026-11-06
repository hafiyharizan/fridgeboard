"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { watchWake } from "@/hooks/watchWake";
import type { HouseholdMember, HouseholdPerson, HouseholdSettings, PersonColor } from "@/lib/types";

const REFRESH_MS = 15 * 60 * 1000;

export type SettingsPatch = Partial<Omit<HouseholdSettings, "pin_code" | "updated_at">>;

/**
 * Household members (accounts, for "who's adding?"), people (colours, and
 * people without an account such as kids) and shared settings (location,
 * prayer times). Settings change rarely, so this refreshes on wake and every
 * 15 minutes rather than holding a realtime channel open.
 */
export function useHouseholdInfo(pin: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [people, setPeople] = useState<HouseholdPerson[]>([]);
  const [settings, setSettings] = useState<HouseholdSettings | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data: accounts }, { data: rows }, { data: row }] = await Promise.all([
        supabase.rpc("household_members"),
        supabase.from("household_people").select("*").eq("pin_code", pin).order("created_at"),
        supabase.from("household_settings").select("*").eq("pin_code", pin).maybeSingle(),
      ]);
      if (!alive) return;
      if (Array.isArray(accounts)) setMembers(accounts);
      if (Array.isArray(rows)) setPeople(rows);
      setSettings(row ?? null);
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const stop = watchWake(
      () => void load(),
      () => void load(),
    );
    return () => {
      alive = false;
      window.clearInterval(timer);
      stop();
    };
  }, [pin, supabase, revision]);

  const saveSettings = useCallback(
    async (patch: SettingsPatch) => {
      const { data, error } = await supabase
        .from("household_settings")
        .upsert({ pin_code: pin, ...patch, updated_at: new Date().toISOString() })
        .select("*")
        .single();
      if (error) return error.message;
      setSettings(data);
      return null;
    },
    [pin, supabase],
  );

  /** Adds a person without an account. Returns an error message or null. */
  const addPerson = useCallback(
    async (name: string, color: PersonColor) => {
      const { data, error } = await supabase
        .from("household_people")
        .insert({ pin_code: pin, name: name.trim(), color })
        .select("*")
        .single();
      if (error) return error.message;
      setPeople((prev) => [...prev, data]);
      return null;
    },
    [pin, supabase],
  );

  /** Sets a colour for a person row, or for an account member (by user id). */
  const setPersonColor = useCallback(
    async (target: { personId: string } | { userId: string; name: string }, color: PersonColor) => {
      const previous = people;
      if ("personId" in target) {
        setPeople((prev) => prev.map((p) => (p.id === target.personId ? { ...p, color } : p)));
        const { error } = await supabase
          .from("household_people")
          .update({ color })
          .eq("id", target.personId);
        if (error) setPeople(previous);
        return error?.message ?? null;
      }
      const { data, error } = await supabase
        .from("household_people")
        .upsert(
          { pin_code: pin, user_id: target.userId, name: target.name.slice(0, 40) || "Member", color },
          { onConflict: "pin_code,user_id" },
        )
        .select("*")
        .single();
      if (error) return error.message;
      setPeople((prev) => [...prev.filter((p) => p.id !== data.id), data]);
      return null;
    },
    [people, pin, supabase],
  );

  const removePerson = useCallback(
    async (personId: string) => {
      const previous = people;
      setPeople((prev) => prev.filter((p) => p.id !== personId));
      const { error } = await supabase.from("household_people").delete().eq("id", personId);
      if (error) setPeople(previous);
      return error?.message ?? null;
    },
    [people, supabase],
  );

  return {
    members,
    people,
    addPerson,
    setPersonColor,
    removePerson,
    settings,
    saveSettings,
    refresh: useCallback(() => setRevision((value) => value + 1), []),
  };
}
