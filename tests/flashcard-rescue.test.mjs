import test from "node:test";
import assert from "node:assert/strict";

import { flashcardRescuePrompt } from "../src/lib/flashcard-rescue.ts";

const leechStat = {
  intervalDays: 2,
  ease: 1.5,
  dueAt: "2026-07-08T00:00:00.000Z",
  reviewCount: 7,
  lapses: 4,
};

const masteredStat = {
  ...leechStat,
  intervalDays: 7,
};

const slippingWord = {
  hanzi: "桌子",
  pinyin: "zhuōzi",
  english: "table",
  sentences: [
    { cn: "桌子上有一本书。", en: "There is a book on the table." },
    { cn: "这张桌子很大。", en: "This table is big." },
    { cn: "我擦桌子。", en: "I wipe the table." },
  ],
};

test("flashcard rescue prompt appears for a leech word with capped examples", () => {
  const prompt = flashcardRescuePrompt(slippingWord, leechStat);

  assert.equal(prompt?.word, "桌子");
  assert.equal(prompt?.lapses, 4);
  assert.equal(prompt?.title, "Rescue this slipping word");
  assert.deepEqual(prompt?.examples, slippingWord.sentences.slice(0, 2));
});

test("flashcard rescue prompt stays hidden for new, non-leech, mastered, or skipped words", () => {
  assert.equal(flashcardRescuePrompt(slippingWord, undefined), null);
  assert.equal(flashcardRescuePrompt(slippingWord, { ...leechStat, lapses: 3 }), null);
  assert.equal(flashcardRescuePrompt(slippingWord, masteredStat), null);
  assert.equal(flashcardRescuePrompt(slippingWord, leechStat, { dismissed: true }), null);
});

test("flashcard rescue prompt falls back to the word itself when examples are absent", () => {
  const prompt = flashcardRescuePrompt({ ...slippingWord, sentences: [] }, leechStat);

  assert.deepEqual(prompt?.examples, [{ cn: "桌子", en: "table" }]);
});
