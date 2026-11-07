"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { AddItemInput, type RoutineChoice } from "@/components/AddItemInput";
import { ItemRow } from "@/components/ItemRow";
import { RoutineRow } from "@/components/RoutineRow";
import { SuggestionPanel } from "@/components/SuggestionPanel";
import { useHousehold, useListData } from "@/components/WorkspaceData";
import { WhoIsAdding } from "@/components/WhoIsAdding";
import { useKitchenEnabled } from "@/hooks/useKitchenDisplay";
import { useNow } from "@/hooks/useAmbient";
import { guessRoutine, sortRoutines } from "@/lib/routine";
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
    markDone,
    restoreDone,
    setRoutine,
    connected,
    retry,
  } = useListData(list.id);

  const kitchen = useKitchenEnabled();
  const { adderId } = useHousehold();
  // On the kitchen display, credit the member picked in "Who's adding?".
  const credit = kitchen ? adderId : null;
  const add = (text: string, routine: RoutineChoice = null) => addItem(text, credit, routine);
  const isGrocery = list.name === "Grocery";
  // Re-render each minute so "Today" turns into "Yesterday" overnight.
  const now = useNow(60_000);

  const oneOffs = useMemo(() => items.filter((i) => !i.is_routine), [items]);
  const routines = useMemo(
    () => sortRoutines(items.filter((i) => i.is_routine), now),
    [items, now],
  );

  const openCount = useMemo(
    () => items.filter((i) => !i.is_checked && !i.is_routine).length,
    [items],
  );

  const existingItemTexts = useMemo(
    () => items.filter((i) => !i.is_checked).map((i) => i.text),
    [items],
  );

  return (
    <section className="note-panel flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/80 px-4 pb-3 pt-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl text-foreground sm:text-[1.7rem]">
            {isGrocery ? "What do we need?" : "What still needs doing?"}
          </h2>
          {openCount > 0 && (
            <span className="pill" aria-label={`${openCount} ${isGrocery ? "to buy" : "to do"}`}>
              {openCount} {isGrocery ? "to buy" : "to do"}
            </span>
          )}
        </div>

        {kitchen && <WhoIsAdding />}
        <div className="mt-3">
          <AddItemInput
            inputId={`list-input-${list.id}`}
            allowRoutine={!isGrocery}
            busy={isWorking}
            buttonLabel={list.name === "Grocery" ? "Add item" : "Add task"}
            existingItems={existingItemTexts}
            listName={list.name}
            onAdd={add}
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
          onAddItem={add}
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
            {oneOffs.map((item) => (
              <ItemRow
                busy={isWorking}
                item={item}
                key={item.id}
                onDelete={removeItem}
                onToggle={toggleItem}
                onMakeRoutine={
                  isGrocery || item.is_checked
                    ? undefined
                    : (target) =>
                        setRoutine(target, { repeatDays: guessRoutine(target.text)?.days ?? null })
                }
              />
            ))}
          </AnimatePresence>
        </div>

        {routines.length > 0 && (
          <section aria-labelledby={`routines-${list.id}`} className="mt-6">
            <div className="mb-2.5 px-1">
              <h3
                className="text-xs font-bold uppercase tracking-[0.22em] text-muted"
                id={`routines-${list.id}`}
              >
                Routines
              </h3>
              <p className="text-sm text-muted">
                When was it last done? Tick it each time it&rsquo;s done again.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {routines.map((item) => (
                  <RoutineRow
                    busy={isWorking}
                    item={item}
                    key={item.id}
                    now={now}
                    onDelete={removeItem}
                    onDone={(target) => markDone(target, credit)}
                    onRestore={restoreDone}
                    onSchedule={setRoutine}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
