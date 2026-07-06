import type { VocabItem } from "./types";
// Explicit `.ts` extension so this runtime import resolves under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept it via `allowImportingTsExtensions`.
import { defaultShuffle } from "./quiz-logic.ts";

// Pure logic for the concentration-style "Memory" flip game: round building plus
// a synchronous flip reducer. The panel holds `useState<MemoryState>` and calls
// `flipCard` on every tap, so every rule here is testable without React or the
// DOM. Unlike match-logic.ts (two always-visible columns), a round's cards are
// all face down and shuffled into ONE array — the learner flips two at a time to
// find a hanzi card and its English partner. Nothing here touches the DOM,
// localStorage, timers, or a backend.

export type MemoryCard = {
  /** `${side}:${key}` — unique on-screen identity for this round. */
  id: string;
  key: string;
  side: "hanzi" | "english";
  label: string;
  /** Set on hanzi cards only, for the pinyin line under the hanzi face. */
  pinyin?: string;
};

export type MemoryRound = {
  pairs: { key: string; hanzi: string; pinyin: string; english: string }[];
  /** Both sides of every pair, shuffled together into one face-down grid. */
  cards: MemoryCard[];
};

export type MemoryState = {
  /** Cards currently face up: 0, 1, or 2 (2 = a mismatch is showing). */
  faceUp: MemoryCard[];
  /** Keys of pairs solved this round, in match order. */
  matchedKeys: string[];
  /** Completed two-card flips (a mismatch or a match each count once). */
  turns: number;
};

export type MemoryOutcome = {
  state: MemoryState;
  result: "reveal" | "match" | "mismatch" | "ignored";
};

/**
 * Chunk items into rounds of `roundSize` (default 5) preserving the top-level
 * shuffle order. Each round's `cards` array holds BOTH the hanzi and English
 * card for every pair, shuffled together into one array (unlike match-logic's
 * two separate columns). With 10 items and an identity shuffle this yields two
 * rounds of 5 pairs (10 cards each); with 7 items, rounds of 5 and 2.
 */
export function buildMemoryRounds(
  items: VocabItem[],
  keyFor: (i: VocabItem) => string,
  shuffle: <T>(x: T[]) => T[] = defaultShuffle,
  roundSize = 5,
): MemoryRound[] {
  const ordered = shuffle(items);
  const rounds: MemoryRound[] = [];
  for (let i = 0; i < ordered.length; i += roundSize) {
    const chunk = ordered.slice(i, i + roundSize);
    const pairs = chunk.map((item) => ({
      key: keyFor(item),
      hanzi: item.hanzi,
      pinyin: item.pinyin,
      english: item.english,
    }));
    // Build both cards for each pair, then shuffle the whole set so hanzi and
    // English cards are interleaved across the grid.
    const cards: MemoryCard[] = [];
    for (const p of pairs) {
      cards.push({ id: `hanzi:${p.key}`, key: p.key, side: "hanzi", label: p.hanzi, pinyin: p.pinyin });
      cards.push({ id: `english:${p.key}`, key: p.key, side: "english", label: p.english });
    }
    rounds.push({ pairs, cards: shuffle(cards) });
  }
  return rounds;
}

export function initialMemoryState(): MemoryState {
  return { faceUp: [], matchedKeys: [], turns: 0 };
}

/**
 * Apply a card flip. Pure and never-mutating — returns a fresh state and the
 * kind of thing that happened so the panel can drive animations:
 *  - card's pair already solved, card already face up, or two cards already face
 *    up (mismatch pending): no-op (same state, "ignored").
 *  - nothing face up: reveal it ("reveal").
 *  - one card face up, same key + other side → a match: append the key to
 *    matchedKeys, clear faceUp, turns+1 ("match").
 *  - one card face up, different key → a mismatch: KEEP both in faceUp (so the
 *    panel can show them before flipping back), turns+1 ("mismatch").
 */
export function flipCard(state: MemoryState, card: MemoryCard): MemoryOutcome {
  // A card whose pair is already solved is locked, a mismatch is still showing
  // (two face up), or the card itself is already face up — tapping does nothing.
  if (
    state.matchedKeys.includes(card.key) ||
    state.faceUp.length === 2 ||
    state.faceUp.some((c) => c.id === card.id)
  ) {
    return { state, result: "ignored" };
  }
  // First flip of the turn.
  if (state.faceUp.length === 0) {
    return { state: { ...state, faceUp: [card] }, result: "reveal" };
  }
  // Second flip completes a turn.
  const turns = state.turns + 1;
  const [first] = state.faceUp;
  if (first.key === card.key) {
    return {
      state: {
        ...state,
        faceUp: [],
        turns,
        matchedKeys: [...state.matchedKeys, card.key],
      },
      result: "match",
    };
  }
  // Mismatch: keep BOTH cards face up so the panel can flash them before the
  // timer calls clearMismatch.
  return {
    state: { ...state, faceUp: [first, card], turns },
    result: "mismatch",
  };
}

/** Flip the mismatched pair back down. Pure; leaves counts untouched. */
export function clearMismatch(state: MemoryState): MemoryState {
  return { ...state, faceUp: [] };
}

export function isRoundComplete(state: MemoryState, round: MemoryRound): boolean {
  return state.matchedKeys.length === round.pairs.length;
}
