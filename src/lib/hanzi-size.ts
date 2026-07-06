// Pure, DOM-free helpers for the opt-in "Hanzi size" preference (Sprint 22).
// This is a device-local UI preference — persisted under its own localStorage
// key, NOT part of ProgressState — mirroring the tone-colors pattern in
// src/lib/tone-colors.ts (which itself mirrors src/lib/video-controls.ts).
// Kept here so the coercion + class-mapping logic is unit-testable under
// `node --test` without rendering.

/** The three character-size levels a learner can pick. */
export type HanziSize = "standard" | "large" | "xl";

/**
 * Render roles for hanzi across practice surfaces. Each role has a base size
 * (its current production size) and scales one text-size step per level.
 */
export type HanziRole = "hero" | "prompt" | "promptSm" | "word" | "sentence" | "tile";

/** localStorage key for the device-local hanzi-size preference. */
export const HANZI_SIZE_STORAGE_KEY = "learn-10-mandarin-hanzi-size";

/** The sizes in ascending order (used to render the segmented control). */
export const HANZI_SIZES: readonly HanziSize[] = ["standard", "large", "xl"];

/** Default = today's sizes; zero visual change until the learner opts in. */
export const DEFAULT_HANZI_SIZE: HanziSize = "standard";

/**
 * Coerce any stored/unknown value to a HanziSize. Only the exact strings
 * "large" and "xl" match; everything else (including `null` when nothing was
 * ever stored, other strings, numbers, and non-strings) reads as "standard".
 * This keeps the default off and tolerates a garbage or legacy localStorage
 * value.
 */
export function normalizeHanziSize(value: unknown): HanziSize {
  return value === "large" || value === "xl" ? value : "standard";
}

/** Serialize the setting for localStorage (the union is already the wire form). */
export function serializeHanziSize(size: HanziSize): HanziSize {
  return size;
}

/** Human-readable label for a size (used by the control's aria copy). */
export function hanziSizeLabel(size: HanziSize): string {
  switch (size) {
    case "large":
      return "Large";
    case "xl":
      return "Extra large";
    default:
      return "Standard";
  }
}

/**
 * role → size → Tailwind text-size utility. FULL literal class strings so the
 * Tailwind JIT compiler emits them (never template-built). The "standard"
 * column equals each role's current production base size, so the default is
 * byte-identical to today; "large"/"xl" bump one text-size step per level.
 */
export const HANZI_SIZE_CLASS: Record<HanziRole, Record<HanziSize, string>> = {
  hero: { standard: "text-7xl", large: "text-8xl", xl: "text-9xl" },
  prompt: { standard: "text-6xl", large: "text-7xl", xl: "text-8xl" },
  promptSm: { standard: "text-5xl", large: "text-6xl", xl: "text-7xl" },
  word: { standard: "text-4xl", large: "text-5xl", xl: "text-6xl" },
  sentence: { standard: "text-3xl", large: "text-4xl", xl: "text-5xl" },
  tile: { standard: "text-2xl", large: "text-3xl", xl: "text-4xl" },
};
