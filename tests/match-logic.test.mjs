import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMatchingRounds,
  initialMatchingState,
  selectTile,
} from "../src/lib/match-logic.ts";

// Identity shuffle so tile order is deterministic and assertions are exact.
const identity = (xs) => [...xs];

function makeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    hanzi: `汉${i}`,
    pinyin: `p${i}`,
    english: `english ${i}`,
    sentences: [],
  }));
}

const keyFor = (item) => `topic:${item.hanzi}`;

// ── buildMatchingRounds ───────────────────────────────────────────────────────

test("buildMatchingRounds splits 10 items into two rounds of five", () => {
  const rounds = buildMatchingRounds(makeItems(10), keyFor, identity);
  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].pairs.length, 5);
  assert.equal(rounds[1].pairs.length, 5);
  // With identity shuffle the first round holds the first five items.
  assert.deepEqual(
    rounds[0].pairs.map((p) => p.hanzi),
    ["汉0", "汉1", "汉2", "汉3", "汉4"],
  );
  assert.deepEqual(
    rounds[1].pairs.map((p) => p.hanzi),
    ["汉5", "汉6", "汉7", "汉8", "汉9"],
  );
});

test("buildMatchingRounds tolerates non-10 topics (rounds of 5 and 2)", () => {
  const rounds = buildMatchingRounds(makeItems(7), keyFor, identity);
  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].pairs.length, 5);
  assert.equal(rounds[1].pairs.length, 2);
});

test("buildMatchingRounds tiles carry the correct keys and labels", () => {
  const [round] = buildMatchingRounds(makeItems(5), keyFor, identity);
  assert.equal(round.hanziTiles.length, 5);
  assert.equal(round.englishTiles.length, 5);
  for (const tile of round.hanziTiles) assert.equal(tile.side, "hanzi");
  for (const tile of round.englishTiles) assert.equal(tile.side, "english");
  assert.deepEqual(round.hanziTiles.map((t) => t.label), ["汉0", "汉1", "汉2", "汉3", "汉4"]);
  assert.deepEqual(
    round.englishTiles.map((t) => t.label),
    ["english 0", "english 1", "english 2", "english 3", "english 4"],
  );
  // A hanzi tile and its English partner share a key.
  assert.equal(round.hanziTiles[0].key, round.englishTiles[0].key);
});

test("buildMatchingRounds is deterministic under an identity shuffle", () => {
  const a = buildMatchingRounds(makeItems(10), keyFor, identity);
  const b = buildMatchingRounds(makeItems(10), keyFor, identity);
  assert.deepEqual(a, b);
});

// ── selectTile reducer ────────────────────────────────────────────────────────

function tilesFor(item) {
  return {
    hanzi: { key: keyFor(item), side: "hanzi", label: item.hanzi },
    english: { key: keyFor(item), side: "english", label: item.english },
  };
}

test("selectTile: hanzi then its english is a match, one attempt", () => {
  const [a] = makeItems(2);
  const t = tilesFor(a);
  const first = selectTile(initialMatchingState(), t.hanzi);
  assert.equal(first.result, "selected");
  assert.deepEqual(first.state.selected, t.hanzi);

  const second = selectTile(first.state, t.english);
  assert.equal(second.result, "match");
  assert.equal(second.state.attempts, 1);
  assert.deepEqual(second.state.matchedKeys, [keyFor(a)]);
  assert.equal(second.state.selected, null);
  assert.deepEqual(second.state.missedKeys, []);
});

test("selectTile: mismatch records the hanzi key once, even on a repeat", () => {
  const [a, b] = makeItems(2);
  const ta = tilesFor(a);
  const tb = tilesFor(b);

  let out = selectTile(initialMatchingState(), ta.hanzi);
  out = selectTile(out.state, tb.english);
  assert.equal(out.result, "mismatch");
  assert.equal(out.state.attempts, 1);
  assert.deepEqual(out.state.missedKeys, [keyFor(a)]);
  assert.equal(out.state.selected, null);

  // Same wrong pairing again — attempts grows, but the miss isn't duplicated.
  out = selectTile(out.state, ta.hanzi);
  out = selectTile(out.state, tb.english);
  assert.equal(out.result, "mismatch");
  assert.equal(out.state.attempts, 2);
  assert.deepEqual(out.state.missedKeys, [keyFor(a)]);
});

test("selectTile: mismatch attributes the miss to the hanzi word regardless of tap order", () => {
  const [a, b] = makeItems(2);
  const ta = tilesFor(a);
  const tb = tilesFor(b);
  // Tap english first, then a non-matching hanzi.
  let out = selectTile(initialMatchingState(), tb.english);
  out = selectTile(out.state, ta.hanzi);
  assert.equal(out.result, "mismatch");
  assert.deepEqual(out.state.missedKeys, [keyFor(a)]);
});

test("selectTile: tapping the same side moves the selection without an attempt", () => {
  const [a, b] = makeItems(2);
  const ta = tilesFor(a);
  const tb = tilesFor(b);
  const first = selectTile(initialMatchingState(), ta.hanzi);
  const second = selectTile(first.state, tb.hanzi);
  assert.equal(second.result, "reselected");
  assert.deepEqual(second.state.selected, tb.hanzi);
  assert.equal(second.state.attempts, 0);
});

test("selectTile: tapping an already-matched tile is a no-op", () => {
  const [a] = makeItems(1);
  const t = tilesFor(a);
  const matched = selectTile(selectTile(initialMatchingState(), t.hanzi).state, t.english).state;
  const out = selectTile(matched, t.hanzi);
  assert.equal(out.result, "reselected");
  assert.equal(out.state, matched); // same reference — nothing changed
});

test("selectTile never mutates its input state", () => {
  const [a, b] = makeItems(2);
  const ta = tilesFor(a);
  const tb = tilesFor(b);
  const start = initialMatchingState();
  const frozen = JSON.stringify(start);
  const afterSelect = selectTile(start, ta.hanzi);
  assert.equal(JSON.stringify(start), frozen);

  const beforeMismatch = afterSelect.state;
  const snapshot = JSON.stringify(beforeMismatch);
  selectTile(beforeMismatch, tb.english);
  assert.equal(JSON.stringify(beforeMismatch), snapshot);
});
