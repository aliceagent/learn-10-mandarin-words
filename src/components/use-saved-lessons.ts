"use client";

import { useEffect, useState } from "react";
import { listSavedLessons, supportsCacheStorage } from "@/lib/offline";

// Shared saved-offline state so every surface — the save button, the library
// cards, and the /offline panel — reads the same source of truth and stays in
// sync without prop drilling or a reload. The set holds the MP4 URLs currently
// stored in the dedicated video cache.

/** Window event dispatched whenever the saved-lessons set changes. */
export const SAVED_LESSONS_EVENT = "learn10:saved-lessons-changed";

/** Announce that the saved lessons changed. Call after any successful save or
 *  remove so every mounted `useSavedLessons()` re-reads Cache Storage. No-op on
 *  the server. */
export function notifySavedLessonsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SAVED_LESSONS_EVENT));
}

/** The set of MP4 URLs currently saved for offline playback. Empty during SSR and
 *  where Cache Storage is unavailable; loads once on mount and re-loads whenever
 *  `notifySavedLessonsChanged()` fires. Mirrors the browser-only effect pattern in
 *  save-offline-button.tsx. */
export function useSavedLessons(): ReadonlySet<string> {
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!supportsCacheStorage()) return;
    let active = true;
    async function load() {
      try {
        const urls = await listSavedLessons();
        if (active) setSaved(new Set(urls));
      } catch {
        // Reading the cache failed — keep the last known set rather than clearing.
      }
    }
    load();
    window.addEventListener(SAVED_LESSONS_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(SAVED_LESSONS_EVENT, load);
    };
  }, []);

  return saved;
}
