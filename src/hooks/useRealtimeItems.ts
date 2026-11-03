"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

  const [connected, setConnected] = useState(false);

  const working = useRef(false);
  const [revision, setRevision] = useState(0);

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
          return sortItems([
            payload.new as Item,
            ...currentItems.filter((item) => item.id !== payload.new.id),
          ]);
        }

        if (payload.eventType === "UPDATE") {
          return sortItems(
            currentItems.map((item) =>
              item.id === payload.new.id ? (payload.new as Item) : item,
            ),
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
        if (!isMounted) return;

        setConnected(status === "SUBSCRIBED");

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          void fetchItems();
        }

        if (status === "SUBSCRIBED") {
          void fetchItems();
        }
      });

    const onOnline = () => {
      void fetchItems();
    };

    const onOffline = () => setConnected(false);

    window.addEventListener("online", onOnline);

    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);

      window.removeEventListener("offline", onOffline);

      isMounted = false;

      void supabase.removeChannel(channel);
    };
  }, [listId, supabase, revision]);

  const addItem = async (text: string) => {
    if (working.current) return false;

    if (!navigator.onLine) {
      setError("You’re offline. Reconnect and try again.");
      return false;
    }

    working.current = true;

    setIsWorking(true);

    try {
      const { error: insertError } = await supabase.from("items").insert({
        list_id: listId,

        text,
      });

      if (insertError) {
        setError(insertError.message);

        return false;
      }

      setError("");

      return true;
    } catch {
      setError("Could not save your change. Please try again.");

      return false;
    } finally {
      working.current = false;

      setIsWorking(false);
    }
  };

  const toggleItem = async (item: Item) => {
    if (working.current) return false;

    if (!navigator.onLine) {
      setError("You’re offline. Reconnect and try again.");
      return false;
    }

    working.current = true;

    setIsWorking(true);

    try {
      const checked = !item.is_checked;

      const { error: updateError } = await supabase

        .from("items")

        .update({
          is_checked: checked,

          checked_at: checked ? new Date().toISOString() : null,
        })

        .eq("id", item.id);

      if (updateError) {
        setError(updateError.message);

        return false;
      }

      setError("");

      return true;
    } catch {
      setError("Could not save your change. Please try again.");

      return false;
    } finally {
      working.current = false;

      setIsWorking(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (working.current) return false;

    if (!navigator.onLine) {
      setError("You’re offline. Reconnect and try again.");
      return false;
    }

    working.current = true;

    setIsWorking(true);

    try {
      const { error: deleteError } = await supabase
        .from("items")
        .delete()
        .eq("id", itemId);

      if (deleteError) {
        setError(deleteError.message);

        return false;
      }

      setError("");

      return true;
    } catch {
      setError("Could not save your change. Please try again.");

      return false;
    } finally {
      working.current = false;

      setIsWorking(false);
    }
  };

  return {
    addItem,

    error,

    isWorking,

    items,

    loading,

    connected,
    retry: () => setRevision((value) => value + 1),

    removeItem,

    toggleItem,
  };
}
