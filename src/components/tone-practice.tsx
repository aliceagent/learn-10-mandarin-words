"use client";

import { useMemo, useState } from "react";
import type { Topic } from "@/lib/types";
import { bareSyllables, tonesOf, type Tone } from "@/lib/pinyin";
import { track } from "@/lib/analytics";
import { SpeakButton } from "./speak-button";

// Additive, self-contained tone drill. Tones are derived from the existing
// tone-marked pinyin (see src/lib/pinyin.ts) — no hardcoded per-word tone data.

const TONE_LABELS: Record<Tone, string> = {
  1: "1 ˉ",
  2: "2 ˊ",
  3: "3 ˇ",
  4: "4 ˋ",
  5: "5 ·",
};

export function TonePractice({ topic }: { topic: Topic }) {
  // Only words whose tone sequence is derivable (all real vocab qualifies).
  const words = useMemo(
    () =>
      topic.items
        .map((item) => ({ item, tones: tonesOf(item.pinyin) }))
        .filter((w) => w.tones.length > 0),
    [topic],
  );

  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(Tone | null)[]>([]);
  const [checked, setChecked] = useState(false);

  const current = words[index % words.length];
  const answer = current.tones;
  const syllables = bareSyllables(current.item.pinyin, answer.length);
  const complete = picks.length === answer.length && picks.every((p) => p !== null);
  const allCorrect = checked && picks.every((p, i) => p === answer[i]);

  function pick(syllableIndex: number, tone: Tone) {
    if (checked) return;
    setPicks((prev) => {
      const next = [...prev];
      // Ensure array length matches the answer.
      while (next.length < answer.length) next.push(null);
      next[syllableIndex] = tone;
      return next;
    });
  }

  function check() {
    if (!complete || checked) return;
    setChecked(true);
    track("tone_practice_completed", {
      topic: topic.slug,
      syllables: answer.length,
      correct: picks.every((p, i) => p === answer[i]),
    });
  }

  function next() {
    setIndex((v) => (v + 1) % words.length);
    setPicks([]);
    setChecked(false);
  }

  if (words.length === 0) return null;

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Tone practice"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Word {(index % words.length) + 1} of {words.length}
        </p>
        <p className="text-sm font-semibold text-emerald-300">Tone check</p>
      </div>

      {/* Prompt: hanzi + tone-stripped pinyin (tones hidden). */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <h3 className="font-hanzi text-6xl font-semibold text-white">{current.item.hanzi}</h3>
          <SpeakButton text={current.item.hanzi} label={`Pronounce ${current.item.hanzi}`} />
        </div>
        <p className="font-hanzi mt-2 text-2xl text-slate-400">
          {checked ? current.item.pinyin : syllables.join(" ")}
        </p>
        <p className="mt-1 text-sm text-slate-500">{current.item.english}</p>
      </div>

      {/* One tone selector row per syllable. */}
      <div className="mt-6 space-y-3">
        {answer.map((correctTone, sIdx) => {
          const picked = picks[sIdx] ?? null;
          const label = syllables.length === answer.length ? syllables[sIdx] : `Syllable ${sIdx + 1}`;
          return (
            <div key={sIdx} className="flex flex-wrap items-center gap-2">
              <span className="font-hanzi w-20 shrink-0 text-sm text-slate-300">{label}</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Tone for ${label}`}>
                {([1, 2, 3, 4, 5] as Tone[]).map((tone) => {
                  const isPicked = picked === tone;
                  const showRight = checked && tone === correctTone;
                  const showWrong = checked && isPicked && tone !== correctTone;
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => pick(sIdx, tone)}
                      aria-pressed={isPicked}
                      aria-label={`Tone ${tone === 5 ? "neutral" : tone} for ${label}`}
                      disabled={checked}
                      // Quiet Level-2 chip language, shared with the match tiles:
                      // an unpicked chip is a muted translucent surface; the live
                      // pick is a subtle emerald wash + hairline (not a full fill);
                      // graded states reuse the quiz's semantic correct/wrong.
                      className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition
                        ${showRight ? "border-emerald-300 bg-emerald-300 text-slate-950" : ""}
                        ${showWrong ? "border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                        ${!showRight && !showWrong && isPicked ? "border-emerald-300 bg-emerald-400/10 text-white" : ""}
                        ${!showRight && !showWrong && !isPicked ? "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25" : ""}
                      `}
                    >
                      {TONE_LABELS[tone]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Result + controls. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!checked ? (
          <button
            type="button"
            onClick={check}
            disabled={!complete}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Check tones
          </button>
        ) : (
          <>
            <p
              className={`text-sm font-semibold ${allCorrect ? "text-emerald-300" : "text-rose-300"}`}
              role="status"
            >
              {allCorrect ? "Correct — nice ear!" : "Not quite — the correct tones are shown."}
            </p>
            <button
              type="button"
              onClick={next}
              className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Next word
            </button>
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Pick the tone for each syllable (1–4, or 5 for neutral), then check. Tones come from the
        word&apos;s pinyin.
      </p>
    </section>
  );
}
