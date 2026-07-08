import test from "node:test";
import assert from "node:assert/strict";

import { compactFlashcardSettingsSummary } from "../src/lib/flashcard-mobile-settings.ts";

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
