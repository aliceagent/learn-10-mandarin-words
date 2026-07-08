import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FLASHCARD_DECK_ORDER,
  FLASHCARD_DECK_ORDER_OPTIONS,
  orderFlashcardDeck,
  serializeFlashcardDeckOrder,
} from "../src/lib/flashcard-deck-order.ts";

const topic = {
  slug: "ten-types-of-furniture",
  titleEn: "Ten Types of Furniture",
  items: [
    { hanzi: "椅子", pinyin: "yǐzi", english: "chair", sentences: [] },
    { hanzi: "桌子", pinyin: "zhuōzi", english: "table", sentences: [] },
    { hanzi: "沙发", pinyin: "shāfā", english: "sofa", sentences: [] },
    { hanzi: "床", pinyin: "chuáng", english: "bed", sentences: [] },
    { hanzi: "灯", pinyin: "dēng", english: "lamp", sentences: [] },
  ],
};

const now = new Date("2026-07-08T12:00:00.000Z");

const stats = {
  "ten-types-of-furniture:椅子": { intervalDays: 3, ease: 2.4, dueAt: "2026-07-06T00:00:00.000Z", reviewCount: 3, lapses: 0 },
  "ten-types-of-furniture:桌子": { intervalDays: 1, ease: 1.7, dueAt: "2026-07-07T00:00:00.000Z", reviewCount: 5, lapses: 3 },
  "ten-types-of-furniture:沙发": { intervalDays: 7, ease: 2.8, dueAt: "2026-07-20T00:00:00.000Z", reviewCount: 4, lapses: 0 },
  "ten-types-of-furniture:床": { intervalDays: 2, ease: 2.2, dueAt: "2026-07-05T00:00:00.000Z", reviewCount: 2, lapses: 1 },
};

function hanzi(items) {
  return items.map((item) => item.hanzi);
}

test("topic order keeps the curated topic sequence", () => {
  assert.deepEqual(hanzi(orderFlashcardDeck(topic, stats, "topic", { now })), ["椅子", "桌子", "沙发", "床", "灯"]);
});

test("due first sorts due reviewed cards by oldest due date before the rest", () => {
  assert.deepEqual(hanzi(orderFlashcardDeck(topic, stats, "due-first", { now })), ["床", "椅子", "桌子", "沙发", "灯"]);
});

test("weak first prioritizes low-confidence and lapsed cards without losing new words", () => {
  assert.deepEqual(hanzi(orderFlashcardDeck(topic, stats, "weak-first", { now })), ["桌子", "床", "椅子", "沙发", "灯"]);
});

test("new words puts unseen cards first, then preserves topic order for the rest", () => {
  assert.deepEqual(hanzi(orderFlashcardDeck(topic, stats, "new", { now })), ["灯", "椅子", "桌子", "沙发", "床"]);
});

test("mixed smart interleaves due, weak, new, and solid cards in a stable snapshot", () => {
  assert.deepEqual(hanzi(orderFlashcardDeck(topic, stats, "mixed-smart", { now })), ["床", "桌子", "灯", "椅子", "沙发"]);
});

test("deck order parsing falls back safely", () => {
  assert.equal(DEFAULT_FLASHCARD_DECK_ORDER, "mixed-smart");
  assert.equal(serializeFlashcardDeckOrder("weak-first"), "weak-first");
  assert.equal(serializeFlashcardDeckOrder("nope"), DEFAULT_FLASHCARD_DECK_ORDER);
  assert.deepEqual(FLASHCARD_DECK_ORDER_OPTIONS.map((option) => option.key), ["topic", "due-first", "weak-first", "new", "mixed-smart"]);
});
