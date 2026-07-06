"use client";

import { useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data-logic";
import { defaultShuffle } from "@/lib/quiz-logic";
import { CLOZE_BLANK, buildClozeDeck, type ClozeCard } from "@/lib/cloze-logic";
import { SpeakButton } from "../speak-button";

// The "Sentences" tab: fill-in-the-blank from real example sentences. A word's
// target hanzi is blanked out of one of its own sentences and the learner picks
// the right hanzi from four choices. All card/blank/distractor logic lives in
// src/lib/cloze-logic.ts — this panel only holds drill state and renders. A
// toggleable English hint helps decode the sentence; after answering, the blank
// is filled in emerald, the word (hanzi/pinyin/meaning) is shown, and the whole
// original sentence can be spoken via the browser (SpeakButton is hidden before
// answering so it can't give the word away). Answers persist through the same
// recordQuizAnswer path as the quiz, so cloze misses feed Trickiest words and
// /practice. No schema change.
export function ClozePanel({
  topic,
  onRecord,
}: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
}) {
  const keyFor = (item: VocabItem) => wordKey(topic, item);

  // Built once per mount/restart so answering never reshuffles the live deck.
  const [deck, setDeck] = useState<ClozeCard[]>(() =>
    buildClozeDeck(topic.items, topic.items, keyFor, defaultShuffle),
  );
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  // The English translation is a hint, shown by default and toggleable so
  // learners can hide it for a harder challenge. Persists across cards.
  const [showHint, setShowHint] = useState(true);

  // No eligible sentences at all (defensive; the dataset guarantees them).
  if (deck.length === 0) return null;

  const total = deck.length;
  const current = deck[index];

  function restart() {
    setDeck(buildClozeDeck(topic.items, topic.items, keyFor, defaultShuffle));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  }

  // ── Completion summary ──
  if (done) {
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Sentence cloze practice"
      >
        <p className="text-6xl">{score === total ? "🎉" : "💪"}</p>
        <p className="mt-4 text-2xl font-semibold text-white">Sentences complete!</p>
        <p className="mt-3 text-5xl font-bold text-emerald-300">
          {score}
          <span className="text-2xl text-slate-400">/{total}</span>
        </p>
        <p className="mt-2 text-slate-400">
          {score === total
            ? "Perfect — every word read in context."
            : "Reading words in context is the goal — keep going."}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={restart}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  function answer(choice: string) {
    if (picked !== null) return; // already answered this card
    const correct = choice === current.hanzi;
    // The guard above means this fires exactly once per card, so per-word quiz
    // accuracy is recorded once per attempt — same semantics as the quiz.
    onRecord(current.key, correct);
    setPicked(choice);
    if (correct) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  // Sentence split around the single blank; `after` may be empty when the target
  // is the last token. Rendered at 3xl for both pre- and post-answer states so
  // the reveal never jumps size.
  const [before, after] = current.prompt.split(CLOZE_BLANK);
  const answered = picked !== null;

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Sentence cloze practice"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Sentence {index + 1} of {total}
        </p>
        <p className="text-sm font-semibold text-emerald-300">Score {score}</p>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-track mt-2">
        <div className="progress-bar-fill" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      {/* Blanked sentence — filled in emerald once answered. */}
      <p className="font-hanzi mt-8 text-center text-3xl leading-relaxed text-white">
        {before}
        {answered ? (
          <span className="text-emerald-300">{current.hanzi}</span>
        ) : (
          <span
            role="img"
            aria-label="blank"
            className="mx-0.5 border-b-2 border-emerald-300 px-1"
          >
            {CLOZE_BLANK}
          </span>
        )}
        {after}
      </p>

      {/* English hint with a hide/show toggle. */}
      <div className="mt-4 text-center">
        {showHint ? (
          <p className="text-sm text-slate-400">{current.sentenceEn}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          className="mt-1 min-h-[36px] text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
          aria-pressed={showHint}
        >
          {showHint ? "Hide English hint" : "Show English hint"}
        </button>
      </div>

      {/* Choices — hanzi, same feedback styling as the quiz. */}
      <div className="mt-8 grid gap-3 md:grid-cols-2" role="listbox" aria-label="Answer choices">
        {current.choices.map((choice) => {
          const right = answered && choice === current.hanzi;
          const wrong = picked === choice && choice !== current.hanzi;
          return (
            <button
              key={`${index}:${choice}`}
              type="button"
              onClick={() => answer(choice)}
              role="option"
              aria-selected={picked === choice}
              aria-disabled={answered && picked !== choice}
              className={`min-h-[52px] rounded-2xl border px-5 py-4 text-center transition
                ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              <span className="font-hanzi text-2xl">{choice}</span>
            </button>
          );
        })}
      </div>

      {/* After answering: word details + speak the full original sentence. */}
      {answered ? (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-white/10 bg-surface-2 p-5"
        >
          <div className="flex flex-wrap items-baseline justify-center gap-3 text-center">
            <span className="font-hanzi text-2xl text-white">{current.hanzi}</span>
            <span className="font-hanzi text-lg text-emerald-300">{current.pinyin}</span>
            <span className="text-sm text-slate-400">{current.english}</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <p className="font-hanzi text-base text-slate-300">{current.sentenceCn}</p>
            <SpeakButton text={current.sentenceCn} label="Hear the full sentence" />
          </div>
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={next}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            >
              {index + 1 >= total ? "See results" : "Next sentence"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
