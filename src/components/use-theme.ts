"use client";

import { useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  THEME_COLOR,
  normalizeThemeSetting,
  serializeThemeSetting,
  type Theme,
} from "@/lib/theme";
import { track } from "@/lib/analytics";

// Device-local "Light theme" preference (Sprint 16). A single module-level store
// backs the toggle chips on Home and Stats, so flipping the setting once updates
// every subscriber in sync with zero prop threading.
//
// Persistence is localStorage-only under its own key — NOT ProgressState — so it
// never touches progress export/import. Subscribed via useSyncExternalStore with
// a "dark" server snapshot: SSR and the first client render both assume dark (the
// default), matching the pre-paint inline script's contract that dark = no
// attribute. The actual stored value is read on first subscription (post-mount),
// so there is no hydration mismatch (same approach as use-tone-colors.ts). All
// storage and DOM access is try/catch wrapped for private-mode safety.

let theme: Theme = "dark";
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): Theme {
  try {
    return normalizeThemeSetting(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

// Apply the theme to the live DOM: the pre-paint script only runs on hard loads,
// so toggles and cross-tab sync must mirror its effect (data-theme for light,
// absent for dark) and keep the browser-chrome color in step.
function applyToDom(next: Theme): void {
  try {
    const root = document.documentElement;
    if (next === "light") {
      root.dataset.theme = "light";
    } else {
      delete root.dataset.theme;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[next]);
  } catch {
    // No document (SSR) or blocked DOM — the in-memory value still drives render.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  // Hydrate from localStorage on the first subscription (post-mount, so the
  // server snapshot stayed "dark" and the first paint matched it). React re-reads
  // getSnapshot right after subscribe and re-renders if this changed the value.
  if (!hydrated) {
    hydrated = true;
    theme = readStored();
  }
  listeners.add(listener);

  // Keep other tabs in sync — mirror the DOM update the pre-paint script made.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const next = readStored();
    if (next !== theme) {
      theme = next;
      applyToDom(next);
      emit();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Theme {
  return theme;
}

function getServerSnapshot(): Theme {
  return "dark";
}

function setTheme(next: Theme): void {
  if (next === theme) return;
  theme = next;
  applyToDom(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, serializeThemeSetting(next));
  } catch {
    // Storage blocked (private mode) — the in-memory value still drives this tab.
  }
  emit();
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    track("theme_toggled", { theme: next });
  };
  return { theme: value, toggle };
}
