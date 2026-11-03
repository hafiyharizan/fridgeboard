// The last-known board, kept on the device for public/offline.html, which the
// service worker shows if the app can't load (e.g. wifi down after a restart).

export const SNAPSHOT_KEY = "fridgeboard.snapshot";

export type OfflineSnapshot = {
  savedAt: string;
  lists: { name: string; items: string[] }[];
  events: { date: string; time: string | null; title: string }[];
};

export function saveSnapshot(snapshot: OfflineSnapshot) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked: the offline page will just say nothing is saved.
  }
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // Nothing to clear.
  }
}
