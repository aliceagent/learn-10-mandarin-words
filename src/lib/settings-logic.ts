// Pure, DOM-free helpers for the /settings page (Sprint 17). The Settings page
// only consolidates preferences that already live in their own modules, so this
// file holds just the small amount of *new* pure logic that page needs — the
// speech-status copy, the import-file validation, and the export filename.
// Kept here (mirroring src/lib/tone-colors.ts) so it is unit-testable under
// `node --test` without rendering. The React glue lives in
// src/components/settings-app.tsx.

import type { SpeechSupport } from "./speech.ts";
import type { ProgressState } from "./types.ts";
import { normalizeProgress } from "./progress-logic.ts";

/**
 * Map the four `SpeechSupport` states to user-facing copy for the Audio section's
 * Mandarin-voice status row. `tone` drives the dot color: `ok` (green, a voice is
 * ready), `warn` (amber, actionable — no Chinese voice installed), or `muted`
 * (neutral — still checking, or the browser has no speech API to act on).
 */
export function describeSpeechSupport(
  status: SpeechSupport,
): { label: string; detail: string; tone: "ok" | "warn" | "muted" } {
  switch (status) {
    case "ready":
      return {
        label: "Mandarin voice ready",
        detail: "Your device has a Chinese voice for pronunciations.",
        tone: "ok",
      };
    case "no-chinese-voice":
      return {
        label: "No Mandarin voice installed",
        detail: "Add a Chinese voice in your system settings to hear pronunciations.",
        tone: "warn",
      };
    case "unsupported":
      return {
        label: "Speech isn't supported in this browser",
        detail: "Try a different browser to hear word pronunciations.",
        tone: "muted",
      };
    case "loading":
    default:
      return {
        label: "Checking voices…",
        detail: "Looking for a Mandarin voice on this device.",
        tone: "muted",
      };
  }
}

/** Friendly message shown when an uploaded file can't be read as a progress export. */
export const INVALID_PROGRESS_FILE_ERROR = "That file isn't a valid progress export.";

/**
 * Parse + sanitize an uploaded progress file. NEVER throws — a parse failure is
 * reported as `{ ok: false }` with a friendly message, and any successfully
 * parsed JSON (object, array, or `null`) is run through `normalizeProgress`,
 * which repairs/defaults every field, so garbage-but-parseable input becomes a
 * safe empty progress state rather than an error. This mirrors the tolerance of
 * the existing import path (use-progress.ts) while replacing its bare throw with
 * a value the Settings UI can turn into a toast.
 */
export function validateProgressFile(
  json: string,
): { ok: true; state: ProgressState } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: INVALID_PROGRESS_FILE_ERROR };
  }
  return { ok: true, state: normalizeProgress(parsed as Partial<ProgressState>) };
}

/**
 * Name for the downloaded progress export, e.g.
 * `progressExportFilename("2026-07-06")` → `"mandarin-progress-2026-07-06.json"`.
 * Extracted so the filename is unit-tested and shared by the home-card export and
 * the Settings export (identical output to the previous inline template).
 */
export function progressExportFilename(day: string): string {
  return `mandarin-progress-${day}.json`;
}
