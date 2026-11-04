"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import { watchWake } from "@/hooks/watchWake";

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

/** Ask the server to alert the rest of the household. Best effort, never blocks. */
function announceNewItem(itemId: string) {
  void fetch("/api/push/new-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
    keepalive: true,
  }).catch((err: unknown) => {
    console.warn("[Push] New item alert failed:", err);
  });
}

export function useRealtimeItems(listId: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [items, setItems] = useState<Item[]>([]);

  const [loading, setLoading] = useState(true);

  const [isWorking, setIsWorking] = useState(false);

  const [error, setError] = useState("");

  const [connected, setConnected] = useState(false);

  const working = useRef(false);
  const [revision, setRevision] = useState(0);
  // When data last matched the server (fetch or live update), for "Synced 3 min ago".
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

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

        setSyncedAt(Date.now());
      }

      setLoading(false);
    };

    void fetchItems();

    const syncFromPayload = (payload: RealtimePostgresChangesPayload<Item>) => {
      setSyncedAt(Date.now());

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

    const stopWatchingWake = watchWake(
      () => void fetchItems(),
      () => setRevision((value) => value + 1),
    );

    return () => {
      window.removeEventListener("online", onOnline);

      window.removeEventListener("offline", onOffline);

      stopWatchingWake();

      isMounted = false;

      void supabase.removeChannel(channel);
    };
  }, [listId, supabase, revision]);

  /** `addedBy`: member credited on a shared device (null = signed-in account). */
  const addItem = async (text: string, addedBy: string | null = null) => {
    if (working.current) return false;

    if (!navigator.onLine) {
      setError("You’re offline. Reconnect and try again.");
      return false;
    }

    working.current = true;

    setIsWorking(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from("items")
        .insert({ list_id: listId, text, ...(addedBy ? { added_by: addedBy } : {}) })
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);

        return false;
      }

      setError("");
      announceNewItem(inserted.id);

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

    syncedAt,
    retry: () => setRevision((value) => value + 1),

    removeItem,

    toggleItem,
  };
}
