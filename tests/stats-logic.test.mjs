import test from "node:test";
import assert from "node:assert/strict";

import { computeStats, emptyProgress } from "../src/lib/progress-logic.ts";

test("computeStats returns all-zero stats for empty progress", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  const stats = computeStats(emptyProgress, now);
  assert.deepEqual(stats, {
    learnedTopics: 0,
    favoriteWords: 0,
    favoriteTopics: 0,
    dueReviews: 0,
    reviewedWords: 0,
    wordsTracked: 0,
    totalReviews: 0,
    daysStudied: 0,
    streak: 0,
  });
});

test("computeStats derives counts from a sample progress state", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  const progress = {
    schemaVersion: 2,
    learnedTopics: ["ten-types-of-pets", "ten-types-of-drinks"],
    favoriteTopics: ["ten-types-of-drinks"],
    favoriteWords: ["ten-types-of-pets:狗", "ten-types-of-pets:猫", "ten-types-of-drinks:茶"],
    flashcardStats: {
      // Due in the past → counts as due.
      "ten-types-of-pets:狗": { intervalDays: 1, ease: 2.5, dueAt: "2026-06-30T00:00:00.000Z", reviewCount: 3 },
      // Due exactly now → counts as due (<=).
      "ten-types-of-pets:猫": { intervalDays: 2, ease: 2.5, dueAt: "2026-07-01T12:00:00.000Z", reviewCount: 1 },
      // Due in the future → not due, but still reviewed/tracked.
      "ten-types-of-drinks:茶": { intervalDays: 10, ease: 2.6, dueAt: "2026-07-20T00:00:00.000Z", reviewCount: 5 },
    },
    studiedDates: ["2026-06-29", "2026-06-30", "2026-07-01"],
    onboarding: { completed: true, dailyGoal: 10, completedAt: "2026-06-29" },
  };

  const stats = computeStats(progress, now);
  assert.equal(stats.learnedTopics, 2);
  assert.equal(stats.favoriteWords, 3);
  assert.equal(stats.favoriteTopics, 1);
  assert.equal(stats.dueReviews, 2); // 狗 (past) + 猫 (exactly now)
  assert.equal(stats.reviewedWords, 3); // all three have reviewCount > 0
  assert.equal(stats.wordsTracked, 3);
  assert.equal(stats.totalReviews, 9); // 3 + 1 + 5
  assert.equal(stats.daysStudied, 3);
  assert.equal(stats.streak, 3); // three consecutive days ending today
});

test("computeStats ignores an unfinite due date when counting due reviews", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  const progress = {
    ...emptyProgress,
    flashcardStats: {
      "topic:好": { intervalDays: 0, ease: 2.5, dueAt: "not-a-date", reviewCount: 0 },
    },
  };
  const stats = computeStats(progress, now);
  assert.equal(stats.dueReviews, 0);
  assert.equal(stats.wordsTracked, 1);
  assert.equal(stats.reviewedWords, 0);
});
