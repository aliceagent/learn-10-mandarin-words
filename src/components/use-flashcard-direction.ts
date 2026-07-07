"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import {
  DEFAULT_FLASHCARD_DIRECTION,
  FLASHCARD_DIRECTION_STORAGE_KEY,
  normalizeFlashcardDirection,
  serializeFlashcardDirection,
  type FlashcardDirection,
} from "@/lib/flashcard-direction";

let direction: FlashcardDirection = DEFAULT_FLASHCARD_DIRECTION;
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): FlashcardDirection {
  try {
    return normalizeFlashcardDirection(window.localStorage.getItem(FLASHCARD_DIRECTION_STORAGE_KEY));
  } catch {
    return DEFAULT_FLASHCARD_DIRECTION;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    direction = readStored();
  }
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== FLASHCARD_DIRECTION_STORAGE_KEY) return;
    const next = readStored();
    if (next !== direction) {
      direction = next;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): FlashcardDirection {
  return direction;
}

function getServerSnapshot(): FlashcardDirection {
  return DEFAULT_FLASHCARD_DIRECTION;
}

function setStored(next: FlashcardDirection): void {
  if (next === direction) return;
  direction = next;
  try {
    window.localStorage.setItem(FLASHCARD_DIRECTION_STORAGE_KEY, serializeFlashcardDirection(next));
  } catch {
    // Storage blocked — in-memory preference still works for this tab.
  }
  emit();
}

export function useFlashcardDirection(): {
  direction: FlashcardDirection;
  setDirection: (next: FlashcardDirection) => void;
} {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    direction: value,
    setDirection: (next) => {
      setStored(next);
      track("flashcard_direction_changed", { direction: next });
    },
  };
}
