"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import {
  DEFAULT_FLASHCARD_VISIBILITY,
  FLASHCARD_VISIBILITY_STORAGE_KEY,
  normalizeFlashcardVisibility,
  serializeFlashcardVisibility,
  toggleFlashcardVisibility,
  type FlashcardVisibility,
  type FlashcardVisibilitySetting,
} from "@/lib/flashcard-visibility";

// Device-local flashcard display preference. Like tone colors / hanzi size, this
// is deliberately NOT ProgressState: it is a UI preference, not learning data.
// SSR and first client render both use defaults, then localStorage hydrates after
// mount through useSyncExternalStore, avoiding hydration mismatch.
let visibility: FlashcardVisibility = DEFAULT_FLASHCARD_VISIBILITY;
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): FlashcardVisibility {
  try {
    return normalizeFlashcardVisibility(window.localStorage.getItem(FLASHCARD_VISIBILITY_STORAGE_KEY));
  } catch {
    return DEFAULT_FLASHCARD_VISIBILITY;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    visibility = readStored();
  }
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== FLASHCARD_VISIBILITY_STORAGE_KEY) return;
    visibility = readStored();
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): FlashcardVisibility {
  return visibility;
}

function getServerSnapshot(): FlashcardVisibility {
  return DEFAULT_FLASHCARD_VISIBILITY;
}

function setStored(next: FlashcardVisibility): void {
  visibility = next;
  try {
    window.localStorage.setItem(FLASHCARD_VISIBILITY_STORAGE_KEY, serializeFlashcardVisibility(next));
  } catch {
    // Storage blocked — in-memory preference still works for this tab.
  }
  emit();
}

export function useFlashcardVisibility(): {
  visibility: FlashcardVisibility;
  toggle: (key: FlashcardVisibilitySetting) => void;
} {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    visibility: value,
    toggle: (key) => {
      const next = toggleFlashcardVisibility(value, key);
      setStored(next);
      track("flashcard_visibility_changed", { key, enabled: next[key] });
    },
  };
}
