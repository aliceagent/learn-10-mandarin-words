import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FLASHCARD_VISIBILITY,
  FLASHCARD_VISIBILITY_OPTIONS,
  FLASHCARD_VISIBILITY_STORAGE_KEY,
  normalizeFlashcardVisibility,
  serializeFlashcardVisibility,
  toggleFlashcardVisibility,
} from "../src/lib/flashcard-visibility.ts";

test("default flashcard visibility preserves the current card behavior", () => {
  assert.deepEqual(DEFAULT_FLASHCARD_VISIBILITY, {
    showPinyinBeforeReveal: false,
    showEnglishBeforeReveal: false,
    showEnglishAfterReveal: true,
  });
});

test("normalizeFlashcardVisibility accepts a complete serialized object", () => {
  const parsed = normalizeFlashcardVisibility(
    JSON.stringify({
      showPinyinBeforeReveal: true,
      showEnglishBeforeReveal: true,
      showEnglishAfterReveal: false,
    }),
  );

  assert.deepEqual(parsed, {
    showPinyinBeforeReveal: true,
    showEnglishBeforeReveal: true,
    showEnglishAfterReveal: false,
  });
});

test("normalizeFlashcardVisibility backfills missing and invalid fields from defaults", () => {
  const parsed = normalizeFlashcardVisibility(
    JSON.stringify({ showPinyinBeforeReveal: true, showEnglishAfterReveal: "nope" }),
  );

  assert.deepEqual(parsed, {
    showPinyinBeforeReveal: true,
    showEnglishBeforeReveal: false,
    showEnglishAfterReveal: true,
  });
});

test("normalizeFlashcardVisibility falls back safely for absent or malformed storage", () => {
  assert.deepEqual(normalizeFlashcardVisibility(null), DEFAULT_FLASHCARD_VISIBILITY);
  assert.deepEqual(normalizeFlashcardVisibility("not json"), DEFAULT_FLASHCARD_VISIBILITY);
  assert.deepEqual(normalizeFlashcardVisibility("[]"), DEFAULT_FLASHCARD_VISIBILITY);
});

test("serializeFlashcardVisibility round-trips through normalize", () => {
  const value = {
    showPinyinBeforeReveal: true,
    showEnglishBeforeReveal: false,
    showEnglishAfterReveal: false,
  };

  assert.deepEqual(normalizeFlashcardVisibility(serializeFlashcardVisibility(value)), value);
});

test("toggleFlashcardVisibility flips only the requested setting", () => {
  const next = toggleFlashcardVisibility(DEFAULT_FLASHCARD_VISIBILITY, "showEnglishBeforeReveal");

  assert.deepEqual(next, {
    showPinyinBeforeReveal: false,
    showEnglishBeforeReveal: true,
    showEnglishAfterReveal: true,
  });
});

test("FLASHCARD_VISIBILITY_OPTIONS exposes stable labels for the UI", () => {
  assert.deepEqual(
    FLASHCARD_VISIBILITY_OPTIONS.map((option) => [option.key, option.label]),
    [
      ["showPinyinBeforeReveal", "Pinyin hint"],
      ["showEnglishBeforeReveal", "English hint"],
      ["showEnglishAfterReveal", "English answer"],
    ],
  );
  assert.equal(FLASHCARD_VISIBILITY_STORAGE_KEY, "learn-10-mandarin-flashcard-visibility");
});
