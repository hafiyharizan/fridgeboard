"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTab } from "@/components/ListTab";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { FridgeList } from "@/lib/types";

const SESSION_PIN_KEY = "fridgeboard-pin";

const tabTone: Record<string, string> = {
  Grocery: "bg-amber text-foreground shadow-[inset_0_-2px_0_rgba(200,135,26,0.28)]",
  "To-Do": "bg-blue text-white shadow-[inset_0_-2px_0_rgba(64,119,183,0.35)]",
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

    void loadLists();
  }, [pin, router, supabase]);

  const activeList = lists.find((list) => list.id === activeListId) ?? lists[0];

  const handleResetPin = () => {
    sessionStorage.removeItem(SESSION_PIN_KEY);
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="fridge-wrap">
        <div className="fridge-card mx-auto flex min-h-[75vh] w-full max-w-2xl items-center justify-center px-6 py-10 text-muted">
          Warming up your lists...
        </div>
      </main>
    );
  }

  if (error || !activeList) {
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

            <div className="flex gap-3">
              {lists.map((list) => {
                const active = list.id === activeList.id;
                const tone = tabTone[list.name] ?? "bg-white text-foreground";

                return (
                  <button
                    key={list.id}
                    className={`rounded-full px-5 py-3 text-sm font-bold transition sm:text-base ${active ? tone : "bg-white/70 text-muted hover:bg-white"}`}
                    onClick={() => setActiveListId(list.id)}
                    type="button"
                  >
                    {list.name}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <ListTab list={activeList} pin={pin} />
        </div>
      </section>
    </main>
  );
}
