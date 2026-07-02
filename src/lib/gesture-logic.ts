// Pure, DOM-free helpers for the flashcard fling/drag gestures (Sprint 9).
// Kept out of the hook/components so the thresholds and transform math are
// unit-testable without a DOM. The card surfaces layer touch state on top.

/** Horizontal distance (px) a drag must travel to register as a fling grade. */
export const FLING_THRESHOLD_PX = 80;

/** What a released drag means: fling right = "easy", fling left = "again". */
export type FlingIntent = "again" | "easy" | null;

/**
 * Classify a released horizontal drag.
 * `dx >= threshold` → "easy"; `dx <= -threshold` → "again"; otherwise null.
 * Boundaries are inclusive: flingIntent(80) === "easy", flingIntent(-80) === "again".
 */
export function flingIntent(dx: number, threshold: number = FLING_THRESHOLD_PX): FlingIntent {
  if (dx >= threshold) return "easy";
  if (dx <= -threshold) return "again";
  return null;
}

/**
 * CSS transform for a card following the thumb: translateX(dx) plus a slight
 * rotation of `dx * 0.06` degrees, clamped to ±12deg.
 * dragTransform(0) === "translateX(0px) rotate(0deg)"; dragTransform(500) clamps to 12deg.
 */
export function dragTransform(dx: number): string {
  const deg = Math.max(-12, Math.min(12, dx * 0.06));
  return `translateX(${dx}px) rotate(${deg}deg)`;
}
