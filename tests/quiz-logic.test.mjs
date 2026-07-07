import test from "node:test";
import assert from "node:assert/strict";

import {
  buildQuiz,
  buildQuizCard,
  itemsForKeys,
  rankedDistractors,
} from "../src/lib/quiz-logic.ts";
import { glossesCollide } from "../src/lib/gloss.ts";

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

// ─── Ranked distractors ────────────────────────────────────────────────────────

// hanzi-pinyin ranking fixture: `near` shares the tone-stripped pinyin "ma"
// with the target, `mid` matches only syllable count + tone, and `far` is a
// two-syllable word that matches on nothing.
const target = { hanzi: "妈", pinyin: "mā", english: "mom", sentences: [] };
const near = { hanzi: "马", pinyin: "mǎ", english: "horse", sentences: [] };
const mid = { hanzi: "八", pinyin: "bā", english: "eight", sentences: [] };
const far = { hanzi: "朋友", pinyin: "péngyou", english: "friend", sentences: [] };

test("rankedDistractors: hanzi-pinyin prefers tone-stripped similarity, then syllable/tone match", () => {
  // Pool is deliberately out of similarity order to prove the ranking reorders it.
  const ranked = rankedDistractors(target, [far, mid, near], "hanzi-pinyin", identity);
  assert.deepEqual(ranked, ["mǎ", "bā", "péngyou"]);
});

test("rankedDistractors: english-hanzi prefers same length and shared characters", () => {
  const tHan = { hanzi: "好人", pinyin: "hǎo rén", english: "good person", sentences: [] };
  const shareLen = { hanzi: "坏人", pinyin: "huài rén", english: "bad person", sentences: [] }; // shares 人, len 2
  const shareChar = { hanzi: "好", pinyin: "hǎo", english: "good", sentences: [] }; // shares 好 but len 1
  const unrelated = { hanzi: "水", pinyin: "shuǐ", english: "water", sentences: [] }; // nothing shared, len 1
  const ranked = rankedDistractors(tHan, [unrelated, shareChar, shareLen], "english-hanzi", identity);
  // "坏人" shares a character AND the length, so it outranks the others.
  assert.equal(ranked[0], "坏人");
  assert.equal(ranked[ranked.length - 1], "水");
});

test("rankedDistractors: dedupes by answer-field value and never returns the answer", () => {
  const dupPool = [
    { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [] },
    { hanzi: "貓", pinyin: "māo", english: "cat", sentences: [] }, // duplicate English label
    { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [] },
  ];
  const dog = dupPool[2];
  const ranked = rankedDistractors(dog, dupPool, "hanzi-english", identity);
  // "cat" appears once (dedup) and "dog" (the answer) never appears.
  assert.deepEqual(ranked, ["cat"]);
});

test("rankedDistractors: a tiny pool yields fewer distractors", () => {
  const ranked = rankedDistractors(ITEMS[0], ITEMS.slice(0, 2), "hanzi-english", identity);
  assert.deepEqual(ranked, ["cat"]); // only one other word in the pool
});

test("buildQuizCard: duplicate English labels can never appear twice in the choices", () => {
  const dupPool = [
    { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [] },
    { hanzi: "犬", pinyin: "quǎn", english: "dog", sentences: [] }, // same English, different hanzi
    { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [] },
    { hanzi: "鱼", pinyin: "yú", english: "fish", sentences: [] },
  ];
  const card = buildQuizCard(dupPool[2], dupPool, "hanzi-english", keyFor, identity);
  assert.equal(new Set(card.choices).size, card.choices.length); // all unique
  assert.equal(card.choices.filter((c) => c === "dog").length, 1); // dog appears at most once
});

test("buildQuizCard: choices are always unique across every mode", () => {
  for (const mode of ["hanzi-english", "english-hanzi", "hanzi-pinyin"]) {
    for (const item of ITEMS) {
      const card = buildQuizCard(item, ITEMS, mode, keyFor, identity);
      assert.equal(new Set(card.choices).size, card.choices.length, `unique choices for ${mode}`);
      assert.ok(card.choices.includes(card.answer), `answer present for ${mode}`);
    }
  }
});

// ─── Gloss-collision fairness (Sprint 29) ───────────────────────────────────

// Fixture modeled on the real live collisions: 包子 "steamed bun" vs 馒头
// "steamed bun (plain)" share a normalized gloss, and 对不起 "sorry" vs 不好意思
// "excuse me / sorry" share a slash segment. `dumpling` is a clean, unrelated
// word that should always survive as a distractor.
const COLLIDING = [
  { hanzi: "包子", pinyin: "bāozi", english: "steamed bun", sentences: [] },
  { hanzi: "馒头", pinyin: "mántou", english: "steamed bun (plain)", sentences: [] },
  { hanzi: "对不起", pinyin: "duìbuqǐ", english: "sorry", sentences: [] },
  { hanzi: "不好意思", pinyin: "bùhǎoyìsi", english: "excuse me / sorry", sentences: [] },
  { hanzi: "饺子", pinyin: "jiǎozi", english: "dumpling", sentences: [] },
];

// Map an answer-field value back to the pool item(s) that own it, so we can
// check whether a chosen distractor collides with the quizzed item's gloss.
function ownersOf(pool, field, value) {
  return pool.filter((w) => w[field] === value);
}

test("rankedDistractors: a gloss-colliding candidate is never offered, in any mode", () => {
  for (const mode of ["hanzi-english", "english-hanzi", "hanzi-pinyin", "listening"]) {
    const field = {
      "hanzi-english": "english",
      "english-hanzi": "hanzi",
      "hanzi-pinyin": "pinyin",
      listening: "english",
    }[mode];
    for (const item of COLLIDING) {
      const ranked = rankedDistractors(item, COLLIDING, mode, identity);
      for (const value of ranked) {
        for (const owner of ownersOf(COLLIDING, field, value)) {
          assert.equal(
            glossesCollide(owner.english, item.english),
            false,
            `${mode}: distractor "${value}" collides with answer "${item.english}"`,
          );
        }
      }
    }
  }
});

test("buildQuizCard: the steamed-bun twin never co-appears as a choice", () => {
  // hanzi→English on 包子: "steamed bun (plain)" must not be offered.
  const eng = buildQuizCard(COLLIDING[0], COLLIDING, "hanzi-english", keyFor, identity);
  assert.equal(eng.choices.includes("steamed bun (plain)"), false);
  // English→hanzi on 包子: 馒头's hanzi must not be offered.
  const han = buildQuizCard(COLLIDING[0], COLLIDING, "english-hanzi", keyFor, identity);
  assert.equal(han.choices.includes("馒头"), false);
});

test("buildQuizCard: the apologize near-synonym never co-appears as a choice", () => {
  const card = buildQuizCard(COLLIDING[2], COLLIDING, "hanzi-english", keyFor, identity);
  // 对不起 "sorry" must never offer 不好意思 "excuse me / sorry" (shared sense).
  assert.equal(card.choices.includes("excuse me / sorry"), false);
});

test("buildQuizCard: a clean pool still yields four unique choices after filtering", () => {
  // ITEMS has no colliding glosses, so filtering changes nothing.
  for (const mode of ["hanzi-english", "english-hanzi", "hanzi-pinyin", "listening"]) {
    const card = buildQuizCard(ITEMS[0], ITEMS, mode, keyFor, identity);
    assert.equal(card.choices.length, 4, `four choices for ${mode}`);
    assert.equal(new Set(card.choices).size, 4, `unique choices for ${mode}`);
    assert.ok(card.choices.includes(card.answer), `answer present for ${mode}`);
  }
});

// ─── Listening mode ─────────────────────────────────────────────────────────

test("buildQuizCard: listening carries hanzi + pinyin but quizzes the English meaning", () => {
  const card = buildQuizCard(ITEMS[0], ITEMS, "listening", keyFor, identity);
  // The prompt is the hanzi (spoken aloud) with its pinyin carried for reveal,
  // while the answer/choices are English — the learner hears, then picks meaning.
  assert.equal(card.prompt, "狗");
  assert.equal(card.promptPinyin, "gǒu");
  assert.equal(card.answer, "dog");
  assert.equal(card.key, "pets:狗");
  assert.equal(card.choices.length, 4);
  assert.equal(new Set(card.choices).size, 4);
  assert.ok(card.choices.includes("dog"));
});

test("rankedDistractors: listening never returns the answer and dedupes identical English", () => {
  const dupPool = [
    { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [] },
    { hanzi: "貓", pinyin: "māo", english: "cat", sentences: [] }, // duplicate English label
    { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [] },
  ];
  const dog = dupPool[2];
  const ranked = rankedDistractors(dog, dupPool, "listening", identity);
  // "cat" appears once (dedup) and "dog" (the answer) never appears — same shape
  // as the hanzi-english ranking, since listening shares the English-answer scoring.
  assert.deepEqual(ranked, ["cat"]);
});

test("rankedDistractors: listening ranks the same as hanzi-english (shared English scoring)", () => {
  const listen = rankedDistractors(ITEMS[0], ITEMS, "listening", identity);
  const read = rankedDistractors(ITEMS[0], ITEMS, "hanzi-english", identity);
  assert.deepEqual(listen, read);
});

test("buildQuizCard: every mode's answer matches its expected VocabItem field", () => {
  const expected = {
    "hanzi-english": "english",
    "english-hanzi": "hanzi",
    "hanzi-pinyin": "pinyin",
    listening: "english",
  };
  for (const [mode, field] of Object.entries(expected)) {
    const card = buildQuizCard(ITEMS[0], ITEMS, mode, keyFor, identity);
    assert.equal(card.answer, ITEMS[0][field], `answer field for ${mode}`);
  }
});

test("buildQuizCard: with an injected identity shuffle the answer stays first (determinism preserved)", () => {
  const card = buildQuizCard(target, [target, near, mid, far], "hanzi-pinyin", keyFor, identity);
  // identity shuffle => choices === [answer, ...rankedDistractors]
  assert.equal(card.choices[0], "mā");
  assert.deepEqual(card.choices.slice(1), ["mǎ", "bā", "péngyou"]);
});
