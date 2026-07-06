// Pure, DOM-free helpers for the manual "Light theme" preference (Sprint 16).
// This is a device-local UI preference — persisted under its own localStorage
// key, NOT part of ProgressState — mirroring the tone-colors pattern in
// src/lib/tone-colors.ts. Dark stays the default brand experience; light is an
// opt-in. Kept here so the coercion + init-script logic is unit-testable under
// `node --test` without rendering. See src/components/use-theme.ts for the store.

/** The two supported themes. Dark is the default (absence of `data-theme`). */
export type Theme = "dark" | "light";

/** localStorage key for the device-local theme preference. */
export const THEME_STORAGE_KEY = "learn-10-mandarin-theme";

/**
 * Coerce any stored/unknown value to a Theme. Only the exact string "light"
 * yields light; everything else (including `null` when nothing was ever stored,
 * "dark", other strings, numbers, and non-strings) reads as dark. This keeps the
 * default dark and tolerates a garbage or legacy localStorage value — mirroring
 * `normalizeToneColorsSetting`'s strictness.
 */
export function normalizeThemeSetting(value: unknown): Theme {
  return value === "light" ? "light" : "dark";
}

/** Serialize the theme for localStorage. */
export function serializeThemeSetting(theme: Theme): "light" | "dark" {
  return theme === "light" ? "light" : "dark";
}

/**
 * Browser-chrome `theme-color` per theme. Matches the flat ground of each theme
 * (dark #020617 / light #f8fafc) so the mobile status bar blends with the page.
 */
export const THEME_COLOR: Record<Theme, string> = {
  dark: "#020617",
  light: "#f8fafc",
};

/**
 * Pre-paint inline-script body (runs in <head> during HTML parsing, before the
 * first paint) that reads the stored preference and sets `data-theme="light"` on
 * <html> only when the stored value is exactly "light". Dark needs no attribute —
 * absence of `data-theme` *is* dark, so the server HTML never mismatches for dark
 * users. Wrapped in try/catch for private-mode / disabled-storage safety.
 *
 * Exported as a constant so it is unit-testable and so the storage key can never
 * drift between this script and the React store. Per the Next.js 16 guide at
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}})()`;
