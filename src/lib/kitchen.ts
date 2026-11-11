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

/** localStorage keys for the idle-view options (per device). */
export const IDLE_DIM_KEY = "fridgeboard.idle-dim";
export const SLIDESHOW_KEY = "fridgeboard.idle-slideshow";

/** Seconds each photo stays up in the idle slideshow. */
export const SLIDE_SECONDS = 30;

/** Stored flags are "1" / "0"; anything else (or nothing) uses the fallback. */
export function parseFlag(raw: string | null, fallback: boolean): boolean {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return fallback;
}

/** Next photo index, wrapping; 0 when there is nothing to rotate. */
export function nextSlide(index: number, count: number): number {
  return count <= 1 ? 0 : (index + 1) % count;
}

/**
 * Strength of the dark overlay on the idle view (a browser can't change real
 * brightness). Fully black while the screen is meant to be off.
 */
export function idleDimOpacity(night: boolean, asleep = false): number {
  if (asleep) return 1;
  return night ? 0.75 : 0.55;
}

/** A daily window as "HH:MM" clock times; an end before the start runs past midnight. */
export type Hours = { start: string; end: string };

/** localStorage keys for the night look and overnight screen-off (per device). */
export const NIGHT_HOURS_KEY = "fridgeboard.night-hours";
export const SLEEP_KEY = "fridgeboard.screen-sleep";
export const SLEEP_HOURS_KEY = "fridgeboard.sleep-hours";

/** The idle view's dark look. */
export const DEFAULT_NIGHT_HOURS: Hours = { start: "22:00", end: "06:00" };
/** When the tablet may switch its screen off. */
export const DEFAULT_SLEEP_HOURS: Hours = { start: "23:00", end: "05:30" };

/** Minutes since midnight for a strict 24-hour "HH:MM"; null for anything else. */
export function clockMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Stored as "22:00-06:00". Anything unreadable uses the fallback. */
export function parseHours(raw: string | null, fallback: Hours): Hours {
  const [start, end, extra] = (raw ?? "").split("-");
  if (extra !== undefined || !start || !end) return fallback;
  if (clockMinutes(start) === null || clockMinutes(end) === null) return fallback;
  return { start, end };
}

export function formatHours(hours: Hours): string {
  return `${hours.start}-${hours.end}`;
}

/**
 * Whether `date` (device time) falls in the window: from the start up to, not
 * including, the end. Equal start and end is an empty window, never "all day".
 */
export function inHours(date: Date, hours: Hours): boolean {
  const start = clockMinutes(hours.start);
  const end = clockMinutes(hours.end);
  if (start === null || end === null || start === end) return false;
  const clock = date.getHours() * 60 + date.getMinutes();
  return start < end ? clock >= start && clock < end : clock >= start || clock < end;
}

/**
 * Overnight screen-off: only while nobody is using the screen, so a touch
 * during the window keeps it on until the next idle reset.
 */
export function shouldSleep(state: { enabled: boolean; idle: boolean; now: Date; hours: Hours }): boolean {
  return state.enabled && state.idle && inHours(state.now, state.hours);
}
