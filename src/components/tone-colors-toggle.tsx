"use client";

import { Fragment } from "react";
import type { Tone } from "@/lib/pinyin";
import { TONE_TEXT_CLASS } from "@/lib/tone-colors";
import { useToneColors } from "./use-tone-colors";

// Legend syllables (the classic "mā má mǎ mà · ma" tone-drill mnemonic), each
// shown in its own tone color so the palette is self-documenting when enabled.
const LEGEND: { syllable: string; tone: Tone }[] = [
  { syllable: "mā", tone: 1 },
  { syllable: "má", tone: 2 },
  { syllable: "mǎ", tone: 3 },
  { syllable: "mà", tone: 4 },
  { syllable: "ma", tone: 5 },
];

// Quiet Level-2 chip that flips the device-local "Tone colors" setting, styled
// like the tone-practice tone chips. When enabled it shows an inline legend of
// the palette. Mounted on topic pages (under the mode tabs) and the review
// session header; every TonePinyin reads the same shared store, so one tap
// recolors all pinyin at once.
export function ToneColorsToggle() {
  const { enabled, toggle } = useToneColors();
  return (
    <div className="flex flex-col items-end gap-1.5 text-right">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? "Turn tone colors off" : "Turn tone colors on"}
          className={`inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            enabled
              ? "border-emerald-300 bg-emerald-400/10 text-white"
              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25"
          }`}
        >
          Tone colors
        </button>
        <p className="text-xs text-ink-low">
          Color each pinyin syllable by its tone. Saved on this device.
        </p>
      </div>
      {enabled ? (
        <p className="font-hanzi flex flex-wrap items-center justify-end gap-1.5 text-sm" aria-hidden="true">
          {LEGEND.map((entry) => (
            <Fragment key={entry.tone}>
              {entry.tone === 5 ? <span className="text-slate-600">·</span> : null}
              <span className={TONE_TEXT_CLASS[entry.tone]}>{entry.syllable}</span>
            </Fragment>
          ))}
          <span className="text-slate-500">neutral</span>
        </p>
      ) : null}
    </div>
  );
}
