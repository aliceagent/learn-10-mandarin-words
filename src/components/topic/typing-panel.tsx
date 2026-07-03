"use client";

import { useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { defaultShuffle } from "@/lib/quiz-logic";
import { gradeTypedPinyin, parseTypedPinyin, toneNumberForm, type TypedGrade } from "@/lib/typing-logic";
import { track } from "@/lib/analytics";
import { SpeakButton } from "../speak-button";

// The "Type" tab: show a hanzi word and have the learner type its pinyin. All
// grading lives in src/lib/typing-logic.ts — this panel only holds drill state
// and renders feedback. Accepts tone marks (gǒu), tone numbers (gou3), or bare
// letters (gou); grading reports perfect / tones-off / wrong. Answers persist
// through the same recordQuizAnswer path as the quiz (tones-off counts as an
// incorrect recall, so it feeds Trickiest words and /practice); Skip records
// nothing. No schema change.
export function TypingPanel({
  topic,
  onRecord,
}: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
}) {
  // Shuffle once per mount/restart so answering never reshuffles the live deck.
  const [deck, setDeck] = useState<VocabItem[]>(() => defaultShuffle(topic.items));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TypedGrade | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  if (topic.items.length === 0) return null;

  const current = deck[index];
  const total = deck.length;

  function restart() {
    setDeck(defaultShuffle(topic.items));
    setIndex(0);
    setInput("");
    setResult(null);
    setCorrect(0);
    setDone(false);
  }

  // ── Completion summary ──
  if (done) {
    return (
      <section
        className="mt-6 rounded-[2rem] border border-white/10 bg-surface p-8 text-center"
        aria-label="Typed recall practice"
      >
        <p className="text-6xl">{correct === total ? "🎉" : "💪"}</p>
        <p className="mt-4 text-2xl font-semibold text-white">Typing practice done!</p>
        <p className="mt-3 text-5xl font-bold text-emerald-300">
          {correct}
          <span className="text-2xl text-slate-400">/{total}</span>
        </p>
        <p className="mt-2 text-slate-400">
          {correct === total
            ? "Perfect — letters and tones all right."
            : "Tones count too — keep going."}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={restart}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (result !== null) return; // already graded this word
    if (parseTypedPinyin(input).length === 0) return; // nothing typed
    const grade = gradeTypedPinyin(input, current.pinyin);
    setResult(grade);
    setCorrect((c) => (grade === "correct" ? c + 1 : c));
    onRecord(wordKey(topic, current), grade === "correct");
  }

  function advance() {
    if (index + 1 >= total) {
      setDone(true);
      track("typed_recall_completed", { topic: topic.slug, correct, total });
      return;
    }
    setIndex((i) => i + 1);
    setInput("");
    setResult(null);
  }

  // Skip: advance without recording anything.
  function skip() {
    advance();
  }

  const canCheck = result === null && parseTypedPinyin(input).length > 0;
  const marked = current.pinyin;
  const numbered = toneNumberForm(current.pinyin);

  return (
    <section
      className="mt-6 rounded-[2rem] border border-white/10 bg-surface p-6"
      aria-label="Typed recall practice"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Word {index + 1} of {total}
        </p>
        <p className="text-sm font-semibold text-emerald-300">Type the pinyin</p>
      </div>

      {/* Prompt: hanzi + meaning (this drill targets pronunciation recall). */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <h3 className="font-hanzi text-7xl font-semibold text-white">{current.hanzi}</h3>
          <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{current.english}</p>
      </div>

      {/* Input + controls */}
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="typing-input" className="sr-only">
          Type the pinyin for {current.hanzi}
        </label>
        <input
          id="typing-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          disabled={result !== null}
          placeholder="e.g. gǒu, gou3, or gou"
          className="font-hanzi w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-3 text-center text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300 disabled:opacity-60"
        />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {result === null ? (
            <>
              <button
                type="submit"
                disabled={!canCheck}
                className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Check
              </button>
              <button
                type="button"
                onClick={skip}
                className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
              >
                Skip
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={advance}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              {index + 1 >= total ? "See results" : "Next word"}
            </button>
          )}
        </div>
      </form>

      {/* Feedback — text + colour, never colour alone. Always shows the answer
          in both notations after grading. */}
      {result !== null ? (
        <div
          role="status"
          className={`mt-5 rounded-2xl border px-5 py-4 text-center text-sm font-semibold
            ${result === "correct" ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-200" : ""}
            ${result === "tones-off" ? "border-amber-400/50 bg-amber-400/10 text-amber-200" : ""}
            ${result === "incorrect" ? "border-rose-400/50 bg-rose-400/10 text-rose-200" : ""}
          `}
        >
          {result === "correct" ? (
            <>
              Correct — <span className="font-hanzi">{marked}</span>.
            </>
          ) : result === "tones-off" ? (
            <>
              Letters right, tones off — it&apos;s <span className="font-hanzi">{marked}</span> (
              <span className="font-hanzi">{numbered}</span>).
            </>
          ) : (
            <>
              It&apos;s <span className="font-hanzi">{marked}</span> (
              <span className="font-hanzi">{numbered}</span>).
            </>
          )}
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs text-slate-600">
        Type pinyin — tone marks (gǒu), numbers (gou3), or letters only (v = ü).
      </p>
    </section>
  );
}
