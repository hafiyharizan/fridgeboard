"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { ListChecks, ShoppingBasket } from "lucide-react";
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
  const { addItem, error, isWorking, items, loading, removeItem, toggleItem, connected, retry } =
    useListData(list.id);
  const grocery = list.name === "Grocery";

  const open = useMemo(() => items.filter((item) => !item.is_checked), [items]);
  const done = useMemo(() => items.filter((item) => item.is_checked), [items]);
  const existingItemTexts = useMemo(() => open.map((item) => item.text), [open]);

  return (
    <section className="panel list-panel" aria-label={grocery ? "Groceries" : list.name}>
      <div className="list-composer">
        <AddItemInput
          inputId={`list-input-${list.id}`}
          busy={isWorking}
          buttonLabel={grocery ? "Add item" : "Add task"}
          existingItems={existingItemTexts}
          listName={list.name}
          onAdd={addItem}
          placeholder={grocery ? "Add an item" : "Add a task"}
        />
        <SuggestionPanel existingItems={existingItemTexts} listName={list.name} onAddItem={addItem} />
      </div>

      {(error || (!connected && !loading)) && (
        <div className="panel-body pb-0">
          <DataStatus retry={retry} loading={false} error={error} connected={connected} />
        </div>
      )}

      {loading ? (
        <div className="panel-body">
          <DataStatus loading error="" connected rows={5} />
        </div>
      ) : !error && !items.length ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            {grocery ? <ShoppingBasket size={18} /> : <ListChecks size={18} />}
          </span>
          <h3>{grocery ? "The list is empty" : "No tasks yet"}</h3>
          <p>
            Add the first {grocery ? "item" : "task"} above. Everyone in your household sees it
            straight away.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="item-list" aria-label={grocery ? "To get" : "Open tasks"}>
              <AnimatePresence initial={false}>
                {open.map((item) => (
                  <ItemRow busy={isWorking} item={item} key={item.id} onDelete={removeItem} onToggle={toggleItem} />
                ))}
              </AnimatePresence>
            </ul>
          )}
          {!open.length && done.length > 0 && (
            <p className="list-all-done">
              {grocery ? "Everything is in the basket." : "Every task is done."}
            </p>
          )}
          {done.length > 0 && (
            <>
              <div className="list-group-header">
                <h3>{grocery ? "In the basket" : "Done"}</h3>
                <span className="badge">{done.length}</span>
              </div>
              <ul className="item-list is-done" aria-label={grocery ? "In the basket" : "Done"}>
                <AnimatePresence initial={false}>
                  {done.map((item) => (
                    <ItemRow busy={isWorking} item={item} key={item.id} onDelete={removeItem} onToggle={toggleItem} />
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
