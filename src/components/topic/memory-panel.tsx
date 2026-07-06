"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data-logic";
import { defaultShuffle } from "@/lib/quiz-logic";
import {
  buildMemoryRounds,
  clearMismatch,
  flipCard,
  initialMemoryState,
  type MemoryCard,
} from "@/lib/memory-logic";
import { track } from "@/lib/analytics";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { TonePinyin } from "../tone-pinyin";

// The "Memory" tab: a concentration-style flip game. Every card starts face
// down; the learner flips two at a time, and a hanzi card locks face up only
// when found together with its English partner. All flip rules live in
// src/lib/memory-logic.ts — this panel only holds game state, the flip-back
// timer, and the render. Unlike the Match tab it records POSITIVE signals only:
// a memory mismatch is positional luck, not a vocabulary error, so it must not
// feed Trickiest words / practice. Each matched pair records one correct answer
// via the shared recordQuizAnswer path. No schema change.

// Longer than the Match tab's 350ms flash — the learner must actually *read*
// both faces to build the spatial memory the game trains.
const MISMATCH_SHOW_MS = 900;

export function MemoryPanel({
  topic,
  onRecord,
  onTakeQuiz,
}: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
  onTakeQuiz: () => void;
}) {
  const keyFor = (item: VocabItem) => wordKey(topic, item);

  // Rounds are built once per mount/restart so flipping never reshuffles them.
  const [rounds, setRounds] = useState(() =>
    buildMemoryRounds(topic.items, keyFor, defaultShuffle),
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [state, setState] = useState(initialMemoryState);
  // Cumulative turns from rounds already finished, for the final summary.
  const [finished, setFinished] = useState<{ turns: number }>({ turns: 0 });
  // While a mismatch is showing, taps are blocked (`busy`); the two wrong cards
  // stay face up (reducer keeps them in `faceUp`) until the timer flips them back.
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const flipBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
  }, []);

  // Total pairs across every round (== the topic's word count) drives the
  // perfect-run check: turns === pairs means every pair was found first try.
  const totalPairs = useMemo(
    () => rounds.reduce((sum, r) => sum + r.pairs.length, 0),
    [rounds],
  );

  if (topic.items.length === 0) return null;

  const round = rounds[roundIndex];
  const isLastRound = roundIndex === rounds.length - 1;
  const roundComplete = state.matchedKeys.length === round.pairs.length;

  const byKey = new Map(topic.items.map((it) => [keyFor(it), it]));
  const englishFor = (key: string) => byKey.get(key)?.english ?? "";

  function handleTap(card: MemoryCard) {
    if (busy) return;
    const { state: next, result } = flipCard(state, card);
    if (result === "ignored") return;
    setState(next);

    if (result === "match") {
      // Positive-only: every matched pair records exactly one correct answer.
      onRecord(card.key, true);
      setAnnouncement(`Matched ${englishFor(card.key)}`);
      if (next.matchedKeys.length === round.pairs.length && isLastRound) {
        track("memory_completed", {
          topic: topic.slug,
          turns: finished.turns + next.turns,
          pairs: totalPairs,
        });
      }
      return;
    }

    if (result === "mismatch") {
      // Both cards stay face up (kept in `faceUp` by the reducer) so the learner
      // can read them, then flip back together when the timer fires.
      setAnnouncement("Not a match");
      setBusy(true);
      flipBackTimer.current = setTimeout(() => {
        setState((s) => clearMismatch(s));
        setBusy(false);
      }, MISMATCH_SHOW_MS);
    }
  }

  function nextRound() {
    setFinished((f) => ({ turns: f.turns + state.turns }));
    setRoundIndex((i) => i + 1);
    setState(initialMemoryState());
    setBusy(false);
    setAnnouncement("");
  }

  function playAgain() {
    setRounds(buildMemoryRounds(topic.items, keyFor, defaultShuffle));
    setRoundIndex(0);
    setState(initialMemoryState());
    setFinished({ turns: 0 });
    setBusy(false);
    setAnnouncement("");
  }

  const srStatus = (
    <p className="sr-only" role="status" aria-live="polite">
      {announcement}
    </p>
  );

  // ── Game-complete summary ──
  if (roundComplete && isLastRound) {
    const totalTurns = finished.turns + state.turns;
    const perfect = totalTurns === totalPairs;
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Memory game"
      >
        {srStatus}
        <p className="text-6xl">🎉</p>
        <p className="mt-4 text-2xl font-semibold text-white">
          {perfect ? "Incredible memory!" : "All pairs found!"}
        </p>
        <p className="mt-2 text-slate-400">
          {perfect
            ? `${totalTurns} turns · every pair first try`
            : `${totalTurns} turns · ${totalPairs} pairs`}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={playAgain}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onTakeQuiz}
            className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
          >
            Take the quiz
          </button>
        </div>
      </section>
    );
  }

  // ── Between-rounds interstitial ──
  if (roundComplete) {
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Memory game"
      >
        {srStatus}
        <p className="text-5xl">✅</p>
        <p className="mt-4 text-xl font-semibold text-white">
          Round {roundIndex + 1} done
        </p>
        <p className="mt-2 text-slate-400">
          {state.turns} {state.turns === 1 ? "turn" : "turns"}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={nextRound}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            Round {roundIndex + 2}
          </button>
        </div>
      </section>
    );
  }

  // ── Playing board ──
  function renderCard(card: MemoryCard) {
    const matched = state.matchedKeys.includes(card.key);
    const up = state.faceUp.some((c) => c.id === card.id);
    const revealed = matched || up;

    // Content face styling: matched pairs dim and pop; a just-flipped card gets a
    // brighter surface; face-down cards share the quiet tile fill.
    let backStyles: string;
    if (matched) {
      backStyles =
        "border-emerald-300/40 bg-emerald-400/20 text-emerald-100 opacity-40 animate-quiz-correct";
    } else {
      backStyles = "border-emerald-300/60 bg-emerald-400/10 text-white";
    }

    return (
      <button
        key={card.id}
        type="button"
        onClick={() => handleTap(card)}
        disabled={matched || busy}
        aria-pressed={revealed}
        // Face-down cards must NOT leak their hanzi/English to assistive tech, so
        // the visual faces below are aria-hidden and the button carries the only
        // accessible name — a neutral placeholder until the card is revealed.
        aria-label={
          revealed ? `${card.label}${matched ? ", matched" : ""}` : "Face-down card"
        }
        className="memory-scene relative aspect-square min-h-[64px] min-w-0"
      >
        <div className={`memory-card h-full w-full ${revealed ? "is-up" : ""}`}>
          {/* Face-down "?" — decorative, hidden from screen readers. */}
          <div
            aria-hidden
            className="memory-face memory-face-front flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl text-slate-500"
          >
            ?
          </div>
          {/* Content face — decorative (the button's aria-label names the card),
              so it is hidden from screen readers too. */}
          <div
            aria-hidden
            className={`memory-face memory-face-back flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 text-center ${backStyles}`}
          >
            {card.side === "hanzi" ? (
              <>
                <span lang={HANZI_LANG} className="font-hanzi text-2xl leading-tight">
                  {card.label}
                </span>
                {card.pinyin ? (
                  <span lang={PINYIN_LANG} className="font-hanzi text-xs text-emerald-300/80">
                    <TonePinyin pinyin={card.pinyin} />
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm font-semibold leading-tight line-clamp-3">
                {card.label}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Memory game"
    >
      {srStatus}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-emerald-300">
          Round {roundIndex + 1} of {rounds.length}
        </p>
        <p className="text-sm text-slate-400">
          {state.matchedKeys.length}/{round.pairs.length} pairs · {state.turns} turns
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Flip two cards to find a word and its meaning.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {round.cards.map(renderCard)}
      </div>
    </section>
  );
}
