import test from "node:test";
import assert from "node:assert/strict";

import { tonesOf } from "../src/lib/pinyin.ts";
import { BOSS_STAGE_COUNT, buildBossRound } from "../src/lib/boss-logic.ts";

// A tiny fixture: five words, each with an example sentence that CONTAINS its own
// hanzi (so every word is cloze-eligible) and tone-marked pinyin (tone-eligible).
const ITEMS = [
  { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [{ cn: "我有一只狗。", en: "I have a dog." }] },
  { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [{ cn: "我有一只猫。", en: "I have a cat." }] },
  { hanzi: "鱼", pinyin: "yú", english: "fish", sentences: [{ cn: "鱼在水里。", en: "The fish is in the water." }] },
  { hanzi: "鸟", pinyin: "niǎo", english: "bird", sentences: [{ cn: "鸟会飞。", en: "Birds can fly." }] },
  { hanzi: "马", pinyin: "mǎ", english: "horse", sentences: [{ cn: "马很快。", en: "The horse is fast." }] },
];

// Identity shuffle so the word assignment is deterministic and testable.
const identity = (items) => [...items];
const keyFor = (item) => `pets:${item.hanzi}`;

test("buildBossRound: four stages, one per kind, in fixed quiz→cloze→tone→typing order", () => {
  const { stages } = buildBossRound(ITEMS, ITEMS, keyFor, identity);
  assert.equal(stages.length, BOSS_STAGE_COUNT);
  assert.deepEqual(
    stages.map((s) => s.kind),
    ["quiz", "cloze", "tone", "typing"],
  );
});

test("buildBossRound: every stage lands on a DISTINCT word", () => {
  const { stages } = buildBossRound(ITEMS, ITEMS, keyFor, identity);
  const keys = stages.map((s) => s.key);
  assert.equal(new Set(keys).size, BOSS_STAGE_COUNT);
});

test("buildBossRound: cloze stage carries a real card, tone stage matches tonesOf", () => {
  const { stages } = buildBossRound(ITEMS, ITEMS, keyFor, identity);
  const cloze = stages.find((s) => s.kind === "cloze");
  assert.ok(cloze.card, "cloze stage has a non-null card");
  assert.ok(cloze.card.prompt.includes("＿＿"), "cloze prompt has a blank");
  assert.ok(cloze.card.choices.includes(cloze.card.hanzi), "answer is among the choices");

  const tone = stages.find((s) => s.kind === "tone");
  assert.deepEqual(tone.tones, tonesOf(tone.item.pinyin));
  assert.equal(tone.syllables.length, tone.tones.length);
  assert.ok(tone.tones.length > 0);
});

test("buildBossRound: quiz stage distractors come from the pool and never dup the answer", () => {
  const { stages } = buildBossRound(ITEMS, ITEMS, keyFor, identity);
  const quiz = stages.find((s) => s.kind === "quiz");
  const englishes = new Set(ITEMS.map((i) => i.english));
  assert.ok(quiz.card.choices.includes(quiz.card.answer));
  // No duplicate choices; every choice is a real pool english.
  assert.equal(new Set(quiz.card.choices).size, quiz.card.choices.length);
  for (const choice of quiz.card.choices) assert.ok(englishes.has(choice));
});

test("buildBossRound: degrades to an extra quiz when no word is cloze-eligible", () => {
  // Sentences that never contain the word's own hanzi → no cloze-eligible word.
  const NO_CLOZE = ITEMS.map((item) => ({
    ...item,
    sentences: [{ cn: "这是一句话。", en: "This is a sentence." }],
  }));
  const { stages } = buildBossRound(NO_CLOZE, NO_CLOZE, keyFor, identity);
  // Still four distinct-word stages; the cloze slot became a substitute quiz.
  assert.equal(stages.length, BOSS_STAGE_COUNT);
  assert.equal(new Set(stages.map((s) => s.key)).size, BOSS_STAGE_COUNT);
  assert.ok(!stages.some((s) => s.kind === "cloze"), "no cloze stage when ineligible");
  assert.equal(stages.filter((s) => s.kind === "quiz").length, 2, "two quiz stages");
});

test("buildBossRound: dataset-wide, every topic yields four distinct-word stages", async () => {
  const { default: rawData } = await import("../src/data/topics.json", { with: { type: "json" } });
  for (const topic of rawData.topics) {
    const kf = (item) => `${topic.slug}:${item.hanzi}`;
    const { stages } = buildBossRound(topic.items, topic.items, kf, identity);
    assert.equal(stages.length, BOSS_STAGE_COUNT, `${topic.slug} has 4 stages`);
    assert.equal(
      new Set(stages.map((s) => s.key)).size,
      BOSS_STAGE_COUNT,
      `${topic.slug} stages are on distinct words`,
    );
    assert.deepEqual(
      stages.map((s) => s.kind),
      ["quiz", "cloze", "tone", "typing"],
      `${topic.slug} keeps the fixed stage order`,
    );
  }
});
