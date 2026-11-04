"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { watchWake } from "@/hooks/watchWake";
import type { HouseholdMember, HouseholdSettings } from "@/lib/types";

const REFRESH_MS = 15 * 60 * 1000;

export type SettingsPatch = Partial<Omit<HouseholdSettings, "pin_code" | "updated_at">>;

/**
 * Household members (for "who's adding?") and shared settings (location,
 * prayer times). Settings change rarely, so this refreshes on wake and every
 * 15 minutes rather than holding a realtime channel open.
 */
export function useHouseholdInfo(pin: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [settings, setSettings] = useState<HouseholdSettings | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data: people }, { data: row }] = await Promise.all([
        supabase.rpc("household_members"),
        supabase.from("household_settings").select("*").eq("pin_code", pin).maybeSingle(),
      ]);
      if (!alive) return;
      if (Array.isArray(people)) setMembers(people);
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

  return {
    members,
    settings,
    saveSettings,
    refresh: useCallback(() => setRevision((value) => value + 1), []),
  };
}
