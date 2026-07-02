import test from "node:test";
import assert from "node:assert/strict";

import { resolveWeakItems, buildPracticeQuiz } from "../src/lib/practice-logic.ts";

// Minimal Topic/VocabItem fixtures for the dataset-shaped helpers. Only the
// fields the helpers read need to be present; wordKey is `slug:hanzi`, and each
// item's english/pinyin are derived from its hanzi so they stay distinct.
function makeTopic(slug, hanziList, titleEn = slug) {
  return {
    slug,
    titleEn,
    items: hanziList.map((hanzi) => ({
      hanzi,
      pinyin: `${hanzi}-pinyin`,
      english: `${hanzi}-english`,
      sentences: [],
    })),
  };
}

const alpha = makeTopic("alpha", ["好", "坏", "空", "半"], "Alpha topic");
const beta = makeTopic("beta", ["日", "月", "水", "火", "木"], "Beta topic");
const TOPICS = [alpha, beta];

// Crafted quiz history. Accuracy (ascending) drives the weak ranking; ties break
// toward more attempts. "ghost:x" is an unresolvable key (no such word) that must
// be dropped. "beta:月" sits below the default minAttempts (3) and is excluded.
const QUIZ_STATS = {
  "alpha:好": { correct: 1, attempts: 4 }, // 0.25
  "alpha:坏": { correct: 2, attempts: 4 }, // 0.50
  "beta:日": { correct: 0, attempts: 3 }, // 0.00 (weakest resolvable)
  "beta:月": { correct: 0, attempts: 2 }, // below minAttempts → excluded
  "ghost:x": { correct: 0, attempts: 5 }, // unresolvable → dropped
};

// Deterministic "shuffle" that preserves order, so card contents are testable.
const identity = (items) => [...items];

test("resolveWeakItems: preserves weak order and drops unresolvable keys", () => {
  const entries = resolveWeakItems(TOPICS, QUIZ_STATS);
  // ghost:x (accuracy 0) outranks beta:日 by attempts but is unresolvable, so it
  // is dropped; the remaining weak order (weakest first) is preserved.
  assert.deepEqual(
    entries.map((e) => e.key),
    ["beta:日", "alpha:好", "alpha:坏"],
  );
});

test("resolveWeakItems: carries the owning topic's full item list as poolItems", () => {
  const entries = resolveWeakItems(TOPICS, QUIZ_STATS);
  const first = entries[0];
  assert.equal(first.key, "beta:日");
  assert.equal(first.topicSlug, "beta");
  assert.equal(first.topicTitle, "Beta topic");
  assert.equal(first.item.english, "日-english");
  // poolItems is the whole beta topic (5 words), for same-topic distractors.
  assert.equal(first.poolItems, beta.items);
  assert.equal(first.poolItems.length, 5);
});

test("resolveWeakItems: carries accuracy and attempts from computeWeakWords", () => {
  const entries = resolveWeakItems(TOPICS, QUIZ_STATS);
  const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
  assert.equal(byKey["beta:日"].accuracy, 0);
  assert.equal(byKey["beta:日"].attempts, 3);
  assert.equal(byKey["alpha:好"].accuracy, 0.25);
  assert.equal(byKey["alpha:好"].attempts, 4);
});

test("resolveWeakItems: minAttempts is respected", () => {
  // With minAttempts 4, beta:日 (3 attempts) drops out; only the 4-attempt words
  // remain (ghost:x has 5 but is unresolvable).
  const entries = resolveWeakItems(TOPICS, QUIZ_STATS, { minAttempts: 4 });
  assert.deepEqual(
    entries.map((e) => e.key),
    ["alpha:好", "alpha:坏"],
  );
});

test("resolveWeakItems: empty/undefined stats yield an empty deck", () => {
  assert.deepEqual(resolveWeakItems(TOPICS, {}), []);
  assert.deepEqual(resolveWeakItems(TOPICS, undefined), []);
});

test("buildPracticeQuiz: one card per entry, keyed and answered from the entry", () => {
  const entries = resolveWeakItems(TOPICS, QUIZ_STATS);
  const deck = buildPracticeQuiz(entries, "hanzi-english", identity);
  assert.equal(deck.length, entries.length);
  deck.forEach((card, i) => {
    assert.equal(card.key, entries[i].key, "card key matches entry key");
    assert.equal(card.answer, entries[i].item.english, "answer is the entry's English");
    assert.equal(card.prompt, entries[i].item.hanzi, "prompt is the entry's hanzi");
  });
});

test("buildPracticeQuiz: 4 unique choices drawn only from the entry's own topic", () => {
  const entries = resolveWeakItems(TOPICS, QUIZ_STATS);
  const deck = buildPracticeQuiz(entries, "hanzi-english", identity);
  deck.forEach((card, i) => {
    // Every entry's topic has 4+ distinct English glosses, so choices fill to 4.
    assert.equal(card.choices.length, 4);
    assert.equal(new Set(card.choices).size, 4);
    assert.ok(card.choices.includes(card.answer));
    // Distractors are same-topic: each choice is an English value from the
    // entry's own poolItems.
    const poolEnglish = new Set(entries[i].poolItems.map((it) => it.english));
    for (const choice of card.choices) {
      assert.ok(poolEnglish.has(choice), `choice ${choice} is from the entry's topic`);
    }
  });
});

test("buildPracticeQuiz: an empty entry list yields an empty deck", () => {
  assert.deepEqual(buildPracticeQuiz([], "hanzi-english", identity), []);
});
