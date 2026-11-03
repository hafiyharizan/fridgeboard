// Kitchen display mode: rules for a tablet that stays on all day.
// Pure functions only, so they can be unit tested.

/** localStorage key; kitchen mode is a per-device setting. */
export const KITCHEN_MODE_KEY = "fridgeboard.kitchen-mode";

/** Untouched for this long → close dialogs and go back to Home. */
export const KITCHEN_IDLE_MS = 2 * 60 * 1000;

/** How often to look for a new deploy. */
export const VERSION_CHECK_MS = 15 * 60 * 1000;

/** Hidden longer than this → start a fresh realtime connection on return. */
export const STALE_CONNECTION_MS = 5 * 60 * 1000;

/** Hold the settings button this long to open it in kitchen mode. */
export const SETTINGS_HOLD_MS = 1200;

export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;

/** Night runs across midnight: 22:00 up to (not including) 06:00. */
export function isNightTime(date: Date, start = NIGHT_START_HOUR, end = NIGHT_END_HOUR): boolean {
  const hour = date.getHours();
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/**
 * Small layout shift that changes every 10 minutes, so a static clock and
 * header don't burn into the screen. Cycles through ±3px offsets.
 */
export function burnInOffset(date: Date): { x: number; y: number } {
  const steps = [
    { x: 0, y: 0 },
    { x: 3, y: 1 },
    { x: 1, y: 3 },
    { x: -2, y: 2 },
    { x: -3, y: -1 },
    { x: -1, y: -3 },
    { x: 2, y: -2 },
  ];
  const slot = Math.floor(date.getTime() / (10 * 60 * 1000));
  return steps[slot % steps.length];
}

/**
 * "Live" while connected (a quiet household gets no updates, which isn't
 * staleness). Once the connection drops: "Synced 4 min ago" and so on.
 */
export function describeSync(connected: boolean, syncedAt: number | null, now: number): string {
  if (connected) return "Live";
  if (syncedAt === null) return "Connecting…";
  const minutes = Math.floor((now - syncedAt) / 60_000);
  const age =
    minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
  return `Synced ${age}`;
}

/** Reload only when both versions are known and differ ("dev" builds never reload). */
export function isNewVersion(current: string, latest: unknown): boolean {
  return (
    typeof latest === "string" &&
    latest.length > 0 &&
    current !== "dev" &&
    latest !== "dev" &&
    latest !== current
  );
}

/** Window event that asks every open overlay to close (kitchen idle reset). */
export const DISMISS_OVERLAYS_EVENT = "fridgeboard:dismiss-overlays";
