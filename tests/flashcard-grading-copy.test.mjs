import test from "node:test";
import assert from "node:assert/strict";

import {
  FLASHCARD_RECALL_PROMPT,
  flashcardGradeAriaLabel,
  flashcardGradeLabel,
  flashcardGradeMicrocopy,
  flashcardGradePreviewLabel,
  flashcardGradeSegments,
} from "../src/lib/flashcard-grading-copy.ts";

test("flashcardGradeLabel maps internal scheduling grades to recall-quality labels", () => {
  assert.deepEqual(
    ["again", "hard", "good", "easy"].map((grade) => [grade, flashcardGradeLabel(grade)]),
    [
      ["again", "Forgot"],
      ["hard", "Struggled"],
      ["good", "Remembered"],
      ["easy", "Instant"],
    ],
  );
});

test("flashcard grade microcopy asks about recall before the answer", () => {
  assert.equal(FLASHCARD_RECALL_PROMPT, "How well did you recall it before seeing the answer?");
  assert.equal(flashcardGradeMicrocopy("again"), "I could not recall it yet.");
  assert.equal(flashcardGradeMicrocopy("hard"), "I got there, but it took effort.");
  assert.equal(flashcardGradeMicrocopy("good"), "I remembered it with steady recall.");
  assert.equal(flashcardGradeMicrocopy("easy"), "It came to mind instantly.");
});

test("flashcardGradePreviewLabel preserves interval previews with clearer copy", () => {
  assert.equal(flashcardGradePreviewLabel("again", 0), "Review again today");
  assert.equal(flashcardGradePreviewLabel("hard", 1), "Next review in 1 day");
  assert.equal(flashcardGradePreviewLabel("good", 3), "Next review in 3 days");
  assert.equal(flashcardGradePreviewLabel("easy", 14), "Next review in 14 days");
});

test("flashcardGradeAriaLabel names recall label, internal grade, microcopy, and interval", () => {
  assert.equal(
    flashcardGradeAriaLabel("hard", 1),
    "Struggled, schedules hard — I got there, but it took effort. Next review in 1 day",
  );
});

test("flashcardGradeSegments expose stable labels while preserving internal grades", () => {
  assert.deepEqual(
    flashcardGradeSegments.map(({ grade, label, rule }) => [grade, label, rule]),
    [
      ["again", "Forgot", "border-rose-400/60"],
      ["hard", "Struggled", "border-amber-400/60"],
      ["good", "Remembered", "border-slate-400/50"],
      ["easy", "Instant", "border-emerald-400/60"],
    ],
  );
});
