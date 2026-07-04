"use client";

import { useSyncExternalStore } from "react";
import {
  TONE_COLORS_STORAGE_KEY,
  normalizeToneColorsSetting,
  serializeToneColorsSetting,
} from "@/lib/tone-colors";
import { track } from "@/lib/analytics";

// Device-local "Tone colors" preference (Sprint 10). A single module-level store
// backs every TonePinyin and the toggle chip, so flipping the setting once
// re-renders every pinyin line in sync with zero prop threading.
//
// Persistence is localStorage-only under its own key — NOT ProgressState — so it
// never touches progress export/import. Subscribed via useSyncExternalStore with
// a `false` server snapshot: SSR and the first client render both paint plain
// pinyin, and colors apply after hydration, so there is no hydration mismatch
// (same approach as use-reduced-motion.ts). All storage access is try/catch
// wrapped for private-mode safety.

let enabled = false;
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return normalizeToneColorsSetting(window.localStorage.getItem(TONE_COLORS_STORAGE_KEY));
  } catch {
    return false;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  // Hydrate from localStorage on the first subscription (post-mount, so the
  // server snapshot stayed false and the first paint matched it). React re-reads
  // getSnapshot right after subscribe and re-renders if this changed the value.
  if (!hydrated) {
    hydrated = true;
    enabled = readStored();
  }
  listeners.add(listener);

  // Keep other tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== TONE_COLORS_STORAGE_KEY) return;
    const next = readStored();
    if (next !== enabled) {
      enabled = next;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  return enabled;
}

function getServerSnapshot(): boolean {
  return false;
}

function setEnabled(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  try {
    window.localStorage.setItem(TONE_COLORS_STORAGE_KEY, serializeToneColorsSetting(next));
  } catch {
    // Storage blocked (private mode) — the in-memory value still drives this tab.
  }
  emit();
}

export function useToneColors(): { enabled: boolean; toggle: () => void } {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    track("tone_colors_toggled", { enabled: next });
  };
  return { enabled: value, toggle };
}
