/** localStorage key holding when the install banner was dismissed, or "installed". */
export const INSTALL_PROMPT_KEY = "fridgeboard.install-prompt";

/** How long "Not now" hides the banner. */
export const INSTALL_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * iPhone and iPad have no install API, so they get written instructions.
 * iPadOS reports itself as a Mac; touch support tells them apart.
 */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Whether a stored dismissal should still hide the banner. */
export function isInstallPromptHidden(stored: string | null, now: number = Date.now()): boolean {
  if (!stored) return false;
  if (stored === "installed") return true;
  const dismissedAt = Number(stored);
  return Number.isFinite(dismissedAt) && now - dismissedAt < INSTALL_SNOOZE_MS;
}
