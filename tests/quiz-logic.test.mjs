import test from "node:test";
import assert from "node:assert/strict";

import {
  buildQuiz,
  buildQuizCard,
  itemsForKeys,
} from "../src/lib/quiz-logic.ts";

// A tiny fixture of vocab items (only the fields the quiz logic reads).
const ITEMS = [
  { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [] },
  { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [] },
  { hanzi: "鱼", pinyin: "yú", english: "fish", sentences: [] },
  { hanzi: "鸟", pinyin: "niǎo", english: "bird", sentences: [] },
  { hanzi: "马", pinyin: "mǎ", english: "horse", sentences: [] },
];

// Deterministic "shuffle" that preserves order, so choice contents are testable.
const identity = (items) => [...items];
const keyFor = (item) => `pets:${item.hanzi}`;

test("buildQuizCard: hanzi-english derives prompt, pinyin, answer, and key", () => {
  const card = buildQuizCard(ITEMS[0], ITEMS, "hanzi-english", keyFor, identity);
  assert.equal(card.prompt, "狗");
  assert.equal(card.promptPinyin, "gǒu");
  assert.equal(card.answer, "dog");
  assert.equal(card.key, "pets:狗");
  assert.ok(card.choices.includes("dog"));
});

test("buildQuizCard: english-hanzi and hanzi-pinyin use the right fields", () => {
  const eh = buildQuizCard(ITEMS[0], ITEMS, "english-hanzi", keyFor, identity);
  assert.equal(eh.prompt, "dog");
  assert.equal(eh.answer, "狗");
  assert.equal(eh.promptPinyin, undefined);
  assert.ok(eh.choices.includes("狗"));

  const hp = buildQuizCard(ITEMS[0], ITEMS, "hanzi-pinyin", keyFor, identity);
  assert.equal(hp.prompt, "狗");
  assert.equal(hp.answer, "gǒu");
  assert.equal(hp.promptPinyin, undefined);
  assert.ok(hp.choices.includes("gǒu"));
});

test("buildQuizCard: gives four unique choices including the answer, no duplicate of answer", () => {
  const card = buildQuizCard(ITEMS[0], ITEMS, "hanzi-english", keyFor, identity);
  assert.equal(card.choices.length, 4);
  assert.equal(new Set(card.choices).size, 4);
  // Distractors are drawn from the pool and never equal the answer.
  assert.equal(card.choices.filter((c) => c === "dog").length, 1);
});

test("buildQuizCard: a tiny pool yields fewer choices but still includes the answer", () => {
  // Pool of two: only one distractor is available.
  const card = buildQuizCard(ITEMS[0], ITEMS.slice(0, 2), "hanzi-english", keyFor, identity);
  assert.deepEqual(card.choices, ["dog", "cat"]);
});

test("buildQuiz: builds one card per active item, drawing distractors from the full pool", () => {
  // Retry-missed scenario: a single active item, distractors from the whole topic.
  const missed = [ITEMS[0]];
  const quiz = buildQuiz(missed, ITEMS, "hanzi-english", keyFor, identity);
  assert.equal(quiz.length, 1);
  assert.equal(quiz[0].answer, "dog");
  assert.equal(quiz[0].choices.length, 4); // pool still supplies 3 distractors
});

test("itemsForKeys: returns the matching subset in topic order", () => {
  const keys = [`pets:鱼`, `pets:狗`]; // out of order on purpose
  const subset = itemsForKeys(ITEMS, keyFor, keys);
  assert.deepEqual(
    subset.map((i) => i.hanzi),
    ["狗", "鱼"], // preserves ITEMS order, not the key order
  );
});

test("itemsForKeys: empty keys (perfect quiz) yields no items", () => {
  assert.deepEqual(itemsForKeys(ITEMS, keyFor, []), []);
});

test("itemsForKeys: a single missed key yields exactly that item", () => {
  const subset = itemsForKeys(ITEMS, keyFor, [`pets:马`]);
  assert.equal(subset.length, 1);
  assert.equal(subset[0].english, "horse");
});

test("itemsForKeys: unknown keys are ignored", () => {
  assert.deepEqual(itemsForKeys(ITEMS, keyFor, ["pets:🐉"]), []);
});
