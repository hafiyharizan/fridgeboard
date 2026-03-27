"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Item } from "@/lib/types";

const sortItems = (items: Item[]) =>
  [...items].sort((left, right) => {
    if (left.is_checked !== right.is_checked) {
      return left.is_checked ? 1 : -1;
    }

    const leftDate = left.checked_at ?? left.created_at;
    const rightDate = right.checked_at ?? right.created_at;
    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  });

export function useRealtimeItems(listId: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchItems = async () => {
      const { data, error: fetchError } = await supabase
        .from("items")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: false });

      if (!isMounted) {
        return;
      }

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setItems(sortItems((data ?? []) as Item[]));
        setError("");
      }

      setLoading(false);
    };

    void fetchItems();

    const syncFromPayload = (payload: RealtimePostgresChangesPayload<Item>) => {
      setItems((currentItems) => {
        if (payload.eventType === "INSERT") {
          return sortItems([payload.new as Item, ...currentItems.filter((item) => item.id !== payload.new.id)]);
        }

        if (payload.eventType === "UPDATE") {
          return sortItems(
            currentItems.map((item) => (item.id === payload.new.id ? (payload.new as Item) : item)),
          );
        }

        return currentItems.filter((item) => item.id !== payload.old.id);
      });
    };

    const channel = supabase
      .channel(`items:${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `list_id=eq.${listId}`,
        },
        syncFromPayload,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          void fetchItems();
        }

        if (status === "SUBSCRIBED") {
          void fetchItems();
        }
      });

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [listId, supabase]);

  const addItem = async (text: string) => {
    setIsWorking(true);

    const { error: insertError } = await supabase.from("items").insert({
      list_id: listId,
      text,
    });

    setIsWorking(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setError("");
  };

  const toggleItem = async (item: Item) => {
    setIsWorking(true);

    const checked = !item.is_checked;
    const { error: updateError } = await supabase
      .from("items")
      .update({
        is_checked: checked,
        checked_at: checked ? new Date().toISOString() : null,
      })
      .eq("id", item.id);

    setIsWorking(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setError("");
  };

  const removeItem = async (itemId: string) => {
    setIsWorking(true);

    const { error: deleteError } = await supabase.from("items").delete().eq("id", itemId);

    setIsWorking(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setError("");
  };

  return {
    addItem,
    error,
    isWorking,
    items,
    loading,
    removeItem,
    toggleItem,
  };
}
