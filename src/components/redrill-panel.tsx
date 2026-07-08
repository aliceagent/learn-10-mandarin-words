"use client";

import { useState } from "react";
import { defaultShuffle, type QuizCard } from "@/lib/quiz-logic";
import { buildRedrillDeck, type RedrillEntry } from "@/lib/redrill-logic";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { track } from "@/lib/analytics";
import { SpeakButton } from "./speak-button";

// A compact, in-place mini-quiz over exactly the words a learner just missed.
// Reused by both /review and /daily recaps. It is deliberately
// SCHEDULING-NEUTRAL: it reports every answer through `onRecordAnswer`
// (recordQuizAnswer → weak-words signal) and NEVER through gradeWord, so SM-2
// flashcard scheduling is untouched.
//
// The deck is snapshotted in a useState initializer and never rebuilt on
// re-render — recordQuizAnswer mutates quizStats on every answer, so any live
// derivation would reshuffle mid-run. "Drill again" rebuilds explicitly from the
// still-missed subset.
type RunState = {
  deck: QuizCard[];
  index: number;
  picked: string | null;
  missedKeys: string[];
  done: boolean;
};

function freshRun(entries: RedrillEntry[]): RunState {
  return {
    deck: buildRedrillDeck(entries, defaultShuffle),
    index: 0,
    picked: null,
    missedKeys: [],
    done: false,
  };
}

export function RedrillPanel({
  entries,
  onRecordAnswer,
  onClose,
}: {
  entries: RedrillEntry[];
  onRecordAnswer: (key: string, correct: boolean) => void;
  onClose: () => void;
}) {
  // Snapshot the run once. Never rebuilt on re-render (see note above).
  const [run, setRun] = useState<RunState>(() => freshRun(entries));

  const total = run.deck.length;
  const current = run.deck[run.index];

  function handleAnswer(choice: string) {
    if (!current || run.picked !== null) return;
    const correct = choice === current.answer;
    // Weak-words signal only — deliberately NOT gradeWord (no SM-2 mutation).
    onRecordAnswer(current.key, correct);
    setRun((r) => ({
      ...r,
      picked: choice,
      missedKeys: correct || r.missedKeys.includes(current.key)
        ? r.missedKeys
        : [...r.missedKeys, current.key],
    }));
  }

  function handleNext() {
    setRun((r) => {
      if (r.index + 1 >= r.deck.length) {
        track("redrill_completed", { count: r.deck.length, cleared: r.missedKeys.length === 0 });
        return { ...r, done: true };
      }
      return { ...r, index: r.index + 1, picked: null };
    });
  }

  // Rebuild the deck from the words still missed on this pass and start over.
  function drillAgain() {
    const stillMissed = entries.filter((e) => run.missedKeys.includes(e.key));
    setRun(freshRun(stillMissed));
  }

  if (run.done) {
    const cleared = run.missedKeys.length === 0;
    const remaining = run.missedKeys.length;
    return (
      <div className="animate-celebrate mt-12 rounded-3xl border border-white/10 bg-surface p-8 text-center md:p-10">
        <p className="text-6xl">{cleared ? "🎉" : "💪"}</p>
        <p className="mt-4 text-2xl font-semibold text-white">
          {cleared ? "All corrected!" : "Almost there"}
        </p>
        <p className="mt-3 text-slate-400">
          {cleared
            ? `You nailed all ${total} on this pass.`
            : `${remaining} still tricky — one more pass?`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {cleared ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={drillAgain}
                className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
              >
                Drill again ({remaining})
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
              >
                Done for now
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!current) {
    // Defensive: nothing to drill (empty entries). Return to the recap.
    return (
      <div className="mt-12 rounded-3xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-slate-400">Nothing to re-drill.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <section
      className="mt-4 rounded-3xl border border-white/10 bg-surface p-4 md:mt-8 md:p-6"
      aria-label="Quick re-drill"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Quick re-drill</h2>
        <p className="text-xs text-slate-400 md:text-sm">Word {run.index + 1} of {total}</p>
      </div>

      {/* Progress bar through the drill */}
      <div className="progress-bar-track mt-2">
        <div className="progress-bar-fill" style={{ width: `${(run.index / total) * 100}%` }} />
      </div>

      {/* Prompt: hanzi + pronounce. Pinyin is revealed with the answer below. */}
      <div className="mt-5 text-center md:mt-6">
        <div className="flex items-center justify-center gap-3">
          <h3 lang={HANZI_LANG} className="font-hanzi text-6xl font-semibold text-white md:text-7xl">{current.prompt}</h3>
          <SpeakButton text={current.prompt} label={`Pronounce: ${current.prompt}`} />
        </div>
        {/* Pinyin ALWAYS accompanies the hanzi (project rule) — shown on answer. */}
        {run.picked !== null && current.promptPinyin ? (
          <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-xl text-emerald-300 md:text-2xl" role="status">
            {current.promptPinyin}
          </p>
        ) : null}
      </div>

      {/* Choices */}
      <div className="mt-5 grid gap-2 md:mt-8 md:grid-cols-2 md:gap-3" role="listbox" aria-label="Answer choices">
        {current.choices.map((choice) => {
          const right = run.picked !== null && choice === current.answer;
          const wrong = run.picked === choice && choice !== current.answer;
          return (
            <button
              key={`${run.index}:${choice}`}
              type="button"
              onClick={() => handleAnswer(choice)}
              role="option"
              aria-selected={run.picked === choice}
              aria-disabled={run.picked !== null && run.picked !== choice}
              className={`min-h-[48px] rounded-2xl border px-4 py-3 text-left font-semibold transition md:min-h-[52px] md:px-5 md:py-4
                ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {run.picked ? (
        <div className="mt-4 md:mt-6">
          <button
            type="button"
            onClick={handleNext}
            className="min-h-[44px] w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta md:w-auto"
            aria-label={run.index + 1 >= total ? "See results" : "Next word"}
          >
            {run.index + 1 >= total ? "See results" : "Next word"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
