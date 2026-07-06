"use client";

import { useSyncExternalStore } from "react";
import {
  HAPTICS_STORAGE_KEY,
  HAPTIC_PATTERNS,
  normalizeHapticsSetting,
  serializeHapticsSetting,
  type HapticKind,
} from "@/lib/haptics";
import { track } from "@/lib/analytics";

// Device-local "Vibration" preference (Sprint 18). A single module-level store
// backs the toggle chip and the answer handlers, so flipping the setting once
// applies everywhere with zero prop threading.
//
// Persistence is localStorage-only under its own key — NOT ProgressState — so it
// never touches progress export/import. Subscribed via useSyncExternalStore with
// a `false` server snapshot, so SSR and the first client render agree and the
// real value (plus support detection) appears only after hydration — no
// hydration mismatch (same approach as use-tone-colors.ts / use-reduced-motion.ts).
// All storage access is try/catch wrapped for private-mode safety.

let enabled = false;
let hydrated = false;
const listeners = new Set<() => void>();

// Whether this device can vibrate. Read once at module load: navigator.vibrate
// support is fixed for the page's lifetime, so a static snapshot is enough and
// keeps the support-detection hook cheap.
const supported =
  typeof navigator !== "undefined" && "vibrate" in navigator;

function readStored(): boolean {
  try {
    return normalizeHapticsSetting(window.localStorage.getItem(HAPTICS_STORAGE_KEY));
  } catch {
    return false;
  }
}

// Hydrate the module store from localStorage the first time anything needs the
// real value. Kept separate from `subscribe` so vibrateFeedback can trigger it
// on pages (/daily, /lightning, /practice, /duel) where the toggle is never
// mounted and thus nothing subscribes.
function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  enabled = readStored();
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  // Hydrate on the first subscription (post-mount, so the server snapshot stayed
  // false and the first paint matched it). React re-reads getSnapshot right after
  // subscribe and re-renders if this changed the value.
  ensureHydrated();
  listeners.add(listener);

  // Keep other tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== HAPTICS_STORAGE_KEY) return;
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

// Support is a constant per device, but it's exposed through the same
// useSyncExternalStore machinery with a `false` server snapshot so the toggle
// renders nothing on the server and on the first client paint, then appears
// post-hydration only where vibration is available — no hydration mismatch.
function subscribeSupported(): () => void {
  return () => {};
}

function getSupportedSnapshot(): boolean {
  return supported;
}

function getSupportedServerSnapshot(): boolean {
  return false;
}

function setEnabled(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  try {
    window.localStorage.setItem(HAPTICS_STORAGE_KEY, serializeHapticsSetting(next));
  } catch {
    // Storage blocked (private mode) — the in-memory value still drives this tab.
  }
  emit();
}

export function useHaptics(): { enabled: boolean; supported: boolean; toggle: () => void } {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isSupported = useSyncExternalStore(
    subscribeSupported,
    getSupportedSnapshot,
    getSupportedServerSnapshot,
  );
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    track("haptics_toggled", { enabled: next });
  };
  return { enabled: value, supported: isSupported, toggle };
}

/**
 * Fire answer feedback from a quiz handler. Safe no-op when the setting is off,
 * the device has no vibration support, or during SSR. Lazily hydrates the store
 * from localStorage first, because pages like /daily and /lightning never mount
 * the toggle, so nothing else would have hydrated the setting.
 */
export function vibrateFeedback(kind: HapticKind): void {
  if (!supported) return;
  ensureHydrated();
  if (!enabled) return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[kind] as number[]);
  } catch {
    // navigator.vibrate can throw or be blocked — feedback is best-effort.
  }
}
