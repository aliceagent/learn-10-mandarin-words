"use client";

import { useEffect, useRef, useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { defaultShuffle } from "@/lib/quiz-logic";
import {
  buildMatchingRounds,
  initialMatchingState,
  selectTile,
  type MatchTile,
} from "@/lib/match-logic";
import { track } from "@/lib/analytics";

// The "Match" tab: a tap-to-match game. Hanzi tiles on the left, English on the
// right, five pairs a round, two rounds per (10-word) topic. All selection rules
// live in src/lib/match-logic.ts — this panel only holds game state, the
// mismatch-flash timer, and the render. Misses/clean matches feed the same
// recordQuizAnswer path as the quiz (one signal per word per round), so they
// surface in Trickiest words and /practice. No schema change.

const MISMATCH_FLASH_MS = 350;

// A tile's on-screen identity (a word appears once per side).
function tileId(tile: MatchTile): string {
  return `${tile.side}:${tile.key}`;
}

export function MatchPanel({
  topic,
  onRecord,
  onTakeQuiz,
}: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
  onTakeQuiz: () => void;
}) {
  const keyFor = (item: VocabItem) => wordKey(topic, item);

  // Rounds are built once per mount/restart so answering never reshuffles them.
  const [rounds, setRounds] = useState(() =>
    buildMatchingRounds(topic.items, keyFor, defaultShuffle),
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [state, setState] = useState(initialMatchingState);
  // Cumulative attempts/misses from rounds already finished, for the final summary.
  const [finished, setFinished] = useState<{ attempts: number; missedKeys: string[] }>({
    attempts: 0,
    missedKeys: [],
  });
  // While a mismatch flashes rose, taps are blocked (`busy`) and the two wrong
  // tiles are highlighted via `flash` (tile ids). The reducer stays synchronous.
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  if (topic.items.length === 0) return null;

  const round = rounds[roundIndex];
  const isLastRound = roundIndex === rounds.length - 1;
  const roundComplete = state.matchedKeys.length === round.pairs.length;

  const byKey = new Map(topic.items.map((it) => [keyFor(it), it]));
  const englishFor = (key: string) => byKey.get(key)?.english ?? "";

  function handleTap(tile: MatchTile) {
    if (busy) return;
    const prev = state;
    const { state: next, result } = selectTile(prev, tile);
    setState(next);

    if (result === "match") {
      // Clean match: record a correct signal only if this word was never missed
      // this round (a missed-then-matched pair already recorded an incorrect).
      if (!prev.missedKeys.includes(tile.key)) onRecord(tile.key, true);
      setAnnouncement(`Matched ${englishFor(tile.key)}`);
      if (next.matchedKeys.length === round.pairs.length && isLastRound) {
        const misses = new Set([...finished.missedKeys, ...next.missedKeys]).size;
        track("matching_completed", {
          topic: topic.slug,
          attempts: finished.attempts + next.attempts,
          misses,
        });
      }
      return;
    }

    if (result === "mismatch") {
      // A newly-added missed key means this is the word's first miss this round.
      if (next.missedKeys.length > prev.missedKeys.length) {
        onRecord(next.missedKeys[next.missedKeys.length - 1], false);
      }
      setAnnouncement("Not a match");
      setBusy(true);
      setFlash([tileId(prev.selected as MatchTile), tileId(tile)]);
      flashTimer.current = setTimeout(() => {
        setBusy(false);
        setFlash(null);
      }, MISMATCH_FLASH_MS);
    }
  }

  function nextRound() {
    setFinished((f) => ({
      attempts: f.attempts + state.attempts,
      missedKeys: [...f.missedKeys, ...state.missedKeys],
    }));
    setRoundIndex((i) => i + 1);
    setState(initialMatchingState());
    setFlash(null);
    setBusy(false);
    setAnnouncement("");
  }

  function playAgain() {
    setRounds(buildMatchingRounds(topic.items, keyFor, defaultShuffle));
    setRoundIndex(0);
    setState(initialMatchingState());
    setFinished({ attempts: 0, missedKeys: [] });
    setFlash(null);
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
    const totalAttempts = finished.attempts + state.attempts;
    const missedKeys = [...new Set([...finished.missedKeys, ...state.missedKeys])];
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Matching game"
      >
        {srStatus}
        <p className="text-6xl">{missedKeys.length === 0 ? "🎉" : "💪"}</p>
        <p className="mt-4 text-2xl font-semibold text-white">Both rounds cleared!</p>
        <p className="mt-2 text-slate-400">
          {totalAttempts} taps · {missedKeys.length === 0 ? "no misses" : `${missedKeys.length} tricky`}
        </p>

        {missedKeys.length > 0 ? (
          <div className="mx-auto mt-6 max-w-md text-left">
            <p className="text-sm font-semibold text-slate-300">Worth another look</p>
            <ul className="mt-3 space-y-2">
              {missedKeys.map((key) => {
                const item = byKey.get(key);
                if (!item) return null;
                return (
                  <li
                    key={key}
                    className="flex items-baseline justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2"
                  >
                    <span className="font-hanzi text-lg text-white">{item.hanzi}</span>
                    <span className="font-hanzi text-sm text-emerald-300/80">{item.pinyin}</span>
                    <span className="text-sm text-slate-400">{item.english}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={playAgain}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
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
    const clean = round.pairs.length - state.missedKeys.length;
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Matching game"
      >
        {srStatus}
        <p className="text-5xl">✅</p>
        <p className="mt-4 text-xl font-semibold text-white">
          Round {roundIndex + 1} done
        </p>
        <p className="mt-2 text-slate-400">
          {state.attempts} taps · {clean} clean {clean === 1 ? "match" : "matches"}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={nextRound}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Round {roundIndex + 2}
          </button>
        </div>
      </section>
    );
  }

  // ── Playing board ──
  function renderTile(tile: MatchTile) {
    const matched = state.matchedKeys.includes(tile.key);
    const selected =
      state.selected !== null &&
      state.selected.side === tile.side &&
      state.selected.key === tile.key;
    const wrong = flash?.includes(tileId(tile)) ?? false;

    let styles: string;
    if (matched) {
      styles =
        "border-emerald-300/40 bg-emerald-400/20 text-emerald-100 opacity-40 animate-quiz-correct";
    } else if (wrong) {
      styles = "border-rose-400/70 bg-rose-400/15 text-rose-200 animate-quiz-wrong";
    } else if (selected) {
      styles = "border-emerald-300 bg-emerald-400/10 text-white";
    } else {
      styles = "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25";
    }

    const face =
      tile.side === "hanzi"
        ? "font-hanzi text-2xl"
        : "text-sm font-semibold line-clamp-2";

    return (
      <button
        key={tileId(tile)}
        type="button"
        onClick={() => handleTap(tile)}
        disabled={matched || busy}
        aria-pressed={selected}
        aria-label={matched ? `${tile.label}, matched` : tile.label}
        className={`flex min-h-[56px] min-w-0 items-center justify-center rounded-2xl border px-3 py-3 text-center transition-opacity ${face} ${styles}`}
      >
        {tile.label}
      </button>
    );
  }

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Matching game"
    >
      {srStatus}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-emerald-300">
          Round {roundIndex + 1} of {rounds.length}
        </p>
        <p className="text-sm text-slate-400">
          {state.matchedKeys.length}/{round.pairs.length} matched · {state.attempts} taps
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-400">Tap a word, then tap its match.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="grid gap-3">{round.hanziTiles.map(renderTile)}</div>
        <div className="grid gap-3">{round.englishTiles.map(renderTile)}</div>
      </div>
    </section>
  );
}
