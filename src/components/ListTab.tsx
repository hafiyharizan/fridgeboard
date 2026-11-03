"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { AddItemInput } from "@/components/AddItemInput";
import { ItemRow } from "@/components/ItemRow";
import { SuggestionPanel } from "@/components/SuggestionPanel";
import { useListData } from "@/components/WorkspaceData";
import { DataStatus } from "@/components/HomeDashboard";
import type { FridgeList } from "@/lib/types";

type ListTabProps = {
  list: FridgeList;
};

export function ListTab({ list }: ListTabProps) {
  const {
    addItem,
    error,
    isWorking,
    items,
    loading,
    removeItem,
    toggleItem,
    connected,
    retry,
  } = useListData(list.id);

  const existingItemTexts = useMemo(
    () => items.filter((i) => !i.is_checked).map((i) => i.text),
    [items],
  );

  return (
    <section className="note-panel flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/80 px-4 pb-4 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
              {list.name} list
            </p>
            <h2 className="text-3xl text-foreground sm:text-[2.2rem]">
              {list.name === "Grocery"
                ? "What do we need?"
                : "What still needs doing?"}
            </h2>
          </div>
        </div>

        <div className="mt-4">
          <AddItemInput
            inputId={`list-input-${list.id}`}
            busy={isWorking}
            buttonLabel={list.name === "Grocery" ? "Add item" : "Add task"}
            existingItems={existingItemTexts}
            listName={list.name}
            onAdd={addItem}
            placeholder={
              list.name === "Grocery"
                ? "Milk, scallions, pasta..."
                : "Call plumber, water plants..."
            }
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

      <DataStatus
        retry={retry}
        loading={false}
        error={error}
        connected={connected}
      />
      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3 sm:px-4">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted">
            Syncing the latest changes...
          </div>
        ) : null}

        {!loading && !error && !items.length ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center">
            <h3 className="text-2xl text-foreground">Nothing here yet.</h3>
            <p className="max-w-xs text-sm leading-6 text-muted">
              Add the first {list.name === "Grocery" ? "grocery item" : "to-do"}{" "}
              and everyone in your household can see it here.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5">
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
    </section>
  );
}
