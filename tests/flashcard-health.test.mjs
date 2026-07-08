import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FLASHCARD_SETTINGS,
  flashcardHealthSummary,
  flashcardTopicHealth,
  normalizeFlashcardSettings,
} from "../src/lib/flashcard-health.ts";

const now = new Date("2026-07-08T12:00:00.000Z");

const topics = [
  {
    slug: "ten-types-of-furniture",
    titleEn: "Ten Types of Furniture",
    items: [
      { hanzi: "椅子", pinyin: "yǐzi", english: "chair", sentences: [] },
      { hanzi: "桌子", pinyin: "zhuōzi", english: "table", sentences: [] },
      { hanzi: "沙发", pinyin: "shāfā", english: "sofa", sentences: [] },
      { hanzi: "床", pinyin: "chuáng", english: "bed", sentences: [] },
    ],
  },
  {
    slug: "ten-types-of-fruit",
    titleEn: "Ten Types of Fruit",
    items: [
      { hanzi: "苹果", pinyin: "píngguǒ", english: "apple", sentences: [] },
      { hanzi: "香蕉", pinyin: "xiāngjiāo", english: "banana", sentences: [] },
    ],
  },
];

const flashcardStats = {
  "ten-types-of-furniture:椅子": { intervalDays: 1, ease: 2.0, dueAt: "2026-07-07T00:00:00.000Z", reviewCount: 2, lapses: 0 },
  "ten-types-of-furniture:桌子": { intervalDays: 1, ease: 1.4, dueAt: "2026-07-08T00:00:00.000Z", reviewCount: 5, lapses: 4 },
  "ten-types-of-furniture:沙发": { intervalDays: 18, ease: 2.8, dueAt: "2026-07-25T00:00:00.000Z", reviewCount: 6, lapses: 0 },
  "ten-types-of-fruit:苹果": { intervalDays: 8, ease: 2.4, dueAt: "2026-07-10T00:00:00.000Z", reviewCount: 3, lapses: 0 },
};

test("flashcard health summarizes tracked, due, shaky, solid, mastered, and rescue counts", () => {
  assert.deepEqual(flashcardHealthSummary(topics, flashcardStats, { now }), {
    totalWords: 6,
    totalTracked: 4,
    due: 2,
    newWords: 2,
    shaky: 2,
    solid: 2,
    mastered: 2,
    needsRescue: 1,
  });
});

test("topic flashcard health exposes concise SRS status per topic", () => {
  assert.deepEqual(flashcardTopicHealth(topics[0], flashcardStats, { now }), {
    slug: "ten-types-of-furniture",
    title: "Ten Types of Furniture",
    totalWords: 4,
    tracked: 3,
    due: 2,
    newWords: 1,
    shaky: 2,
    solid: 1,
    mastered: 1,
    needsRescue: 1,
    status: "needs rescue",
  });

  assert.equal(flashcardTopicHealth(topics[1], flashcardStats, { now }).status, "building");
});

test("flashcard settings normalize local-only dashboard defaults safely", () => {
  assert.deepEqual(DEFAULT_FLASHCARD_SETTINGS, {
    showHealthDashboard: true,
    defaultDeckOrder: "mixed-smart",
  });
  assert.deepEqual(normalizeFlashcardSettings({ showHealthDashboard: false, defaultDeckOrder: "weak-first" }), {
    showHealthDashboard: false,
    defaultDeckOrder: "weak-first",
  });
  assert.deepEqual(normalizeFlashcardSettings({ showHealthDashboard: "no", defaultDeckOrder: "wat" }), DEFAULT_FLASHCARD_SETTINGS);
});
