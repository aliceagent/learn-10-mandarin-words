import test from "node:test";
import assert from "node:assert/strict";

import {
  compactFlashcardSettingsSummary,
  flashcardMobileSettingsDrawerCopy,
  flashcardMobileSettingsDrawerClass,
} from "../src/lib/flashcard-mobile-settings.ts";

const health = {
  totalWords: 10,
  tracked: 4,
  newWords: 6,
  due: 2,
  shaky: 1,
  solid: 2,
  mastered: 1,
  needsRescue: 1,
  status: "due",
};

test("compactFlashcardSettingsSummary keeps mobile advanced settings to short labels", () => {
  assert.deepEqual(
    compactFlashcardSettingsSummary({
      health,
      directionLabel: "Mixed",
      deckOrderLabel: "Due first",
      hintCount: 2,
    }),
    ["2 due", "Mixed", "Due first", "2 hints"],
  );
});

test("compactFlashcardSettingsSummary handles zero hints without extra wording", () => {
  assert.deepEqual(
    compactFlashcardSettingsSummary({
      health: { ...health, due: 0, status: "healthy" },
      directionLabel: "Hanzi to English",
      deckOrderLabel: "Default",
      hintCount: 0,
    }),
    ["healthy", "Hanzi to English", "Default", "0 hints"],
  );
});

test("flashcardMobileSettingsDrawerCopy makes settings entry and drawer state explicit", () => {
  assert.deepEqual(flashcardMobileSettingsDrawerCopy(false), {
    action: "Settings",
    title: "Practice settings",
    ariaLabel: "Open flashcard settings drawer",
    expanded: "Settings closed",
  });

  assert.deepEqual(flashcardMobileSettingsDrawerCopy(true), {
    action: "Close settings",
    title: "Practice settings",
    ariaLabel: "Close flashcard settings drawer",
    expanded: "Settings open",
  });
});

test("flashcardMobileSettingsDrawerClass renders as a lightweight in-app drawer only when open", () => {
  assert.equal(flashcardMobileSettingsDrawerClass(false), "hidden");

  const open = flashcardMobileSettingsDrawerClass(true);
  assert.match(open, /absolute/);
  assert.match(open, /inset-x-3/);
  assert.match(open, /top-\[calc\(env\(safe-area-inset-top\)\+4\.25rem\)\]/);
  assert.match(open, /max-h-\[min\(70dvh,34rem\)\]/);
  assert.match(open, /overflow-y-auto/);
});
