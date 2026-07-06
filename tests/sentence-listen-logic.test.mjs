import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import { SPEECH_RATE } from "../src/lib/speech.ts";
import {
  SLOW_SPEECH_RATE,
  buildSentenceListenCard,
  buildSentenceListenDeck,
  sentencePool,
} from "../src/lib/sentence-listen-logic.ts";

// A tiny fixture: four words each with two example sentences.
const DOG = {
  hanzi: "狗",
  pinyin: "gǒu",
  english: "dog",
  sentences: [
    { cn: "我有一只狗。", en: "I have a dog." },
    { cn: "那只狗很可爱。", en: "That dog is cute." },
  ],
};
const CAT = {
  hanzi: "猫",
  pinyin: "māo",
  english: "cat",
  sentences: [
    { cn: "我有一只猫。", en: "I have a cat." },
    { cn: "猫在睡觉。", en: "The cat is sleeping." },
  ],
};
const FISH = {
  hanzi: "鱼",
  pinyin: "yú",
  english: "fish",
  sentences: [
    { cn: "我喜欢吃鱼。", en: "I like eating fish." },
    { cn: "鱼在水里。", en: "The fish is in the water." },
  ],
};
const BIRD = {
  hanzi: "鸟",
  pinyin: "niǎo",
  english: "bird",
  sentences: [
    { cn: "天上有一只鸟。", en: "There is a bird in the sky." },
    { cn: "鸟会飞。", en: "Birds can fly." },
  ],
};
const ITEMS = [DOG, CAT, FISH, BIRD];

// Deterministic "shuffle" that preserves order, so card contents are testable.
const identity = (items) => [...items];
const keyFor = (item) => `pets:${item.hanzi}`;

test("SLOW_SPEECH_RATE is slower than the normal rate", () => {
  assert.ok(SLOW_SPEECH_RATE < SPEECH_RATE, "slow replay must be below the normal rate");
});

test("sentencePool flattens all pool sentences except the played one", () => {
  const pool = sentencePool(ITEMS, "我有一只狗。");
  // 4 items × 2 sentences = 8, minus the excluded one = 7.
  assert.equal(pool.length, 7);
  assert.ok(!pool.some((s) => s.cn === "我有一只狗。"), "played sentence is excluded");
});

test("buildSentenceListenCard: card contract under an identity shuffle", () => {
  const card = buildSentenceListenCard(DOG, ITEMS, keyFor, identity);
  assert.ok(card);
  // The first sentence is picked under identity shuffle.
  assert.equal(card.sentenceCn, "我有一只狗。");
  assert.equal(card.answer, "I have a dog.");
  // Word fields copied from the drilled item (revealed after answering).
  assert.equal(card.hanzi, "狗");
  assert.equal(card.pinyin, "gǒu");
  assert.equal(card.english, "dog");
  assert.equal(card.key, "pets:狗");
  // Four unique English choices including the answer.
  assert.equal(card.choices.length, 4);
  assert.equal(new Set(card.choices).size, 4);
  assert.ok(card.choices.includes("I have a dog."));
  assert.equal(card.choices.filter((c) => c === "I have a dog.").length, 1);
});

test("buildSentenceListenCard: distractors are real translations, never the answer", () => {
  const card = buildSentenceListenCard(DOG, ITEMS, keyFor, identity);
  assert.ok(card);
  const distractors = card.choices.filter((c) => c !== card.answer);
  assert.equal(distractors.length, 3);
  // Every distractor is some other sentence's English from the pool.
  const poolEn = new Set(sentencePool(ITEMS, card.sentenceCn).map((s) => s.en));
  for (const d of distractors) {
    assert.notEqual(d, card.answer, "distractor never equals the answer");
    assert.ok(poolEn.has(d), `distractor ${d} is a real pool translation`);
  }
});

test("buildSentenceListenCard returns null when the item has no sentences", () => {
  const orphan = { hanzi: "龙", pinyin: "lóng", english: "dragon", sentences: [] };
  assert.equal(buildSentenceListenCard(orphan, ITEMS, keyFor, identity), null);
});

test("buildSentenceListenDeck drops items with no sentences and keeps order", () => {
  const orphan = { hanzi: "龙", pinyin: "lóng", english: "dragon", sentences: [] };
  const deck = buildSentenceListenDeck([DOG, orphan, CAT], ITEMS, keyFor, identity);
  assert.equal(deck.length, 2);
  assert.deepEqual(deck.map((c) => c.hanzi), ["狗", "猫"]);
});

test("buildSentenceListenDeck: length equals items-with-sentences count", () => {
  const deck = buildSentenceListenDeck(ITEMS, ITEMS, keyFor, identity);
  assert.equal(deck.length, ITEMS.length);
});

test("dataset-wide: every topic builds exactly 10 valid listening cards", () => {
  for (const topic of rawData.topics) {
    const deck = buildSentenceListenDeck(
      topic.items,
      topic.items,
      (item) => `${topic.slug}:${item.hanzi}`,
      identity,
    );
    assert.equal(deck.length, 10, `${topic.slug} yields 10 cards`);
    for (const card of deck) {
      assert.equal(card.choices.length, 4, `${topic.slug}:${card.hanzi} has 4 choices`);
      assert.equal(
        new Set(card.choices).size,
        4,
        `${topic.slug}:${card.hanzi} choices are unique`,
      );
      assert.ok(card.choices.includes(card.answer), `${topic.slug}:${card.hanzi} includes answer`);
      assert.ok(card.sentenceCn.length > 0, `${topic.slug}:${card.hanzi} has a spoken sentence`);
    }
  }
});
