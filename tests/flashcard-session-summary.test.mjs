import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyFlashcardSession,
  recordFlashcardSessionResult,
  flashcardSessionSummary,
  itemsForFlashcardSessionKeys,
} from "../src/lib/flashcard-session-summary.ts";

const topic = {
  slug: "ten-types-of-furniture",
  titleCn: "十种家具",
  titleEn: "Ten Types of Furniture",
  category: "Home",
  categorySlug: "home",
  videoPath: "",
  items: [
    { hanzi: "椅子", pinyin: "yǐzi", english: "chair", sentences: [] },
    { hanzi: "桌子", pinyin: "zhuōzi", english: "table", sentences: [] },
    { hanzi: "沙发", pinyin: "shāfā", english: "sofa", sentences: [] },
  ],
};

const beforeStats = {
  "ten-types-of-furniture:椅子": { intervalDays: 1, ease: 2.3, dueAt: "2026-07-08T00:00:00.000Z", reviewCount: 1, lapses: 0 },
  "ten-types-of-furniture:桌子": { intervalDays: 1, ease: 2.0, dueAt: "2026-07-08T00:00:00.000Z", reviewCount: 2, lapses: 1 },
  "ten-types-of-furniture:沙发": { intervalDays: 0, ease: 2.5, dueAt: "2026-07-08T00:00:00.000Z", reviewCount: 0, lapses: 0 },
};

const afterStats = {
  "ten-types-of-furniture:椅子": { intervalDays: 4, ease: 2.4, dueAt: "2026-07-12T00:00:00.000Z", reviewCount: 2, lapses: 0 },
  "ten-types-of-furniture:桌子": { intervalDays: 1, ease: 1.8, dueAt: "2026-07-09T00:00:00.000Z", reviewCount: 3, lapses: 2 },
  "ten-types-of-furniture:沙发": { intervalDays: 7, ease: 2.6, dueAt: "2026-07-15T00:00:00.000Z", reviewCount: 1, lapses: 0 },
};

test("flashcard session summary counts reviewed grades, known, improved, and needs-work words", () => {
  let session = emptyFlashcardSession(topic);
  session = recordFlashcardSessionResult(session, "ten-types-of-furniture:椅子", "good", beforeStats["ten-types-of-furniture:椅子"]);
  session = recordFlashcardSessionResult(session, "ten-types-of-furniture:桌子", "again", beforeStats["ten-types-of-furniture:桌子"]);
  session = recordFlashcardSessionResult(session, "ten-types-of-furniture:沙发", "known", beforeStats["ten-types-of-furniture:沙发"]);

  assert.deepEqual(flashcardSessionSummary(session, topic, afterStats), {
    complete: true,
    reviewedCount: 3,
    totalCount: 3,
    gradeCounts: { again: 1, hard: 0, good: 1, easy: 0, known: 1 },
    improvedCount: 2,
    needsWorkCount: 1,
    knownCount: 1,
    needsWorkKeys: ["ten-types-of-furniture:桌子"],
  });
});

test("itemsForFlashcardSessionKeys returns missed words in topic order for re-drill", () => {
  assert.deepEqual(
    itemsForFlashcardSessionKeys(topic, ["ten-types-of-furniture:沙发", "ten-types-of-furniture:椅子"]),
    [topic.items[0], topic.items[2]],
  );
});
