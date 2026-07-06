"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_HANZI_SIZE,
  HANZI_SIZE_STORAGE_KEY,
  normalizeHanziSize,
  serializeHanziSize,
  type HanziSize,
} from "@/lib/hanzi-size";
import { track } from "@/lib/analytics";

// Device-local "Hanzi size" preference (Sprint 22). A single module-level store
// backs every hanzi render site and the segmented control, so picking a size
// once re-renders every character prompt in sync with zero prop threading.
//
// Persistence is localStorage-only under its own key — NOT ProgressState — so it
// never touches progress export/import. Subscribed via useSyncExternalStore with
// a "standard" server snapshot: SSR and the first client render both paint the
// current sizes, and the chosen size applies after hydration, so there is no
// hydration mismatch (same approach as use-tone-colors.ts). All storage access
// is try/catch wrapped for private-mode safety.

let size: HanziSize = DEFAULT_HANZI_SIZE;
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): HanziSize {
  try {
    return normalizeHanziSize(window.localStorage.getItem(HANZI_SIZE_STORAGE_KEY));
  } catch {
    return DEFAULT_HANZI_SIZE;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  // Hydrate from localStorage on the first subscription (post-mount, so the
  // server snapshot stayed "standard" and the first paint matched it). React
  // re-reads getSnapshot right after subscribe and re-renders if this changed.
  if (!hydrated) {
    hydrated = true;
    size = readStored();
  }
  listeners.add(listener);

  // Keep other tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== HANZI_SIZE_STORAGE_KEY) return;
    const next = readStored();
    if (next !== size) {
      size = next;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): HanziSize {
  return size;
}

function getServerSnapshot(): HanziSize {
  return DEFAULT_HANZI_SIZE;
}

function setStored(next: HanziSize): void {
  if (next === size) return;
  size = next;
  try {
    window.localStorage.setItem(HANZI_SIZE_STORAGE_KEY, serializeHanziSize(next));
  } catch {
    // Storage blocked (private mode) — the in-memory value still drives this tab.
  }
  emit();
}

export function useHanziSize(): { size: HanziSize; setSize: (next: HanziSize) => void } {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setSize = (next: HanziSize) => {
    setStored(next);
    track("hanzi_size_changed", { size: next });
  };
  return { size: value, setSize };
}
