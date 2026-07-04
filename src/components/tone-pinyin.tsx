"use client";

import { Fragment } from "react";
import { pinyinSegments } from "@/lib/pinyin";
import { TONE_TEXT_CLASS } from "@/lib/tone-colors";
import { useToneColors } from "./use-tone-colors";

// Renders a pinyin string, coloring each syllable by its tone when the
// device-local "Tone colors" setting is on (read from the shared store, so a
// render site changes by one line and every instance stays in sync). Off — the
// default — it renders the raw string unchanged: zero visual change, no extra
// DOM. Color is additive: the tone marks in the pinyin are never stripped, so it
// is never the only channel. Emits plain React text/span nodes (no
// dangerouslySetInnerHTML), mirroring highlighted-text.tsx, and inherits
// font/size/weight from the parent element.
export function TonePinyin({ pinyin }: { pinyin: string }) {
  const { enabled } = useToneColors();
  if (!enabled) return <>{pinyin}</>;
  return (
    <>
      {pinyinSegments(pinyin).map((segment, i) =>
        segment.tone === null ? (
          <Fragment key={i}>{segment.text}</Fragment>
        ) : (
          <span key={i} className={TONE_TEXT_CLASS[segment.tone]}>
            {segment.text}
          </span>
        ),
      )}
    </>
  );
}
