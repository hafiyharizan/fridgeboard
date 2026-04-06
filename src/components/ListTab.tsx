"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { AddItemInput } from "@/components/AddItemInput";
import { ItemRow } from "@/components/ItemRow";
import { SuggestionPanel } from "@/components/SuggestionPanel";
import { useRealtimeItems } from "@/hooks/useRealtimeItems";
import type { FridgeList } from "@/lib/types";

type ListTabProps = {
  list: FridgeList;
  pin: string;
};

export function ListTab({ list, pin }: ListTabProps) {
  const {
    addItem,
    error,
    isWorking,
    items,
    loading,
    removeItem,
    toggleItem,
  } = useRealtimeItems(list.id);

  const existingItemTexts = useMemo(
    () => items.filter((i) => !i.is_checked).map((i) => i.text),
    [items],
  );

  return (
    <section className="note-panel flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/80 px-4 pb-4 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">{list.name} list</p>
            <h2 className="text-3xl text-foreground sm:text-[2.2rem]">
              {list.name === "Grocery" ? "What do we need?" : "What still needs doing?"}
            </h2>
          </div>
          <div className="rounded-full bg-white/80 px-3 py-2 text-right text-xs uppercase tracking-[0.18em] text-muted">
            Household PIN {pin}
          </div>
        </div>

        <div className="mt-4">
          <AddItemInput
            busy={isWorking}
            buttonLabel={list.name === "Grocery" ? "Add item" : "Add task"}
            existingItems={existingItemTexts}
            listName={list.name}
            onAdd={addItem}
            placeholder={list.name === "Grocery" ? "Milk, scallions, pasta..." : "Call plumber, water plants..."}
          />
        </div>
      </div>

      <div className="border-b border-border/50 px-4 py-3 sm:px-5">
        <SuggestionPanel
          existingItems={existingItemTexts}
          listName={list.name}
          onAddItem={addItem}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3 sm:px-4">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted">
            Syncing the latest changes...
          </div>
        ) : null}

        {!loading && !items.length ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center">
            <h3 className="text-2xl text-foreground">Nothing here yet.</h3>
            <p className="max-w-xs text-sm leading-6 text-muted">
              Add the first {list.name === "Grocery" ? "grocery item" : "to-do"} and it will show up on both phones right away.
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <ItemRow
                busy={isWorking}
                item={item}
                key={item.id}
                onDelete={removeItem}
                onToggle={toggleItem}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {error ? (
        <div className="border-t border-border bg-danger/8 px-4 py-3 text-sm text-danger sm:px-5">
          {error}
        </div>
      ) : null}
    </section>
  );
}
