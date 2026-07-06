"use client";

import { useTheme } from "./use-theme";

// Quiet chip that flips the device-local "Light theme" setting, styled like the
// ToneColorsToggle chip. Dark is the default; tapping toggles to light and back.
// A single shared store (use-theme.ts) backs every instance, so the Home hero and
// Stats header chips stay in sync. `showHelper` adds the one-line hint (used on
// Stats, where there is room). Sun/moon inline SVG marks the *current* theme.
export function ThemeToggle({ showHelper = false }: { showHelper?: boolean }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";
  return (
    <div className="flex flex-col items-end gap-1.5 text-right">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={isLight}
          aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            isLight
              ? "border-emerald-300 bg-emerald-400/10 text-white"
              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25"
          }`}
        >
          {isLight ? (
            // Sun: light theme is active.
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            // Moon: dark theme is active.
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          Light theme
        </button>
        {showHelper ? (
          <p className="text-xs text-ink-low">Easier on the eyes outdoors. Saved on this device.</p>
        ) : null}
      </div>
    </div>
  );
}
