"use client";

import { useState } from "react";

import { type SpeechPace, speechRateFor } from "../lib/speech";
import { useSpeech } from "./use-speech";

interface SpeakButtonProps {
  text: string;
  lang?: string;
  label?: string;
  className?: string;
}

// Shared pronunciation control. Internals run through the hardened `useSpeech()`
// hook (voice selection, stuck-pause recovery, cancel-race + GC workarounds); the
// props API is intentionally unchanged so the 12+ call sites need no edits.
//
// Always renders (no `typeof window` null-return) so SSR and first client render
// match — availability is reflected post-hydration via the hook's `status`,
// avoiding the hydration mismatch the old inline guard caused on browsers without
// `speechSynthesis`.
export function SpeakButton({ text, lang = "zh-CN", label, className }: SpeakButtonProps) {
  const { status, speaking, failed, speak, stop } = useSpeech();
  // Which control was tapped last, so the pulse lands on the right button while
  // `speaking` is true. Not derived from the DOM/window, so SSR and first client
  // render match (no hydration warning).
  const [pace, setPace] = useState<SpeechPace>("normal");

  const unavailable = status === "unsupported" || status === "no-chinese-voice";
  const defaultLabel = label ?? `Pronounce: ${text}`;
  const slowLabel = label ? `${label} (slow)` : `Pronounce slowly: ${text}`;

  const titleFor = (base: string) => {
    if (unavailable) return "Audio unavailable — no Chinese voice on this device";
    if (speaking) return "Stop audio";
    if (failed) return "Couldn't play audio — tap to try again";
    return base;
  };

  // Shared click logic for both paces: no-op when unavailable; stop when the
  // matching pace is already playing; otherwise (re)start at this pace. Tapping
  // one pace while the other plays restarts at the new pace — the hook's
  // cancel→speak race deferral handles the mid-playback switch.
  const handleSpeak = (nextPace: SpeechPace) => {
    if (unavailable) return;
    if (speaking && pace === nextPace) {
      stop();
      return;
    }
    setPace(nextPace);
    speak(text, { lang, rate: speechRateFor(nextPace) });
  };

  const iconBase =
    className ??
    "inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-emerald-300 hover:text-emerald-300";
  const activeClass = (thisPace: SpeechPace) =>
    unavailable
      ? " cursor-not-allowed opacity-40"
      : speaking && pace === thisPace
      ? " animate-pulse border-emerald-300 text-emerald-300"
      : "";

  const normalTitle = titleFor(defaultLabel);
  const slowTitle = titleFor(slowLabel);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleSpeak("normal")}
        aria-label={normalTitle}
        aria-pressed={speaking && pace === "normal"}
        aria-disabled={unavailable || undefined}
        title={normalTitle}
        className={`${iconBase}${activeClass("normal")}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => handleSpeak("slow")}
        aria-label={slowTitle}
        aria-pressed={speaking && pace === "slow"}
        aria-disabled={unavailable || undefined}
        title={slowTitle}
        className={`inline-flex items-center justify-center rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-400 transition hover:border-emerald-300 hover:text-emerald-300${activeClass(
          "slow",
        )}`}
      >
        0.6×
      </button>
    </span>
  );
}
