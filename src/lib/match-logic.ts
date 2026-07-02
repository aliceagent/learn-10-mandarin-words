import type { VocabItem } from "./types";
// Explicit `.ts` extension so this runtime import resolves under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept it via `allowImportingTsExtensions`.
import { defaultShuffle } from "./quiz-logic.ts";

// Pure logic for the matching-pairs game: round building plus a synchronous
// selection reducer. The panel holds `useState<MatchingState>` and calls
// `selectTile` on every tap, so every rule here is testable without React or the
// DOM. Nothing here touches the DOM, localStorage, timers, or a backend.

export type MatchTile = { key: string; side: "hanzi" | "english"; label: string };

export type MatchingRound = {
  pairs: { key: string; hanzi: string; english: string }[];
  hanziTiles: MatchTile[];
  englishTiles: MatchTile[];
};

export type MatchingState = {
  /** The tile awaiting its partner, or null when nothing is selected. */
  selected: MatchTile | null;
  /** Keys of pairs solved this round, in match order. */
  matchedKeys: string[];
  /** Keys (hanzi-side) that mismatched at least once this round, deduped. */
  missedKeys: string[];
  /** Completed two-tile attempts (a select+check counts once). */
  attempts: number;
};

export type MatchOutcome = {
  state: MatchingState;
  result: "selected" | "reselected" | "match" | "mismatch";
};

/**
 * Chunk items into rounds of `roundSize` (default 5) preserving the top-level
 * shuffle order; each round's two tile arrays are shuffled independently so the
 * hanzi and English columns don't line up. With 10 items and an identity shuffle
 * this yields two rounds (first 5, last 5); with 7 items, rounds of 5 and 2.
 */
export function buildMatchingRounds(
  items: VocabItem[],
  keyFor: (i: VocabItem) => string,
  shuffle: <T>(x: T[]) => T[] = defaultShuffle,
  roundSize = 5,
): MatchingRound[] {
  const ordered = shuffle(items);
  const rounds: MatchingRound[] = [];
  for (let i = 0; i < ordered.length; i += roundSize) {
    const chunk = ordered.slice(i, i + roundSize);
    const pairs = chunk.map((item) => ({
      key: keyFor(item),
      hanzi: item.hanzi,
      english: item.english,
    }));
    const hanziTiles: MatchTile[] = shuffle(pairs).map((p) => ({
      key: p.key,
      side: "hanzi",
      label: p.hanzi,
    }));
    const englishTiles: MatchTile[] = shuffle(pairs).map((p) => ({
      key: p.key,
      side: "english",
      label: p.english,
    }));
    rounds.push({ pairs, hanziTiles, englishTiles });
  }
  return rounds;
}

export function initialMatchingState(): MatchingState {
  return { selected: null, matchedKeys: [], missedKeys: [], attempts: 0 };
}

/**
 * Apply a tile tap. Pure and never-mutating — returns a fresh state and the kind
 * of thing that happened so the component can drive animations:
 *  - tile already matched: no-op (same state, "reselected").
 *  - nothing selected: select it ("selected").
 *  - same side as the current selection: move the selection ("reselected").
 *  - other side, same key: a match — append to matchedKeys, attempts+1, clear.
 *  - other side, different key: a mismatch — attempts+1, add the hanzi-side
 *    tile's key to missedKeys if absent, clear.
 */
export function selectTile(state: MatchingState, tile: MatchTile): MatchOutcome {
  // A tile whose pair is already solved is locked — tapping it does nothing.
  if (state.matchedKeys.includes(tile.key)) {
    return { state, result: "reselected" };
  }
  // First pick of the attempt.
  if (state.selected === null) {
    return { state: { ...state, selected: tile }, result: "selected" };
  }
  // Tapping the same column just moves the selection; no attempt is spent.
  if (state.selected.side === tile.side) {
    return { state: { ...state, selected: tile }, result: "reselected" };
  }
  // The other column now completes a two-tile attempt.
  const attempts = state.attempts + 1;
  if (state.selected.key === tile.key) {
    return {
      state: {
        ...state,
        selected: null,
        attempts,
        matchedKeys: [...state.matchedKeys, tile.key],
      },
      result: "match",
    };
  }
  // Mismatch: attribute the miss to the hanzi-side word (deduped), so a word is
  // only ever recorded as missed once per round regardless of retries.
  const hanziKey = tile.side === "hanzi" ? tile.key : state.selected.key;
  const missedKeys = state.missedKeys.includes(hanziKey)
    ? state.missedKeys
    : [...state.missedKeys, hanziKey];
  return {
    state: { ...state, selected: null, attempts, missedKeys },
    result: "mismatch",
  };
}
