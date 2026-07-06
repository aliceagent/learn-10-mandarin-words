"use client";

import { useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data-logic";
import { defaultShuffle } from "@/lib/quiz-logic";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import {
  buildScrambleDeck,
  initialScrambleState,
  placeTile,
  returnTile,
  isComplete,
  checkArrangement,
  type ScrambleCard,
  type ScrambleState,
  type CheckResult,
} from "@/lib/scramble-logic";
import { SpeakButton } from "../speak-button";
import { TonePinyin } from "../tone-pinyin";

// The "Scramble" tab: rebuild a word's real example sentence from shuffled hanzi
// chunk tiles. All chunking/placement/grading logic lives in
// src/lib/scramble-logic.ts — this panel only holds drill state and renders. The
// English translation is the prompt; a toggleable word hint helps. Correctness is
// join-equality (the placed text must equal the original sentence), so duplicate
// chunks never cause a false wrong. The first check per card records once through
// the same recordQuizAnswer path as the quiz/cloze, feeding Trickiest words and
// /practice. Speech is offered only after solving, so audio can't dictate the
// order. No schema change.
export function ScramblePanel({
  topic,
  onRecord,
}: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
}) {
  const keyFor = (item: VocabItem) => wordKey(topic, item);

  // Built once per mount/restart so checking never reshuffles the live deck.
  const [deck, setDeck] = useState<ScrambleCard[]>(() =>
    buildScrambleDeck(topic.items, topic.items, keyFor, defaultShuffle),
  );
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [state, setState] = useState<ScrambleState>(initialScrambleState);
  // Last "Check order" result for the current card. `solved` freezes the board and
  // reveals the sentence; a non-solved result drives the "green prefix" highlight.
  const [result, setResult] = useState<CheckResult | null>(null);
  // The English translation hint, shown by default and toggleable across cards.
  const [showHint, setShowHint] = useState(true);

  // No playable cards at all (defensive; real data always yields a full deck).
  if (deck.length === 0) return null;

  const total = deck.length;
  const card = deck[index];
  const solved = result?.solved ?? false;
  const complete = isComplete(state, card);

  const placedTiles = state.placedIds.map(
    (id) => card.tiles.find((t) => t.id === id)!,
  );
  const bankTiles = card.tiles.filter((t) => !state.placedIds.includes(t.id));

  function restart() {
    setDeck(buildScrambleDeck(topic.items, topic.items, keyFor, defaultShuffle));
    setIndex(0);
    setScore(0);
    setDone(false);
    setState(initialScrambleState());
    setResult(null);
  }

  // ── Completion summary (mirrors cloze) ──
  if (done) {
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Sentence scramble practice"
      >
        <p className="text-6xl">{score === total ? "🎉" : "💪"}</p>
        <p className="mt-4 text-2xl font-semibold text-white">Scramble complete!</p>
        <p className="mt-3 text-5xl font-bold text-emerald-300">
          {score}
          <span className="text-2xl text-slate-400">/{total}</span>
        </p>
        <p className="mt-2 text-slate-400">
          {score === total
            ? "Perfect — every sentence built in order."
            : "Word order comes with reps — run it again."}
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

  function place(tileId: number) {
    if (solved) return;
    setState((s) => placeTile(s, tileId, card));
    // Any change invalidates the last check result (clears the shake/highlight).
    setResult(null);
  }

  function unplace(tileId: number) {
    if (solved) return;
    setState((s) => returnTile(s, tileId));
    setResult(null);
  }

  function check() {
    if (!complete || solved) return;
    const outcome = checkArrangement(state, card);
    // First check per card records exactly once — same once-per-card semantics as
    // the quiz/cloze. Re-checks after rearranging never re-record.
    if (!state.recorded) {
      onRecord(card.key, outcome.solved);
      setState((s) => ({ ...s, recorded: true, checks: s.checks + 1 }));
    } else {
      setState((s) => ({ ...s, checks: s.checks + 1 }));
    }
    setResult(outcome);
    if (outcome.solved) setScore((v) => v + 1);
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setState(initialScrambleState());
    setResult(null);
  }

  const showWrongHint = result !== null && !result.solved;

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Sentence scramble practice"
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

      {/* Prompt: rebuild the sentence from its English translation. */}
      <p className="mt-8 text-sm font-semibold text-slate-300">Rebuild the Chinese sentence:</p>
      <p className="mt-1 text-lg text-white">{card.sentenceEn}</p>

      {/* Toggleable word hint (shown by default). */}
      <div className="mt-3">
        {showHint ? (
          <p className="text-sm text-slate-400">
            Uses:{" "}
            <span lang={HANZI_LANG} className="font-hanzi text-white">{card.hanzi}</span>{" "}
            <span lang={PINYIN_LANG} className="font-hanzi text-emerald-300/90">
              <TonePinyin pinyin={card.pinyin} />
            </span>{" "}
            · {card.english}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          className="mt-1 min-h-[36px] text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
          aria-pressed={showHint}
        >
          {showHint ? "Hide word hint" : "Show word hint"}
        </button>
      </div>

      {/* Answer line — placed tiles in order, with the pinned terminal punctuation. */}
      <div
        className="mt-6 flex min-h-[64px] flex-wrap items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-surface-2 p-3"
        aria-label="Your sentence"
      >
        {placedTiles.length === 0 ? (
          <span className="px-1 text-sm text-slate-500">Tap the tiles below in order</span>
        ) : (
          placedTiles.map((tile, i) => {
            // Tiles past the correct prefix flash rose on a wrong check; the correct
            // leading run stays emerald. Both animations are reduced-motion-gated.
            const inCorrectPrefix = result !== null && i < result.correctPrefixTiles;
            let styles: string;
            if (solved) {
              styles = "border-emerald-300 bg-cta text-slate-950 animate-quiz-correct";
            } else if (showWrongHint && !inCorrectPrefix) {
              styles = "border-rose-400 bg-rose-400/20 text-rose-200 animate-quiz-wrong";
            } else if (showWrongHint && inCorrectPrefix) {
              styles = "border-emerald-300/60 bg-emerald-400/10 text-emerald-100";
            } else {
              styles = "border-white/15 bg-white/[0.06] text-white hover:border-emerald-300";
            }
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => unplace(tile.id)}
                disabled={solved}
                lang={HANZI_LANG}
                className={`font-hanzi min-h-[44px] rounded-xl border px-3 py-2 text-2xl transition ${styles}`}
                aria-label={`${tile.text}, tap to return to the bank`}
              >
                {tile.text}
              </button>
            );
          })
        )}
        {card.ending ? (
          <span
            lang={HANZI_LANG}
            className="font-hanzi px-1 text-2xl text-slate-400"
            aria-label="sentence ending"
          >
            {card.ending}
          </span>
        ) : null}
      </div>

      {/* Tile bank — tap to place. */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Sentence tiles">
        {bankTiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => place(tile.id)}
            disabled={solved}
            lang={HANZI_LANG}
            className="font-hanzi min-h-[44px] rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-2xl text-white transition hover:border-emerald-300"
          >
            {tile.text}
          </button>
        ))}
        {bankTiles.length === 0 && !solved ? (
          <span className="px-1 py-2 text-sm text-slate-500">All tiles placed — check your order.</span>
        ) : null}
      </div>

      {/* Wrong-check hint. */}
      {showWrongHint ? (
        <p className="mt-4 text-sm text-rose-300" role="status">
          Not quite — the green part is right. Rearrange the rest.
        </p>
      ) : null}

      {/* Check button (hidden once solved — the reveal block takes over). */}
      {!solved ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={check}
            disabled={!complete}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta disabled:cursor-not-allowed disabled:opacity-40"
          >
            Check order
          </button>
        </div>
      ) : null}

      {/* Solved: word detail + the full original sentence, spoken on demand. */}
      {solved ? (
        <div role="status" className="mt-6 rounded-2xl border border-white/10 bg-surface-2 p-5">
          <p className="text-center text-lg font-semibold text-emerald-300">
            Nice — that&apos;s the sentence! ✓
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <p lang={HANZI_LANG} className="font-hanzi text-lg text-white">
              {card.sentenceCn}
            </p>
            <SpeakButton text={card.sentenceCn} label="Hear the full sentence" />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-center gap-3 text-center">
            <span lang={HANZI_LANG} className="font-hanzi text-2xl text-white">{card.hanzi}</span>
            <span lang={PINYIN_LANG} className="font-hanzi text-lg text-emerald-300">
              <TonePinyin pinyin={card.pinyin} />
            </span>
            <span className="text-sm text-slate-400">{card.english}</span>
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
