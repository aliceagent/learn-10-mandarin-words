import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  CLOZE_BLANK,
  blankSentence,
  buildClozeCard,
  buildClozeDeck,
  clozeSentences,
} from "../src/lib/cloze-logic.ts";

// A tiny fixture: two words each with two example sentences containing the word.
const DOG = {
  hanzi: "狗",
  pinyin: "gǒu",
  english: "dog",
  sentences: [
    { cn: "我有一只狗。", en: "I have a dog." },
    { cn: "那只狗很可爱，狗很小。", en: "That dog is cute." },
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

test("blankSentence replaces only the first occurrence of the hanzi", () => {
  assert.equal(blankSentence("我有一只狗。", "狗"), `我有一只${CLOZE_BLANK}。`);
  // A sentence with the word twice keeps the later occurrence as-is.
  assert.equal(
    blankSentence("那只狗很可爱，狗很小。", "狗"),
    `那只${CLOZE_BLANK}很可爱，狗很小。`,
  );
});

test("blankSentence returns null when the sentence lacks the hanzi", () => {
  assert.equal(blankSentence("我有一只猫。", "狗"), null);
});

test("blankSentence handles multi-character hanzi", () => {
  assert.equal(
    blankSentence("谢谢你的帮助。", "谢谢"),
    `${CLOZE_BLANK}你的帮助。`,
  );
});

test("clozeSentences keeps only sentences that contain the hanzi", () => {
  const mixed = {
    hanzi: "狗",
    pinyin: "gǒu",
    english: "dog",
    sentences: [
      { cn: "我有一只狗。", en: "I have a dog." },
      { cn: "我有一只猫。", en: "I have a cat." }, // no 狗
    ],
  };
  const eligible = clozeSentences(mixed);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].cn, "我有一只狗。");
});

test("buildClozeCard: card contract with an identity shuffle", () => {
  const card = buildClozeCard(DOG, ITEMS, keyFor, identity);
  assert.ok(card);
  // The first eligible sentence is picked under identity shuffle.
  assert.equal(card.sentenceCn, "我有一只狗。");
  assert.equal(card.sentenceEn, "I have a dog.");
  assert.ok(card.prompt.includes(CLOZE_BLANK), "prompt contains the blank");
  assert.notEqual(card.prompt, card.sentenceCn, "blanked prompt differs from the sentence");
  assert.equal(card.hanzi, "狗");
  assert.equal(card.pinyin, "gǒu");
  assert.equal(card.english, "dog");
  assert.equal(card.key, "pets:狗");
  // Four unique hanzi choices including the answer.
  assert.equal(card.choices.length, 4);
  assert.equal(new Set(card.choices).size, 4);
  assert.ok(card.choices.includes("狗"));
  assert.equal(card.choices.filter((c) => c === "狗").length, 1);
});

test("buildClozeCard: a tiny pool yields fewer choices but still includes the answer", () => {
  const card = buildClozeCard(DOG, ITEMS.slice(0, 2), keyFor, identity);
  assert.ok(card);
  assert.deepEqual(card.choices, ["狗", "猫"]);
});

test("buildClozeCard returns null when no sentence contains the hanzi", () => {
  const orphan = {
    hanzi: "龙",
    pinyin: "lóng",
    english: "dragon",
    sentences: [{ cn: "我有一只猫。", en: "I have a cat." }],
  };
  assert.equal(buildClozeCard(orphan, ITEMS, keyFor, identity), null);
});

test("buildClozeDeck drops items with no eligible sentence", () => {
  const orphan = {
    hanzi: "龙",
    pinyin: "lóng",
    english: "dragon",
    sentences: [{ cn: "我有一只猫。", en: "I have a cat." }],
  };
  const deck = buildClozeDeck([DOG, orphan, CAT], ITEMS, keyFor, identity);
  assert.equal(deck.length, 2);
  assert.deepEqual(deck.map((c) => c.hanzi), ["狗", "猫"]);
});

test("dataset spot-check: the first 20 real items build valid cloze cards", () => {
  const items = rawData.topics.flatMap((t) =>
    t.items.map((item) => ({ item, topic: t })),
  ).slice(0, 20);
  for (const { item, topic } of items) {
    const card = buildClozeCard(item, topic.items, (i) => `${topic.slug}:${i.hanzi}`, identity);
    assert.ok(card, `card built for ${item.hanzi}`);
    assert.ok(card.prompt.includes(CLOZE_BLANK), `prompt for ${item.hanzi} contains the blank`);
    assert.ok(card.choices.includes(item.hanzi), `choices for ${item.hanzi} include the answer`);
    assert.notEqual(card.prompt, card.sentenceCn, `prompt for ${item.hanzi} differs from the sentence`);
  }
});
