import type { VocabItem } from "./types";
// Explicit `.ts` extension so this runtime import resolves under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept it via `allowImportingTsExtensions` — same convention as cloze-logic.ts.
import { defaultShuffle } from "./quiz-logic.ts";

// Pure logic for the "Scramble" drill: the learner rebuilds a word's real example
// sentence from shuffled hanzi chunk tiles. Everything here is DOM-free and
// injectable-shuffle, so the whole card/deck/reducer surface is unit-testable
// without React. Nothing touches the DOM, localStorage, timers, or a backend.
//
// The sentence is split into ordered chunks: the target word (and any other topic
// vocab word) stays atomic so the meaningful unit is never cut in half, and the
// remaining characters group into 2–3 char tiles. Correctness is checked by
// JOIN-EQUALITY (placed text === body), never by tile index, so two identical
// chunks (e.g. a sentence with 很 … 很) can never produce a false "wrong".

/** Max tiles per card; runs re-split coarser (3 chars) if 2-char groups exceed it. */
export const MAX_TILES = 8;

// Terminal marks end a sentence; a trailing run of these is pinned after the
// answer line (never a tile). Inner punctuation (these plus ，、；：) attaches to
// the preceding chunk so a tile never starts with a stray mark.
const TERMINAL_PUNCTUATION = /[。？！]/;
const ATTACHING_PUNCTUATION = /[。，、？！；：]/;

export type ScrambleTile = { id: number; text: string };

export type ScrambleCard = {
  /** wordKey (`topic.slug:hanzi`) — identity for recordQuizAnswer. */
  key: string;
  /** The drilled word. */
  hanzi: string;
  pinyin: string;
  english: string;
  /** Full original sentence (shown/spoken only after solving). */
  sentenceCn: string;
  /** English translation — the prompt the learner rebuilds from. */
  sentenceEn: string;
  /** sentenceCn minus its trailing terminal-punctuation run. */
  body: string;
  /** The trailing 。？！ run, pinned at the end of the answer line ("" if none). */
  ending: string;
  /** Shuffled display order; ids are assigned post-shuffle. */
  tiles: ScrambleTile[];
};

export type ScrambleState = {
  /** Tile ids placed on the answer line, in placement order. */
  placedIds: number[];
  /** How many times "Check order" ran (drives the "not quite" hint). */
  checks: number;
  /** Whether this card's result was already recorded (first check only). */
  recorded: boolean;
};

export type CheckResult = {
  solved: boolean;
  /** Count of leading placed tiles whose cumulative join is a prefix of body. */
  correctPrefixTiles: number;
};

/**
 * Strip one trailing run of terminal punctuation (。？！) off `cn` into
 * `{ body, ending }`. Only trailing marks move to `ending`; inner marks stay in
 * `body` (they become attaching punctuation during chunking). `ending` is "" when
 * the sentence has no terminal mark.
 */
export function splitEnding(cn: string): { body: string; ending: string } {
  let end = cn.length;
  while (end > 0 && TERMINAL_PUNCTUATION.test(cn[end - 1])) end--;
  return { body: cn.slice(0, end), ending: cn.slice(end) };
}

/**
 * Split `body` into ordered chunks. Occurrences of the target word and other
 * topic vocab hanzi are atomic (longest match first, so `火车站` beats `火车` when
 * both are topic words); every remaining run of characters splits into groups of
 * `size` chars with a trailing single-char leftover merged into the previous group
 * (so groups are 2–3 at size 2). Inner punctuation attaches to the end of the
 * preceding chunk, or the following chunk when sentence-initial. If 2-char groups
 * would produce more than MAX_TILES tiles, the runs re-split at size 3.
 *
 * Invariant: `chunkSentence(body, …).join("") === body`.
 */
export function chunkSentence(body: string, targetHanzi: string, vocabHanzi: string[]): string[] {
  // Longest-match-first over the unique, non-empty vocab words (target included).
  const vocab = [...new Set([targetHanzi, ...vocabHanzi])]
    .filter((w) => w.length > 0)
    .sort((a, b) => b.length - a.length);

  // Tokenize into vocab atoms, plain characters, and attaching-punctuation marks.
  type Token = { kind: "vocab" | "char" | "punct"; text: string };
  const tokens: Token[] = [];
  let i = 0;
  while (i < body.length) {
    const match = vocab.find((w) => body.startsWith(w, i));
    if (match) {
      tokens.push({ kind: "vocab", text: match });
      i += match.length;
      continue;
    }
    const ch = body[i];
    i += 1;
    tokens.push({ kind: ATTACHING_PUNCTUATION.test(ch) ? "punct" : "char", text: ch });
  }

  const group = (size: number): string[] => {
    const chunks: string[] = [];
    let run: string[] = [];
    let leading = ""; // punctuation seen before any chunk exists (sentence-initial)
    const flush = () => {
      if (run.length === 0) return;
      const groups: string[] = [];
      for (let k = 0; k < run.length; k += size) {
        groups.push(run.slice(k, k + size).join(""));
      }
      // A lone trailing character merges back into the previous group (2–3 chars).
      if (groups.length > 1 && [...groups[groups.length - 1]].length === 1) {
        groups[groups.length - 2] += groups[groups.length - 1];
        groups.pop();
      }
      chunks.push(...groups);
      run = [];
    };
    for (const token of tokens) {
      if (token.kind === "char") {
        run.push(token.text);
      } else if (token.kind === "vocab") {
        flush();
        chunks.push(token.text);
      } else {
        // Punctuation attaches to the end of the preceding chunk (or the first
        // chunk when it opens the sentence).
        flush();
        if (chunks.length > 0) chunks[chunks.length - 1] += token.text;
        else leading += token.text;
      }
    }
    flush();
    if (leading && chunks.length > 0) chunks[0] = leading + chunks[0];
    return chunks;
  };

  const twos = group(2);
  return twos.length > MAX_TILES ? group(3) : twos;
}

/**
 * Build one scramble card for `item`, drawing atomic vocab boundaries from `pool`
 * (usually the whole topic). The sentence is chosen via `shuffle(item.sentences)[0]`
 * (the cloze pattern) so tests pin it with an identity shuffle and real runs vary.
 * Tile ids are assigned AFTER shuffling the chunks; if the shuffled order happens
 * to join back to the solved sentence, it rotates by one so the card never starts
 * solved (deterministic under an identity shuffle). Returns null when a sentence
 * yields fewer than 2 tiles (defensive; real data always yields ≥ 2).
 */
export function buildScrambleCard(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): ScrambleCard | null {
  if (item.sentences.length === 0) return null;
  const sentence = shuffle(item.sentences)[0];
  const { body, ending } = splitEnding(sentence.cn);
  const chunks = chunkSentence(body, item.hanzi, pool.map((p) => p.hanzi));
  if (chunks.length < 2) return null;

  let order = shuffle(chunks);
  // Never present the sentence already solved. Rotating by one is enough and stays
  // deterministic under an identity shuffle (which returns the solved order).
  if (order.join("") === body) {
    order = [...order.slice(1), order[0]];
  }
  const tiles = order.map((text, id) => ({ id, text }));

  return {
    key: keyFor(item),
    hanzi: item.hanzi,
    pinyin: item.pinyin,
    english: item.english,
    sentenceCn: sentence.cn,
    sentenceEn: sentence.en,
    body,
    ending,
    tiles,
  };
}

/**
 * A deck of scramble cards over `items`, vocab boundaries drawn from `pool`. Items
 * whose chosen sentence yields fewer than 2 tiles are silently dropped (see
 * buildScrambleCard), mirroring buildClozeDeck — real data drops nothing.
 */
export function buildScrambleDeck(
  items: VocabItem[],
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): ScrambleCard[] {
  const cards: ScrambleCard[] = [];
  for (const item of items) {
    const card = buildScrambleCard(item, pool, keyFor, shuffle);
    if (card !== null) cards.push(card);
  }
  return cards;
}

export function initialScrambleState(): ScrambleState {
  return { placedIds: [], checks: 0, recorded: false };
}

/** The text of a placed-id sequence, joined in placement order. */
function placedText(placedIds: number[], card: ScrambleCard): string {
  const byId = new Map(card.tiles.map((t) => [t.id, t.text]));
  return placedIds.map((id) => byId.get(id) ?? "").join("");
}

/**
 * Place `tileId` on the answer line. Placing an already-placed tile is a no-op
 * (returns the same state); an unknown id is ignored. Pure — never mutates.
 */
export function placeTile(state: ScrambleState, tileId: number, card: ScrambleCard): ScrambleState {
  if (state.placedIds.includes(tileId)) return state;
  if (!card.tiles.some((t) => t.id === tileId)) return state;
  return { ...state, placedIds: [...state.placedIds, tileId] };
}

/** Return `tileId` from the answer line back to the bank. No-op if not placed. */
export function returnTile(state: ScrambleState, tileId: number): ScrambleState {
  if (!state.placedIds.includes(tileId)) return state;
  return { ...state, placedIds: state.placedIds.filter((id) => id !== tileId) };
}

/** Whether every tile has been placed (the answer line is full). */
export function isComplete(state: ScrambleState, card: ScrambleCard): boolean {
  return state.placedIds.length === card.tiles.length;
}

/**
 * Grade the current arrangement by JOIN-EQUALITY against `card.body` — the placed
 * tiles' text, concatenated, must equal the original sentence body. Never compares
 * tile ids, so duplicate chunks can't cause a false negative. `correctPrefixTiles`
 * counts the leading placed tiles whose cumulative text is a prefix of body, for
 * highlighting the good prefix while the rest shakes.
 */
export function checkArrangement(state: ScrambleState, card: ScrambleCard): CheckResult {
  const byId = new Map(card.tiles.map((t) => [t.id, t.text]));
  let cumulative = "";
  let correctPrefixTiles = 0;
  for (const id of state.placedIds) {
    cumulative += byId.get(id) ?? "";
    if (card.body.startsWith(cumulative)) correctPrefixTiles += 1;
    else break;
  }
  return {
    solved: placedText(state.placedIds, card) === card.body,
    correctPrefixTiles,
  };
}
