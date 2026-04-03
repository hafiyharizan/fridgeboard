"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarTab } from "@/components/CalendarTab";
import { ListTab } from "@/components/ListTab";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { FridgeList } from "@/lib/types";

const SESSION_PIN_KEY = "fridgeboard-pin";

const CALENDAR_TAB_ID = "__calendar__";

const tabTone: Record<string, string> = {
  Grocery: "bg-amber text-foreground shadow-[inset_0_-2px_0_rgba(200,135,26,0.28)]",
  "To-Do": "bg-blue text-white shadow-[inset_0_-2px_0_rgba(64,119,183,0.35)]",
  Calendar: "bg-danger/80 text-white shadow-[inset_0_-2px_0_rgba(160,70,55,0.35)]",
};

export function ListShell() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [lists, setLists] = useState<FridgeList[]>([]);
  const [activeListId, setActiveListId] = useState("");
  const [pin] = useState(() =>
    typeof window === "undefined" ? "" : sessionStorage.getItem(SESSION_PIN_KEY) ?? "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pin) {
      router.replace("/");
      return;
    }

    const loadLists = async () => {
      const { data, error: fetchError } = await supabase
        .from("lists")
        .select("*")
        .eq("pin_code", pin)
        .order("created_at", { ascending: true });

      if (fetchError) {
        const isNetworkError =
          fetchError.message.toLowerCase().includes("load failed") ||
          fetchError.message.toLowerCase().includes("failed to fetch") ||
          fetchError.message.toLowerCase().includes("network");
        setError(
          isNetworkError
            ? "Could not connect to the database. Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set, then redeploy."
            : fetchError.message,
        );
        setLoading(false);
        return;
      }

      const typedLists = (data ?? []) as FridgeList[];

      if (!typedLists.length) {
        setError("No lists match that PIN yet. Seed Grocery and To-Do in Supabase first.");
        setLoading(false);
        return;
      }

      setLists(typedLists);
      setActiveListId(typedLists[0]?.id ?? "");
      setLoading(false);
    };

    void loadLists();
  }, [pin, router, supabase]);

  const isCalendarActive = activeListId === CALENDAR_TAB_ID;
  const activeList = isCalendarActive ? null : (lists.find((list) => list.id === activeListId) ?? lists[0]);

  const handleResetPin = () => {
    sessionStorage.removeItem(SESSION_PIN_KEY);
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="fridge-wrap">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="fridge-card mx-auto flex min-h-[75vh] w-full max-w-2xl items-center justify-center px-6 py-10 text-muted"
        >
          <motion.div 
            animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Warming up your lists...
          </motion.div>
        </motion.div>
      </main>
    );
  }

  if (error || (!activeList && !isCalendarActive)) {
    return (
      <main className="fridge-wrap">
        <section className="fridge-card mx-auto flex min-h-[75vh] w-full max-w-2xl flex-col items-center justify-center gap-5 px-6 py-10 text-center">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Fridgeboard</p>
            <h1 className="text-4xl text-foreground">Something needs a quick fix.</h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted sm:text-base">
              {error || "We could not load your shared lists right now."}
            </p>
          </div>
          <button
            className="rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white"
            onClick={handleResetPin}
            type="button"
          >
            Re-enter PIN
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="fridge-wrap">
      <section className="fridge-card mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-2xl flex-col overflow-hidden">
        <header className="relative overflow-hidden border-b border-border px-5 pb-5 pt-6 sm:px-7">
          <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.32),transparent)]" />
          <div className="relative space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
                  Shared with PIN {pin}
                </p>
                <div>
                  <h1 className="text-4xl text-foreground sm:text-[2.8rem]">Fridgeboard</h1>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted sm:text-base">
                    Keep the kitchen calm. Tap between grocery and to-do, and every change shows up on both phones.
                  </p>
                </div>
              </div>

              <button
                className="rounded-full border border-border bg-white/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-muted transition hover:bg-white"
                onClick={handleResetPin}
                type="button"
              >
                Change PIN
              </button>
            </div>

            <div className="flex gap-2 rounded-full border border-border/50 bg-white/40 p-1.5 backdrop-blur-md">
              {lists.map((list) => {
                const active = !isCalendarActive && list.id === activeList?.id;
                const tone = tabTone[list.name] ?? "bg-white text-foreground";

                return (
                  <button
                    key={list.id}
                    className={`relative rounded-full px-5 py-2.5 text-sm font-bold transition sm:text-base ${
                      active ? "text-foreground shadow-sm" : "text-muted hover:text-foreground"
                    }`}
                    onClick={() => setActiveListId(list.id)}
                    type="button"
                  >
                    {active && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className={`absolute inset-0 rounded-full ${tone}`}
                        style={{ zIndex: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{list.name}</span>
                  </button>
                );
              })}

              <button
                className={`relative rounded-full px-5 py-2.5 text-sm font-bold transition sm:text-base ${
                  isCalendarActive ? "text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
                onClick={() => setActiveListId(CALENDAR_TAB_ID)}
                type="button"
              >
                {isCalendarActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className={`absolute inset-0 rounded-full ${tabTone["Calendar"]}`}
                    style={{ zIndex: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Calendar</span>
              </button>
            </div>
          </div>
        </header>

        <div className="relative flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={isCalendarActive ? CALENDAR_TAB_ID : activeList!.id}
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              {isCalendarActive ? (
                <CalendarTab pin={pin} />
              ) : (
                <ListTab list={activeList!} pin={pin} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
