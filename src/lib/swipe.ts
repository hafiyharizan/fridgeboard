// Swipe rules for the Home card deck (components/SwipeDeck.tsx).

export const SWIPE_OFFSET = 60;
export const SWIPE_VELOCITY = 400;
/** A drag that moved further than this is a swipe, not a tap on a link. */
export const TAP_SLOP = 8;

/**
 * Which way a finished drag turns the deck: 1 = next card (swiped left),
 * -1 = previous (swiped right), 0 = stay. Far enough OR fast enough counts.
 */
export function swipeStep(offsetX: number, velocityX: number): -1 | 0 | 1 {
  if (offsetX <= -SWIPE_OFFSET || velocityX <= -SWIPE_VELOCITY) return 1;
  if (offsetX >= SWIPE_OFFSET || velocityX >= SWIPE_VELOCITY) return -1;
  return 0;
}

/** Index after a step, kept inside the deck. */
export function stepIndex(index: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index + step));
}
