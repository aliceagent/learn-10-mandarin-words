// Pure, DOM-free helpers for the opt-in "Tone colors" preference (Sprint 10).
// This is a device-local UI preference — persisted under its own localStorage
// key, NOT part of ProgressState — mirroring the video playback-rate pattern in
// src/lib/video-controls.ts. Kept here so the coercion + class-mapping logic is
// unit-testable under `node --test` without rendering.

import type { Tone } from "./pinyin.ts";

/** localStorage key for the device-local tone-colors preference. */
export const TONE_COLORS_STORAGE_KEY = "learn-10-mandarin-tone-colors";

/**
 * Coerce any stored/unknown value to the boolean setting. Only the exact string
 * "on" enables tone colors; everything else (including `null` when nothing was
 * ever stored, other strings, numbers, and non-strings) reads as off. This keeps
 * the default off and tolerates a garbage or legacy localStorage value.
 */
export function normalizeToneColorsSetting(value: unknown): boolean {
  return value === "on";
}

/** Serialize the setting for localStorage. */
export function serializeToneColorsSetting(enabled: boolean): "on" | "off" {
  return enabled ? "on" : "off";
}

/**
 * Tone → Tailwind text-color utility (generated from the --color-tone-* tokens
 * in globals.css): 1 red, 2 green, 3 blue, 4 purple, 5/neutral gray.
 */
export const TONE_TEXT_CLASS: Record<Tone, string> = {
  1: "text-tone-1",
  2: "text-tone-2",
  3: "text-tone-3",
  4: "text-tone-4",
  5: "text-tone-5",
};
