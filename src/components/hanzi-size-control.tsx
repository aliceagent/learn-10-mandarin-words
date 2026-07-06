"use client";

import { HANZI_SIZES, hanziSizeLabel } from "@/lib/hanzi-size";
import type { HanziSize } from "@/lib/hanzi-size";
import { useHanziSize } from "./use-hanzi-size";

// Preview glyph rendered inside each chip at an escalating size, so the control
// is self-documenting: the character it grows IS the sample. 字 = "character".
const PREVIEW_SIZE: Record<HanziSize, string> = {
  standard: "text-sm",
  large: "text-lg",
  xl: "text-2xl",
};

// Quiet right-aligned segmented control that sets the device-local "Hanzi size"
// setting. Mounted beside ToneColorsToggle on topic pages and the review session
// header; every hanzi render site reads the same shared store, so one tap
// resizes all character prompts at once. Radiogroup semantics so the three
// levels announce as a single-choice group to assistive tech.
export function HanziSizeControl() {
  const { size, setSize } = useHanziSize();
  return (
    <div className="flex flex-col items-end gap-1.5 text-right">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <span id="hanzi-size-label" className="text-sm font-semibold text-slate-200">
          Hanzi size
        </span>
        <div
          role="radiogroup"
          aria-labelledby="hanzi-size-label"
          className="inline-flex items-center gap-1.5"
        >
          {HANZI_SIZES.map((level) => {
            const active = size === level;
            const label = hanziSizeLabel(level);
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${label} hanzi size`}
                onClick={() => setSize(level)}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-3 py-2 transition ${
                  active
                    ? "border-emerald-300 bg-emerald-400/10 text-white"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25"
                }`}
              >
                <span className={`font-hanzi leading-none ${PREVIEW_SIZE[level]}`} aria-hidden="true">
                  字
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-ink-low">
        Bigger characters on cards, quizzes, and drills. Saved on this device.
      </p>
    </div>
  );
}
