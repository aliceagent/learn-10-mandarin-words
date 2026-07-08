import test from "node:test";
import assert from "node:assert/strict";

import {
  confidencePercent,
  flashcardConfidence,
  confidenceAriaLabel,
} from "../src/lib/flashcard-confidence.ts";

const due = "2026-07-08T00:00:00.000Z";

test("missing or never-reviewed stats are New with 0 confidence", () => {
  assert.deepEqual(flashcardConfidence(undefined), {
    score: 0,
    label: "New",
    tone: "slate",
    explanation: "Not reviewed yet",
  });
  assert.equal(flashcardConfidence({ intervalDays: 0, ease: 2.5, dueAt: due, reviewCount: 0, lapses: 0 }).label, "New");
});

test("low interval with lapses is Shaky", () => {
  assert.deepEqual(flashcardConfidence({ intervalDays: 1, ease: 2.1, dueAt: due, reviewCount: 3, lapses: 1 }), {
    score: 25,
    label: "Shaky",
    tone: "amber",
    explanation: "Missed before; keep it close",
  });
});

test("repeated lapses below mastery are Needs rescue", () => {
  assert.deepEqual(flashcardConfidence({ intervalDays: 3, ease: 1.7, dueAt: due, reviewCount: 8, lapses: 4 }), {
    score: 10,
    label: "Needs rescue",
    tone: "rose",
    explanation: "Repeated misses; use focused practice",
  });
});

test("reviewed short-interval cards are Learning", () => {
  const confidence = flashcardConfidence({ intervalDays: 2, ease: 2.5, dueAt: due, reviewCount: 2, lapses: 0 });
  assert.equal(confidence.label, "Learning");
  assert.equal(confidence.tone, "sky");
  assert.equal(confidence.score, 30);
});

test("medium interval cards are Solid", () => {
  const confidence = flashcardConfidence({ intervalDays: 5, ease: 2.6, dueAt: due, reviewCount: 3, lapses: 0 });
  assert.equal(confidence.label, "Solid");
  assert.equal(confidence.tone, "emerald");
  assert.equal(confidence.score, 67);
});

test("mastery-threshold interval cards are Mastered", () => {
  const confidence = flashcardConfidence({ intervalDays: 7, ease: 2.7, dueAt: due, reviewCount: 4, lapses: 0 });
  assert.equal(confidence.label, "Mastered");
  assert.equal(confidence.tone, "emerald");
  assert.equal(confidence.score, 94);
});

test("confidencePercent clamps weird inputs", () => {
  assert.equal(confidencePercent(Number.NaN), 0);
  assert.equal(confidencePercent(-20), 0);
  assert.equal(confidencePercent(150), 100);
  assert.equal(confidencePercent(42.8), 43);
});

test("confidence aria label includes label, score, and explanation", () => {
  const confidence = flashcardConfidence({ intervalDays: 5, ease: 2.6, dueAt: due, reviewCount: 3, lapses: 0 });
  assert.equal(confidenceAriaLabel(confidence), "Confidence 67%, Solid — Building a longer review interval");
});
