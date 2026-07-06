// Pure, DOM-free helpers for the opt-in "Vibration" preference (Sprint 18).
// This is a device-local UI preference — persisted under its own localStorage
// key, NOT part of ProgressState — mirroring the tone-colors pattern in
// src/lib/tone-colors.ts. Kept DOM-free (no navigator/window access) so the
// coercion logic and vibration patterns are unit-testable under `node --test`
// without a browser; the actual navigator.vibrate call lives in use-haptics.ts.

/** localStorage key for the device-local haptics preference. */
export const HAPTICS_STORAGE_KEY = "learn-10-mandarin-haptics";

/** Which answer outcome a vibration pulse represents. */
export type HapticKind = "correct" | "incorrect";

/**
 * Vibration patterns passed straight to `navigator.vibrate`. Each array is a
 * sequence of millisecond durations alternating vibrate/pause, starting with a
 * vibrate. Correct is a single crisp 20ms tick; incorrect is a distinct
 * double-buzz (40ms on, 60ms off, 40ms on) so the two are clearly
 * distinguishable by feel without looking at the screen.
 */
export const HAPTIC_PATTERNS: Record<HapticKind, readonly number[]> = {
  correct: [20],
  incorrect: [40, 60, 40],
};

/**
 * Coerce any stored/unknown value to the boolean setting. Only the exact string
 * "on" enables haptics; everything else (including `null` when nothing was ever
 * stored, other strings, numbers, and non-strings) reads as off. This keeps the
 * default off and tolerates a garbage or legacy localStorage value.
 */
export function normalizeHapticsSetting(value: unknown): boolean {
  return value === "on";
}

/** Serialize the setting for localStorage. */
export function serializeHapticsSetting(enabled: boolean): "on" | "off" {
  return enabled ? "on" : "off";
}
