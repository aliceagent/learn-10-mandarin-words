import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FLASHCARD_DIRECTION,
  FLASHCARD_DIRECTION_OPTIONS,
  FLASHCARD_DIRECTION_STORAGE_KEY,
  buildFlashcardFace,
  directionForCard,
  normalizeFlashcardDirection,
  serializeFlashcardDirection,
  toggleableDirections,
} from "../src/lib/flashcard-direction.ts";

const sofa = { hanzi: "沙发", pinyin: "shāfā", english: "sofa" };

test("default direction preserves current Chinese to English behavior", () => {
  assert.equal(DEFAULT_FLASHCARD_DIRECTION, "zh-en");
  assert.equal(FLASHCARD_DIRECTION_STORAGE_KEY, "learn-10-mandarin-flashcard-direction");
});

test("normalizeFlashcardDirection accepts known modes and rejects junk", () => {
  assert.equal(normalizeFlashcardDirection("zh-en"), "zh-en");
  assert.equal(normalizeFlashcardDirection("en-zh"), "en-zh");
  assert.equal(normalizeFlashcardDirection("pinyin-zh"), "pinyin-zh");
  assert.equal(normalizeFlashcardDirection("mixed"), "mixed");
  assert.equal(normalizeFlashcardDirection(null), DEFAULT_FLASHCARD_DIRECTION);
  assert.equal(normalizeFlashcardDirection("ZH-EN"), DEFAULT_FLASHCARD_DIRECTION);
  assert.equal(normalizeFlashcardDirection("nope"), DEFAULT_FLASHCARD_DIRECTION);
});

test("serializeFlashcardDirection round-trips through normalize", () => {
  assert.equal(normalizeFlashcardDirection(serializeFlashcardDirection("en-zh")), "en-zh");
});

test("directionForCard keeps explicit modes and rotates mixed deterministically", () => {
  assert.equal(directionForCard("en-zh", 4), "en-zh");
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((index) => directionForCard("mixed", index)),
    ["zh-en", "en-zh", "pinyin-zh", "zh-en", "en-zh", "pinyin-zh"],
  );
});

test("buildFlashcardFace for Chinese to English prompts with hanzi and answers with pinyin + English", () => {
  assert.deepEqual(buildFlashcardFace(sofa, "zh-en"), {
    promptKind: "hanzi",
    promptPrimary: "沙发",
    promptSecondary: null,
    answerPrimary: "沙发",
    answerPinyin: "shāfā",
    answerEnglish: "sofa",
  });
});

test("buildFlashcardFace for English to Chinese prompts with English and answers with hanzi + pinyin", () => {
  assert.deepEqual(buildFlashcardFace(sofa, "en-zh"), {
    promptKind: "english",
    promptPrimary: "sofa",
    promptSecondary: null,
    answerPrimary: "沙发",
    answerPinyin: "shāfā",
    answerEnglish: "sofa",
  });
});

test("buildFlashcardFace for pinyin to Chinese prompts with pinyin and answers with hanzi + English", () => {
  assert.deepEqual(buildFlashcardFace(sofa, "pinyin-zh"), {
    promptKind: "pinyin",
    promptPrimary: "shāfā",
    promptSecondary: null,
    answerPrimary: "沙发",
    answerPinyin: "shāfā",
    answerEnglish: "sofa",
  });
});

test("direction options expose stable labels and excludes mixed from deterministic rotation", () => {
  assert.deepEqual(
    FLASHCARD_DIRECTION_OPTIONS.map((option) => [option.key, option.label]),
    [
      ["zh-en", "Chinese → English"],
      ["en-zh", "English → Chinese"],
      ["pinyin-zh", "Pinyin → Chinese"],
      ["mixed", "Mixed"],
    ],
  );
  assert.deepEqual(toggleableDirections, ["zh-en", "en-zh", "pinyin-zh"]);
});
