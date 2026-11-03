import { STALE_CONNECTION_MS } from "@/lib/kitchen";

/**
 * Calls `refresh` when the page becomes visible again, or `reconnect` instead
 * if it was hidden long enough for the realtime socket to have died quietly
 * (tablets and phones often suspend it while asleep). Returns a cleanup.
 */
export function watchWake(refresh: () => void, reconnect: () => void): () => void {
  let hiddenAt: number | null = document.hidden ? Date.now() : null;
  const onVisibility = () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away > STALE_CONNECTION_MS) reconnect();
    else refresh();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}
