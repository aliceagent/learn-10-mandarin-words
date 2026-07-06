// Pure playback-rate helpers for the MP4 video player, kept DOM-free so they can
// be unit-tested without rendering (mirrors src/lib/video.ts). The client
// component imports these and applies them to a <video> element via a ref.

/**
 * localStorage key for the device-local default video playback rate. Shared by
 * the in-video pills (src/components/video-player.tsx) and the Settings page's
 * "Lesson video speed" control, so both read/write the exact same preference.
 * Kept here — beside normalizeRate — rather than in the component so it can't
 * drift between the two call sites.
 */
export const RATE_STORAGE_KEY = "learn-10-mandarin-video-rate";

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export const DEFAULT_RATE: PlaybackRate = 1;

// Coerce any unknown or persisted value (which may be a string from
// localStorage, out of range, or garbage) to a supported playback rate.
// Falls back to DEFAULT_RATE when the value isn't one we offer.
export function normalizeRate(value: unknown): PlaybackRate {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num === "number" && Number.isFinite(num)) {
    const match = PLAYBACK_RATES.find((rate) => rate === num);
    if (match) return match;
  }
  return DEFAULT_RATE;
}

// Display label for a rate pill, e.g. 0.75 -> "0.75×", 1 -> "1×".
export function rateLabel(rate: number): string {
  return `${rate}×`;
}
