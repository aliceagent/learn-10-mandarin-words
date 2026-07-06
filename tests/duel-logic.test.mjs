import test from "node:test";
import assert from "node:assert/strict";

import {
  DUEL_HISTORY_LIMIT,
  DUEL_NAME_MAX_LENGTH,
  QUESTIONS_PER_PLAYER,
  advanceTurn,
  answerCurrent,
  appendDuelRecord,
  beginQuestion,
  buildDuelTurns,
  canonicalDuelName,
  currentTurn,
  duelResult,
  emptyDuelHistory,
  headToHeadFor,
  normalizeDuelHistory,
  questionNumberForPlayer,
  startDuel,
} from "../src/lib/duel-logic.ts";

// Identity shuffle so every assertion is deterministic (mirrors the style of
// tests/session-logic.test.mjs and tests/practice-logic.test.mjs).
const identity = (items) => [...items];

// 10 summary-shaped items (hanzi/pinyin/english only — no sentences), matching
// what homeData()'s TopicSummary carries into the duel.
function makeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    hanzi: `字${i}`,
    pinyin: `pin${i}`,
    english: `word ${i}`,
  }));
}

const keyFor = (item) => `topic:${item.hanzi}`;

function buildTurns(n, { mode = "hanzi-english", perPlayer = QUESTIONS_PER_PLAYER } = {}) {
  return buildDuelTurns(makeItems(n), mode, keyFor, perPlayer, identity);
}

// Drive the current question to "answered" by picking either the right or a
// wrong choice, so scoring scripts read clearly.
function answer(state, right) {
  const turn = state.turns[state.position];
  const choice = right
    ? turn.card.answer
    : turn.card.choices.find((c) => c !== turn.card.answer);
  return answerCurrent(state, choice);
}

test("buildDuelTurns alternates players 0,1,0,1… with equal per-player counts", () => {
  const turns = buildTurns(10);
  assert.equal(turns.length, 10);
  turns.forEach((t, i) => assert.equal(t.player, i % 2));
  assert.equal(turns.filter((t) => t.player === 0).length, 5);
  assert.equal(turns.filter((t) => t.player === 1).length, 5);
  // Every card is a real 4-choice card whose key came from keyFor.
  for (const t of turns) {
    assert.equal(t.card.choices.length, 4);
    assert.equal(new Set(t.card.choices).size, 4, "choices are unique");
    assert.ok(t.card.choices.includes(t.card.answer));
    assert.match(t.card.key, /^topic:/);
  }
  // Every quizzed word appears exactly once across the turns.
  const keys = turns.map((t) => t.card.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("buildDuelTurns clamps an odd pool to an even turn count", () => {
  const turns = buildTurns(7);
  assert.equal(turns.length, 6);
  assert.equal(turns.filter((t) => t.player === 0).length, 3);
  assert.equal(turns.filter((t) => t.player === 1).length, 3);
});

test("buildDuelTurns caps at 2×perPlayer even with a large pool", () => {
  assert.equal(buildTurns(10, { perPlayer: 3 }).length, 6);
  assert.equal(buildTurns(2).length, 2);
  assert.equal(buildTurns(1).length, 0); // fewer than two words → no duel
  assert.equal(buildTurns(0).length, 0);
});

test("buildDuelTurns carries promptPinyin in hanzi-english mode (pinyin on Chinese lines)", () => {
  const [turn] = buildTurns(10);
  assert.ok(turn.card.promptPinyin, "hanzi-english prompt has pinyin");
});

test("startDuel seeds a handoff, zero scores, and empty missed lists", () => {
  const state = startDuel(buildTurns(10));
  assert.equal(state.phase, "handoff");
  assert.equal(state.position, 0);
  assert.deepEqual(state.scores, [0, 0]);
  assert.deepEqual(state.missedKeys, [[], []]);
  assert.equal(state.picked, null);
  assert.equal(currentTurn(state).player, 0);
});

test("startDuel([]) is immediately done", () => {
  const state = startDuel([]);
  assert.equal(state.phase, "done");
  assert.equal(currentTurn(state), null);
  assert.deepEqual(duelResult(state), { winner: "tie", scores: [0, 0] });
});

test("phase legality: illegal transitions are no-ops", () => {
  const handoff = startDuel(buildTurns(10));
  // Can't answer during handoff.
  assert.equal(answerCurrent(handoff, handoff.turns[0].card.answer), handoff);
  // Can't advance during handoff.
  assert.equal(advanceTurn(handoff), handoff);

  const question = beginQuestion(handoff);
  assert.equal(question.phase, "question");
  // beginQuestion during question is a no-op.
  assert.equal(beginQuestion(question), question);

  const answered = answer(question, true);
  assert.equal(answered.phase, "answered");
  // Answering twice is a no-op; beginQuestion during answered is a no-op.
  assert.equal(answerCurrent(answered, answered.turns[0].card.answer), answered);
  assert.equal(beginQuestion(answered), answered);
});

test("scoring credits only the current player; wrong answers fill only their missed list", () => {
  let state = startDuel(buildTurns(10));
  // Turn 0 (player 0) correct.
  state = beginQuestion(state);
  state = answer(state, true);
  assert.deepEqual(state.scores, [1, 0]);
  assert.deepEqual(state.missedKeys, [[], []]);
  const missedByP1 = state.turns[1].card.key;
  // Turn 1 (player 1) wrong.
  state = advanceTurn(state);
  state = beginQuestion(state);
  state = answer(state, false);
  assert.deepEqual(state.scores, [1, 0]);
  assert.deepEqual(state.missedKeys, [[], [missedByP1]]);
});

test("questionNumberForPlayer counts the active player's turns", () => {
  let state = startDuel(buildTurns(10));
  assert.deepEqual(questionNumberForPlayer(state), { asked: 1, of: 5 });
  state = beginQuestion(state);
  state = answer(state, true);
  state = advanceTurn(state); // now player 1's first turn
  assert.deepEqual(questionNumberForPlayer(state), { asked: 1, of: 5 });
  state = beginQuestion(state);
  state = answer(state, true);
  state = advanceTurn(state); // player 0's second turn
  assert.deepEqual(questionNumberForPlayer(state), { asked: 2, of: 5 });
});

test("a full duel ends in done with the right winner", () => {
  let state = startDuel(buildTurns(10));
  // Player 0 gets every question right, player 1 every question wrong.
  while (state.phase !== "done") {
    state = beginQuestion(state);
    const isP0 = state.turns[state.position].player === 0;
    state = answer(state, isP0);
    state = advanceTurn(state);
  }
  assert.equal(state.phase, "done");
  assert.equal(state.position, state.turns.length);
  assert.deepEqual(state.scores, [5, 0]);
  assert.deepEqual(duelResult(state), { winner: 0, scores: [5, 0] });
});

test("duelResult reports a tie on equal scores and the higher player otherwise", () => {
  assert.equal(duelResult({ scores: [3, 3] }).winner, "tie");
  assert.equal(duelResult({ scores: [4, 2] }).winner, 0);
  assert.equal(duelResult({ scores: [1, 5] }).winner, 1);
});

test("transitions are pure — inputs are never mutated", () => {
  const state = startDuel(buildTurns(10));
  const snapshot = JSON.stringify(state);
  const q = beginQuestion(state);
  answerCurrent(q, q.turns[0].card.answer);
  advanceTurn(answerCurrent(q, q.turns[0].card.answer));
  assert.equal(JSON.stringify(state), snapshot);
});

test("normalizeDuelHistory survives garbage and caps results", () => {
  assert.deepEqual(normalizeDuelHistory(null), emptyDuelHistory());
  assert.deepEqual(normalizeDuelHistory("nope"), emptyDuelHistory());
  assert.deepEqual(normalizeDuelHistory(42), emptyDuelHistory());

  const dirty = {
    schemaVersion: 99,
    names: ["A very long name that exceeds the max", 7],
    results: [
      { at: "2026-07-05T00:00:00.000Z", topicSlug: "pets", mode: "hanzi-english", scores: [3, 2] },
      { at: "x", topicSlug: "pets", mode: "not-a-mode", scores: [1, 1] }, // bad mode → dropped
      { topicSlug: "pets", mode: "hanzi-english", scores: [1, 1] }, // missing `at` → dropped
      { at: "y", topicSlug: "pets", mode: "hanzi-english", scores: [1] }, // bad scores → dropped
      "junk",
      null,
    ],
  };
  const norm = normalizeDuelHistory(dirty);
  assert.equal(norm.schemaVersion, 1);
  assert.equal(norm.names[0].length, DUEL_NAME_MAX_LENGTH);
  assert.equal(norm.names[1], ""); // non-string name coerced
  assert.equal(norm.results.length, 1);
  assert.deepEqual(norm.results[0].scores, [3, 2]);

  // Negative / non-finite / float scores are coerced to safe non-negative ints.
  const coerced = normalizeDuelHistory({
    names: ["p", "q"],
    results: [{ at: "z", topicSlug: "t", mode: "listening", scores: [-4, 2.9] }],
  });
  assert.deepEqual(coerced.results[0].scores, [0, 2]);

  // Cap at DUEL_HISTORY_LIMIT.
  const many = {
    names: ["p", "q"],
    results: Array.from({ length: 30 }, (_, i) => ({
      at: `t${i}`,
      topicSlug: "t",
      mode: "hanzi-english",
      scores: [i, 0],
    })),
  };
  assert.equal(normalizeDuelHistory(many).results.length, DUEL_HISTORY_LIMIT);
});

test("appendDuelRecord prepends newest-first and drops the oldest past the cap", () => {
  let history = emptyDuelHistory();
  for (let i = 0; i < DUEL_HISTORY_LIMIT + 5; i++) {
    history = appendDuelRecord(history, {
      at: `t${i}`,
      topicSlug: "t",
      mode: "hanzi-english",
      scores: [i, 0],
      names: ["Alice", "Bob"],
    });
  }
  assert.equal(history.results.length, DUEL_HISTORY_LIMIT);
  // Newest (highest i) is first; the five oldest were dropped.
  assert.equal(history.results[0].at, `t${DUEL_HISTORY_LIMIT + 4}`);
  assert.equal(history.results.at(-1).at, `t5`);
  // The new per-record names field survives the cap.
  assert.deepEqual(history.results[0].names, ["Alice", "Bob"]);
});

// ── Per-record names: normalization + back-fill ──────────────────────────────

test("normalizeDuelHistory back-fills legacy records without names from the top-level pair", () => {
  const norm = normalizeDuelHistory({
    names: ["Alice", "Bob"],
    results: [
      // Legacy payload: no `names` on the record at all.
      { at: "t0", topicSlug: "pets", mode: "hanzi-english", scores: [3, 2] },
    ],
  });
  assert.deepEqual(norm.results[0].names, ["Alice", "Bob"]);
});

test("normalizeDuelHistory coerces junk record names to '' then back-fills both-empty", () => {
  const norm = normalizeDuelHistory({
    names: ["Alice", "Bob"],
    results: [
      { at: "t0", topicSlug: "pets", mode: "hanzi-english", scores: [1, 0], names: [7, null] },
    ],
  });
  // Junk names → ["",""] → back-filled from the stored pair.
  assert.deepEqual(norm.results[0].names, ["Alice", "Bob"]);
});

test("normalizeDuelHistory keeps a record's own names and truncates over-long ones", () => {
  const long = "A very long name that exceeds the max";
  const norm = normalizeDuelHistory({
    names: ["Stored", "Pair"],
    results: [
      { at: "t0", topicSlug: "pets", mode: "hanzi-english", scores: [2, 1], names: [long, "Bob"] },
    ],
  });
  // A record with its own names is NOT back-filled; the long one is capped.
  assert.equal(norm.results[0].names[0].length, DUEL_NAME_MAX_LENGTH);
  assert.equal(norm.results[0].names[1], "Bob");
});

test("normalizeDuelHistory round-trips a fully valid record unchanged", () => {
  const rec = {
    at: "2026-07-05T00:00:00.000Z",
    topicSlug: "pets",
    mode: "hanzi-english",
    scores: [3, 2],
    names: ["Alice", "Bob"],
  };
  const norm = normalizeDuelHistory({ schemaVersion: 1, names: ["Alice", "Bob"], results: [rec] });
  assert.deepEqual(norm.results[0], rec);
});

// ── canonicalDuelName + headToHeadFor ────────────────────────────────────────

test("canonicalDuelName trims and lowercases for matching", () => {
  assert.equal(canonicalDuelName("  Alice "), "alice");
  assert.equal(canonicalDuelName("BOB"), "bob");
});

// Build a history from a list of {names, scores} records (order/topic/mode fixed).
function historyOf(records) {
  return {
    schemaVersion: 1,
    names: ["", ""],
    results: records.map((r, i) => ({
      at: `t${i}`,
      topicSlug: "t",
      mode: "hanzi-english",
      scores: r.scores,
      names: r.names,
    })),
  };
}

test("headToHeadFor on empty history is all zeros", () => {
  assert.deepEqual(headToHeadFor(emptyDuelHistory(), ["Alice", "Bob"]), {
    wins: [0, 0],
    ties: 0,
    total: 0,
  });
});

test("headToHeadFor counts wins per index and ties for an exact pair", () => {
  const history = historyOf([
    { names: ["Alice", "Bob"], scores: [5, 3] }, // Alice
    { names: ["Alice", "Bob"], scores: [2, 4] }, // Bob
    { names: ["Alice", "Bob"], scores: [3, 3] }, // tie
  ]);
  assert.deepEqual(headToHeadFor(history, ["Alice", "Bob"]), {
    wins: [1, 1],
    ties: 1,
    total: 3,
  });
});

test("headToHeadFor matches a reversed pair with scores swapped into query order", () => {
  // Record stored as [Bob, Alice] with Bob winning 5–3; queried as [Alice, Bob].
  const history = historyOf([{ names: ["Bob", "Alice"], scores: [5, 3] }]);
  assert.deepEqual(headToHeadFor(history, ["Alice", "Bob"]), {
    wins: [0, 1], // the win belongs to Bob (query index 1)
    ties: 0,
    total: 1,
  });
});

test("headToHeadFor matching is case- and whitespace-insensitive", () => {
  const history = historyOf([{ names: ["alice", "BOB"], scores: [4, 1] }]);
  assert.deepEqual(headToHeadFor(history, [" Alice ", "bob"]), {
    wins: [1, 0],
    ties: 0,
    total: 1,
  });
});

test("headToHeadFor excludes records for a different pair", () => {
  const history = historyOf([
    { names: ["Alice", "Bob"], scores: [5, 0] },
    { names: ["Charlie", "Dana"], scores: [3, 2] },
  ]);
  assert.deepEqual(headToHeadFor(history, ["Alice", "Bob"]), {
    wins: [1, 0],
    ties: 0,
    total: 1,
  });
});

test("headToHeadFor with identical names on both sides falls back to ordered matching", () => {
  // Same canonical name on both sides: can't tell the sides apart, so a reversed
  // record must not be double-counted — only the exact index-order match counts.
  const history = historyOf([{ names: ["Sam", "Sam"], scores: [3, 1] }]);
  assert.deepEqual(headToHeadFor(history, ["Sam", "Sam"]), {
    wins: [1, 0],
    ties: 0,
    total: 1,
  });
});
