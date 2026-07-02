"use client";

import type { Topic, VocabItem } from "@/lib/types";
import type { Grade } from "@/lib/progress-logic";
import { SpeakButton } from "../speak-button";
import { useSwipe } from "../use-swipe";

// The "Cards" tab: a single flashcard with reveal + SM-2 grade buttons and the
// swipe gestures (right = easy, left = again, once revealed). Card index and
// reveal/grade side effects stay in the parent so quiz/flashcard state persists
// across tab switches; this panel just renders the current card and reports
// intents. Extracted verbatim from topic-app's `mode === "flashcards"` section —
// the swipe now lives here via the shared useSwipe hook with identical mapping.
export function FlashcardsPanel({
  topic,
  cardIndex,
  current,
  revealed,
  onReveal,
  onGrade,
}: {
  topic: Topic;
  cardIndex: number;
  current: VocabItem;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
}) {
  // Swipe: right = easy, left = again (when revealed); right also reveals first.
  const swipe = useSwipe(
    () => { if (revealed) onGrade("again"); },
    () => { if (revealed) onGrade("easy"); else onReveal(); },
  );

  return (
    <section
      className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center"
      {...swipe}
      aria-label="Flashcard practice"
      role="region"
    >
      <div className="flex items-center justify-between gap-2 text-sm text-slate-400">
        <span>Card {cardIndex + 1} of {topic.items.length}</span>
        {/* Swipe gesture hints */}
        <div className="flex gap-2">
          <span className="swipe-hint">← again</span>
          <span className="swipe-hint">easy →</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <h2 className="font-hanzi text-7xl font-semibold text-white">{current.hanzi}</h2>
        <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
      </div>

      {revealed ? (
        <div className="mt-5 animate-celebrate">
          <p className="font-hanzi text-2xl text-emerald-300">{current.pinyin}</p>
          <p className="mt-2 text-xl text-slate-200">{current.english}</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!revealed ? (
          <button
            type="button"
            onClick={onReveal}
            className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            aria-label="Reveal answer"
          >
            Reveal
          </button>
        ) : (
          <>
            {(["again", "hard", "good", "easy"] as const).map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => onGrade(grade)}
                className="min-h-[44px] rounded-full border border-white/15 px-5 py-3 font-semibold capitalize text-white transition hover:border-emerald-300"
                aria-label={`Grade as ${grade}`}
              >
                {grade}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Tip on first card */}
      {!revealed && cardIndex === 0 ? (
        <p className="mt-6 text-xs text-slate-600">
          Tap Reveal, then grade your recall · swipe left/right after revealing
        </p>
      ) : null}
    </section>
  );
}
