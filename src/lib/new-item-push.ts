import type { PushPayload } from "@/lib/push";

/** Items older than this are not announced (stops replaying old items). */
export const NEW_ITEM_PUSH_WINDOW_MS = 10 * 60 * 1000;

const MAX_TEXT_LENGTH = 120;

/** "Hafiy Harizan" → "Hafiy", "sam@example.com" → "sam". */
export function shortName(displayName: string): string {
  const trimmed = displayName.trim();
  const base = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed.split(/\s+/)[0];
  return base || "Someone";
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_TEXT_LENGTH ? `${flat.slice(0, MAX_TEXT_LENGTH - 1)}…` : flat;
}

/**
 * One notification per list: the tag makes a burst of additions replace each
 * other on the lock screen instead of stacking up.
 */
export function buildNewItemPush(input: {
  adderName: string;
  itemText: string;
  listId: string;
  listName: string;
}): PushPayload {
  return {
    title: input.listName,
    body: `${shortName(input.adderName)} added ${clip(input.itemText)}`,
    tag: `new-item-${input.listId}`,
    url: "/list",
  };
}

export function isRecentItem(createdAt: string, now: Date = new Date()): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created <= NEW_ITEM_PUSH_WINDOW_MS;
}
