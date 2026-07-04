"use client";

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

  const unavailable = status === "unsupported" || status === "no-chinese-voice";
  const defaultLabel = label ?? `Pronounce: ${text}`;

  let title = defaultLabel;
  if (unavailable) title = "Audio unavailable — no Chinese voice on this device";
  else if (speaking) title = "Stop audio";
  else if (failed) title = "Couldn't play audio — tap to try again";

  const handleClick = () => {
    if (unavailable) return;
    if (speaking) {
      stop();
      return;
    }
    speak(text, { lang });
  };

  const base =
    className ??
    "inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-emerald-300 hover:text-emerald-300";
  const stateClass = unavailable
    ? " cursor-not-allowed opacity-40"
    : speaking
    ? " animate-pulse border-emerald-300 text-emerald-300"
    : "";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={title}
      aria-pressed={speaking}
      aria-disabled={unavailable || undefined}
      title={title}
      className={`${base}${stateClass}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    </button>
  );
}
