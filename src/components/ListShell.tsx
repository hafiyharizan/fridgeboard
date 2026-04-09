"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { CalendarTab } from "@/components/CalendarTab";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ListTab } from "@/components/ListTab";
import { clearSessionPin, setSessionPin } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { FridgeList } from "@/lib/types";
import { ensureUserProfile, getUserDisplayName } from "@/lib/user-profile";

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
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authUser, setAuthUser] = useState<{ name: string; avatar: string | null } | null>(null);

  useEffect(() => {
    const loadLists = async (pinCode: string) => {
      const { data, error: fetchError } = await supabase
        .from("lists")
        .select("*")
        .eq("pin_code", pinCode)
        .order("created_at", { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
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

    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          clearSessionPin();
          router.replace("/");
          return;
        }

        const profile = await ensureUserProfile(supabase, user);
        setAuthUser({
          name: getUserDisplayName(user, profile),
          avatar: profile.avatar_url,
        });

        if (!profile.pin_code) {
          clearSessionPin();
          router.replace("/setup-household");
          return;
        }

        setPin(profile.pin_code);
        setSessionPin(profile.pin_code);
        await loadLists(profile.pin_code);
      } catch (initError) {
        setError(initError instanceof Error ? initError.message : "Could not load your account.");
        setLoading(false);
      }
    };

    void init();
  }, [router, supabase]);

  const isCalendarActive = activeListId === CALENDAR_TAB_ID;
  const activeList = isCalendarActive ? null : (lists.find((list) => list.id === activeListId) ?? lists[0]);

  const handleResetPin = async () => {
    clearSessionPin();
    await supabase.auth.signOut();
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
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(60, 40, 20, 0.16)" }}
            whileTap={{ scale: 0.98 }}
            className="cursor-pointer rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#2f241b]"
            onClick={handleResetPin}
            type="button"
          >
            Back to sign in
          </motion.button>
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
            <div className="flex flex-col gap-4 pr-14 sm:flex-row sm:items-start sm:justify-between sm:pr-0">
              <div className="min-w-0 flex-1 space-y-2">
                {authUser ? (
                  <div className="flex min-w-0 items-center gap-2">
                    {authUser.avatar ? (
                      <Image
                        alt=""
                        className="rounded-full"
                        height={24}
                        referrerPolicy="no-referrer"
                        src={authUser.avatar}
                        width={24}
                      />
                    ) : null}
                    <p className="min-w-0 text-xs font-bold uppercase tracking-[0.18em] text-muted">
                      {authUser.name}
                    </p>
                  </div>
                ) : null}
                <div>
                  <h1 className="text-4xl text-foreground sm:text-[2.8rem]">Fridgeboard</h1>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted sm:text-base">
                    Keep the kitchen calm. Tap between grocery and to-do, and every change shows up for all family members.
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ y: -1, boxShadow: "0 8px 20px rgba(95, 65, 36, 0.08)" }}
                whileTap={{ scale: 0.98 }}
                className="absolute right-0 top-0 inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border bg-white/70 p-2.5 text-muted transition-all duration-200 hover:bg-white hover:text-foreground sm:static sm:w-fit sm:justify-start sm:px-3 sm:py-2"
                onClick={handleResetPin}
                title="Sign out"
                type="button"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden whitespace-nowrap text-xs font-bold uppercase tracking-[0.18em] sm:inline">
                  Sign out
                </span>
              </motion.button>
            </div>

            <div className="flex gap-2 rounded-full border border-border/50 bg-white/40 p-1.5 backdrop-blur-md">
              {lists.map((list) => {
                const active = !isCalendarActive && list.id === activeList?.id;
                const tone = tabTone[list.name] ?? "bg-white text-foreground";

                return (
                  <motion.button
                    key={list.id}
                    whileHover={active ? undefined : { y: -1, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 sm:text-base ${
                      active ? "text-foreground shadow-sm" : "text-muted hover:bg-white/70 hover:text-foreground"
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
                  </motion.button>
                );
              })}

              <motion.button
                whileHover={isCalendarActive ? undefined : { y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={`relative cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 sm:text-base ${
                  isCalendarActive ? "text-foreground shadow-sm" : "text-muted hover:bg-white/70 hover:text-foreground"
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
              </motion.button>
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
      <InstallPrompt />
    </main>
  );
}
