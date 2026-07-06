// Pure, DOM-free state machine for the pass-and-play duel (/duel). Two learners
// share one device and alternate answering multiple-choice questions from one
// topic. Modeled on session-logic.ts: every transition returns a NEW state and
// never mutates its input, and illegal-phase calls are no-ops — so the whole
// matrix is unit-testable under `node --test` with no React or DOM.
//
// Explicit `.ts` extensions on the runtime imports so this resolves under Node's
// native TS test runner (which does not add extensions), while `next build` and
// tsc accept them via `allowImportingTsExtensions` (mirrors quiz-logic.ts).
import { buildQuizCard, defaultShuffle } from "./quiz-logic.ts";
import type { QuizCard, QuizMode, QuizWord } from "./quiz-logic.ts";

export type DuelPlayerIndex = 0 | 1;
export type DuelPhase = "handoff" | "question" | "answered" | "done";

export type DuelTurn = { player: DuelPlayerIndex; card: QuizCard };

export type DuelState = {
  /** The alternating turn list, built once at the start of a duel. */
  turns: DuelTurn[];
  /** Index of the current turn within `turns` (== turns.length once done). */
  position: number;
  phase: DuelPhase;
  /** Correct-answer tally per player. */
  scores: [number, number];
  /** Choice picked on the current (answered) turn, else null. */
  picked: string | null;
  /** Per-player missed card keys, deduped, in first-missed order. */
  missedKeys: [string[], string[]];
};

/** Questions per player in a standard duel (a 10-word topic → every word once). */
export const QUESTIONS_PER_PLAYER = 5;

/** Max characters kept for a remembered player name. */
export const DUEL_NAME_MAX_LENGTH = 12;

const VALID_MODES: readonly QuizMode[] = [
  "hanzi-english",
  "english-hanzi",
  "hanzi-pinyin",
  "listening",
];

/**
 * Build an alternating turn list from a topic's items. The items are shuffled,
 * clamped to an EVEN count no greater than `2 × perPlayer` (so both players get
 * the same number of questions), and each chosen item becomes a quiz card with
 * distractors drawn from the full `items` pool. Players alternate strictly
 * 0, 1, 0, 1… Returns `[]` when there aren't at least two items.
 */
export function buildDuelTurns<T extends QuizWord>(
  items: T[],
  mode: QuizMode,
  keyFor: (item: T) => string,
  perPlayer: number = QUESTIONS_PER_PLAYER,
  shuffle: <U>(items: U[]) => U[] = defaultShuffle,
): DuelTurn[] {
  const maxTurns = Math.max(0, Math.floor(perPlayer)) * 2;
  const shuffled = shuffle(items);
  const capped = Math.min(shuffled.length, maxTurns);
  const count = capped - (capped % 2); // round down to an even number of turns
  const chosen = shuffled.slice(0, count);
  return chosen.map((item, i) => ({
    player: (i % 2) as DuelPlayerIndex,
    // Pool is the whole topic so choices stay plentiful and same-topic.
    card: buildQuizCard(item, items, mode, keyFor, shuffle),
  }));
}

/** Seed a fresh duel from a turn list. Empty list → immediately `done`. */
export function startDuel(turns: DuelTurn[]): DuelState {
  return {
    turns,
    position: 0,
    phase: turns.length === 0 ? "done" : "handoff",
    scores: [0, 0],
    picked: null,
    missedKeys: [[], []],
  };
}

/** The turn at the current position, or null once the duel is done. */
export function currentTurn(state: DuelState): DuelTurn | null {
  return state.turns[state.position] ?? null;
}

/** Reveal the current question: handoff → question. No-op in any other phase. */
export function beginQuestion(state: DuelState): DuelState {
  if (state.phase !== "handoff") return state;
  return { ...state, phase: "question" };
}

/**
 * Answer the current question: question → answered. Tallies a correct answer to
 * the current player's score, or records the card key in that player's missed
 * list (deduped). No-op in any other phase.
 */
export function answerCurrent(state: DuelState, choice: string): DuelState {
  if (state.phase !== "question") return state;
  const turn = state.turns[state.position];
  if (!turn) return state;

  const correct = choice === turn.card.answer;
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const missedKeys: [string[], string[]] = [
    [...state.missedKeys[0]],
    [...state.missedKeys[1]],
  ];
  if (correct) {
    scores[turn.player] += 1;
  } else if (!missedKeys[turn.player].includes(turn.card.key)) {
    missedKeys[turn.player].push(turn.card.key);
  }

  return { ...state, phase: "answered", picked: choice, scores, missedKeys };
}

/** Advance past the answered turn: → next handoff, or done at the end. No-op otherwise. */
export function advanceTurn(state: DuelState): DuelState {
  if (state.phase !== "answered") return state;
  const nextPos = state.position + 1;
  return {
    ...state,
    position: nextPos,
    phase: nextPos >= state.turns.length ? "done" : "handoff",
    picked: null,
  };
}

/**
 * The current player's per-player question count: `asked` is how many of their
 * turns have come at or before the current position (1-based), `of` is how many
 * turns they have in total.
 */
export function questionNumberForPlayer(state: DuelState): { asked: number; of: number } {
  const turn = state.turns[state.position];
  const player: DuelPlayerIndex = turn
    ? turn.player
    : ((state.position % 2) as DuelPlayerIndex);
  const of = state.turns.filter((t) => t.player === player).length;
  let asked = 0;
  for (let i = 0; i <= state.position && i < state.turns.length; i++) {
    if (state.turns[i].player === player) asked += 1;
  }
  return { asked, of };
}

/** Winner (or "tie") plus the final scores. */
export function duelResult(state: DuelState): {
  winner: DuelPlayerIndex | "tie";
  scores: [number, number];
} {
  const [a, b] = state.scores;
  const winner: DuelPlayerIndex | "tie" = a === b ? "tie" : a > b ? 0 : 1;
  return { winner, scores: [a, b] };
}

// ── localStorage record (key: "learn-10-mandarin-duel-v1") ──────────────────

export type DuelRecord = {
  at: string;
  topicSlug: string;
  mode: QuizMode;
  scores: [number, number];
  /** Display names at the time of the duel (index 0 = Player 1). */
  names: [string, string];
};

export type DuelHistory = {
  schemaVersion: 1;
  names: [string, string];
  results: DuelRecord[];
};

/** Newest results kept; older duels are dropped on write. */
export const DUEL_HISTORY_LIMIT = 20;

export function emptyDuelHistory(): DuelHistory {
  return { schemaVersion: 1, names: ["", ""], results: [] };
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, DUEL_NAME_MAX_LENGTH);
}

function normalizeScore(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function normalizeRecord(raw: unknown): DuelRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const at = typeof r.at === "string" ? r.at : null;
  const topicSlug = typeof r.topicSlug === "string" ? r.topicSlug : null;
  const mode = VALID_MODES.includes(r.mode as QuizMode) ? (r.mode as QuizMode) : null;
  if (at === null || topicSlug === null || mode === null) return null;
  if (!Array.isArray(r.scores) || r.scores.length !== 2) return null;
  // Legacy records predate per-record names → ["", ""], back-filled from the
  // history's top-level `names` in normalizeDuelHistory (correct for v1 payloads,
  // which only ever remembered one pair).
  const namesRaw = Array.isArray(r.names) ? r.names : [];
  return {
    at,
    topicSlug,
    mode,
    scores: [normalizeScore(r.scores[0]), normalizeScore(r.scores[1])],
    names: [normalizeName(namesRaw[0]), normalizeName(namesRaw[1])],
  };
}

/**
 * Defensively coerce anything loaded from storage into a valid DuelHistory —
 * never throws. Junk names become empty strings, malformed records are dropped,
 * and results are capped at DUEL_HISTORY_LIMIT (they are stored newest-first).
 */
export function normalizeDuelHistory(raw: unknown): DuelHistory {
  if (!raw || typeof raw !== "object") return emptyDuelHistory();
  const obj = raw as Record<string, unknown>;
  const namesRaw = Array.isArray(obj.names) ? obj.names : [];
  const names: [string, string] = [normalizeName(namesRaw[0]), normalizeName(namesRaw[1])];
  const resultsRaw = Array.isArray(obj.results) ? obj.results : [];
  const results: DuelRecord[] = [];
  for (const item of resultsRaw) {
    const rec = normalizeRecord(item);
    if (!rec) continue;
    // Back-fill a record with no names of its own from the top-level pair — the
    // only names v1 ever remembered, so legacy duels attribute correctly.
    if (!rec.names[0] && !rec.names[1]) rec.names = [names[0], names[1]];
    results.push(rec);
  }
  return { schemaVersion: 1, names, results: results.slice(0, DUEL_HISTORY_LIMIT) };
}

// ── Head-to-head tally ──────────────────────────────────────────────────────

/** Matching key for a player name: trimmed + lowercased. Display keeps user casing. */
export function canonicalDuelName(raw: string): string {
  return raw.trim().toLowerCase();
}

export type HeadToHead = {
  /** Wins attributed to the CURRENT pair's index 0 / index 1. */
  wins: [number, number];
  ties: number;
  /** Total past duels between this pair (wins + ties). */
  total: number;
};

/**
 * Tally every stored result between exactly this pair of names, order-insensitively:
 * a record whose canonical pair is the reverse of the query has its scores swapped
 * before counting, so the record survives the two players swapping input slots.
 * When both canonical names are identical (or both empty) we can't tell the sides
 * apart, so we match by index order only. A record is a win for the higher score,
 * a tie on equal scores. Note this reflects the last DUEL_HISTORY_LIMIT duels only.
 */
export function headToHeadFor(history: DuelHistory, names: [string, string]): HeadToHead {
  const [qa, qb] = [canonicalDuelName(names[0]), canonicalDuelName(names[1])];
  const ambiguous = qa === qb;
  const wins: [number, number] = [0, 0];
  let ties = 0;

  for (const rec of history.results) {
    const [ra, rb] = [canonicalDuelName(rec.names[0]), canonicalDuelName(rec.names[1])];
    let scores: [number, number] | null = null;
    if (ra === qa && rb === qb) {
      scores = rec.scores; // same slot order
    } else if (!ambiguous && ra === qb && rb === qa) {
      scores = [rec.scores[1], rec.scores[0]]; // reversed → swap to the query's order
    }
    if (!scores) continue;

    if (scores[0] > scores[1]) wins[0] += 1;
    else if (scores[1] > scores[0]) wins[1] += 1;
    else ties += 1;
  }

  return { wins, ties, total: wins[0] + wins[1] + ties };
}

/** Prepend a new result (newest-first) and cap the list at DUEL_HISTORY_LIMIT. */
export function appendDuelRecord(history: DuelHistory, record: DuelRecord): DuelHistory {
  return { ...history, results: [record, ...history.results].slice(0, DUEL_HISTORY_LIMIT) };
}
