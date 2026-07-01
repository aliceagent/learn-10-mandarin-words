"use client";

import { useCallback, useRef } from "react";

interface SpeakButtonProps {
  text: string;
  lang?: string;
  label?: string;
  className?: string;
}

export function SpeakButton({ text, lang = "zh-CN", label, className }: SpeakButtonProps) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.85;
    utteranceRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, [text, lang]);

  if (typeof window !== "undefined" && !("speechSynthesis" in window)) return null;

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={label ?? `Pronounce: ${text}`}
      title={label ?? `Pronounce: ${text}`}
      className={className ?? "inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-emerald-300 hover:text-emerald-300"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    </button>
  );
}
