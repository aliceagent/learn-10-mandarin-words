import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMemoryRounds,
  clearMismatch,
  flipCard,
  initialMemoryState,
  isRoundComplete,
} from "../src/lib/memory-logic.ts";

// Identity shuffle so card order is deterministic and assertions are exact.
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

// ── buildMemoryRounds ─────────────────────────────────────────────────────────

test("buildMemoryRounds splits 10 items into two rounds of five pairs / ten cards", () => {
  const rounds = buildMemoryRounds(makeItems(10), keyFor, identity);
  assert.equal(rounds.length, 2);
  for (const round of rounds) {
    assert.equal(round.pairs.length, 5);
    assert.equal(round.cards.length, 10);
    const hanzi = round.cards.filter((c) => c.side === "hanzi");
    const english = round.cards.filter((c) => c.side === "english");
    assert.equal(hanzi.length, 5);
    assert.equal(english.length, 5);
    // Every pair is represented once per side.
    for (const p of round.pairs) {
      assert.equal(hanzi.filter((c) => c.key === p.key).length, 1);
      assert.equal(english.filter((c) => c.key === p.key).length, 1);
    }
    // Hanzi cards carry pinyin; English cards don't.
    for (const c of hanzi) assert.ok(typeof c.pinyin === "string" && c.pinyin.length > 0);
    for (const c of english) assert.equal(c.pinyin, undefined);
    // ids are `side:key` and unique across the round.
    const ids = round.cards.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const c of round.cards) assert.equal(c.id, `${c.side}:${c.key}`);
  }
  // With identity shuffle the first round holds the first five items.
  assert.deepEqual(
    rounds[0].pairs.map((p) => p.hanzi),
    ["汉0", "汉1", "汉2", "汉3", "汉4"],
  );
});

test("buildMemoryRounds tolerates non-10 topics (rounds of 5 and 2)", () => {
  const rounds = buildMemoryRounds(makeItems(7), keyFor, identity);
  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].pairs.length, 5);
  assert.equal(rounds[0].cards.length, 10);
  assert.equal(rounds[1].pairs.length, 2);
  assert.equal(rounds[1].cards.length, 4);
});

test("buildMemoryRounds is deterministic under an identity shuffle", () => {
  const a = buildMemoryRounds(makeItems(10), keyFor, identity);
  const b = buildMemoryRounds(makeItems(10), keyFor, identity);
  assert.deepEqual(a, b);
});

// ── flipCard reducer ──────────────────────────────────────────────────────────

function cardsFor(item) {
  const key = keyFor(item);
  return {
    hanzi: { id: `hanzi:${key}`, key, side: "hanzi", label: item.hanzi, pinyin: item.pinyin },
    english: { id: `english:${key}`, key, side: "english", label: item.english },
  };
}

test("flipCard on an empty state reveals the card without spending a turn", () => {
  const [a] = makeItems(1);
  const t = cardsFor(a);
  const out = flipCard(initialMemoryState(), t.hanzi);
  assert.equal(out.result, "reveal");
  assert.deepEqual(out.state.faceUp, [t.hanzi]);
  assert.equal(out.state.turns, 0);
  assert.deepEqual(out.state.matchedKeys, []);
});

test("flipCard second card, same key other side → match, turn spent", () => {
  const [a] = makeItems(1);
  const t = cardsFor(a);
  const first = flipCard(initialMemoryState(), t.hanzi);
  const second = flipCard(first.state, t.english);
  assert.equal(second.result, "match");
  assert.deepEqual(second.state.matchedKeys, [keyFor(a)]);
  assert.deepEqual(second.state.faceUp, []);
  assert.equal(second.state.turns, 1);
});

test("flipCard second card, different key → mismatch keeps BOTH face up; clearMismatch empties them", () => {
  const [a, b] = makeItems(2);
  const ta = cardsFor(a);
  const tb = cardsFor(b);
  const first = flipCard(initialMemoryState(), ta.hanzi);
  const second = flipCard(first.state, tb.english);
  assert.equal(second.result, "mismatch");
  assert.deepEqual(second.state.faceUp, [ta.hanzi, tb.english]);
  assert.equal(second.state.turns, 1);
  assert.deepEqual(second.state.matchedKeys, []);

  const cleared = clearMismatch(second.state);
  assert.deepEqual(cleared.faceUp, []);
  assert.equal(cleared.turns, 1); // counts untouched
  assert.deepEqual(cleared.matchedKeys, []);
});

test("flipCard ignores re-flipping a face-up card, a matched card, or any flip while two are up", () => {
  const [a, b] = makeItems(2);
  const ta = cardsFor(a);
  const tb = cardsFor(b);

  // Re-flipping the already-face-up card.
  const revealed = flipCard(initialMemoryState(), ta.hanzi);
  const reflip = flipCard(revealed.state, ta.hanzi);
  assert.equal(reflip.result, "ignored");
  assert.equal(reflip.state, revealed.state); // same reference

  // Flipping a matched card.
  const matched = flipCard(revealed.state, ta.english).state;
  const tapMatched = flipCard(matched, ta.hanzi);
  assert.equal(tapMatched.result, "ignored");
  assert.equal(tapMatched.state, matched);

  // Any flip while two cards are face up (a mismatch is showing).
  const mismatch = flipCard(flipCard(initialMemoryState(), ta.hanzi).state, tb.english).state;
  const third = flipCard(mismatch, cardsFor(a).english);
  assert.equal(third.result, "ignored");
  assert.equal(third.state, mismatch);
});

test("flipCard never mutates its input state", () => {
  const [a, b] = makeItems(2);
  const ta = cardsFor(a);
  const tb = cardsFor(b);
  const start = initialMemoryState();
  const frozen = JSON.stringify(start);
  const afterReveal = flipCard(start, ta.hanzi);
  assert.equal(JSON.stringify(start), frozen);

  const beforeMismatch = afterReveal.state;
  const snapshot = JSON.stringify(beforeMismatch);
  flipCard(beforeMismatch, tb.english);
  assert.equal(JSON.stringify(beforeMismatch), snapshot);
});

test("flipCard full-round walkthrough: five in-order matches complete the round in five turns", () => {
  const items = makeItems(5);
  const [round] = buildMemoryRounds(items, keyFor, identity);
  let state = initialMemoryState();
  for (const item of items) {
    const t = cardsFor(item);
    state = flipCard(state, t.hanzi).state;
    state = flipCard(state, t.english).state;
  }
  assert.equal(state.turns, 5);
  assert.equal(state.matchedKeys.length, 5);
  assert.equal(isRoundComplete(state, round), true);
});
