import test from "node:test";
import assert from "node:assert/strict";

import {
  computeStreak,
  defaultStat,
  emptyProgress,
  normalizeProgress,
  scheduleReview,
  uniqueToggle,
} from "../src/lib/progress-logic.ts";

test("normalizeProgress fills a full shape from empty input", () => {
  const p = normalizeProgress({});
  assert.deepEqual(p, emptyProgress);
  // Returns a fresh object, not the shared default.
  assert.notEqual(p, emptyProgress);
});

test("normalizeProgress upgrades a legacy save without onboarding", () => {
  const legacy = {
    learnedTopics: ["ten-types-of-pets"],
    favoriteTopics: ["ten-types-of-drinks"],
    favoriteWords: ["ten-types-of-pets:狗"],
    flashcardStats: {},
    studiedDates: ["2026-06-30"],
  };
  const p = normalizeProgress(legacy);
  assert.deepEqual(p.learnedTopics, legacy.learnedTopics);
  assert.deepEqual(p.favoriteTopics, legacy.favoriteTopics);
  assert.deepEqual(p.favoriteWords, legacy.favoriteWords);
  assert.deepEqual(p.studiedDates, legacy.studiedDates);
  assert.deepEqual(p.onboarding, { completed: false, dailyGoal: 0, completedAt: null });
});

test("normalizeProgress keeps a partial onboarding and backfills the rest", () => {
  const p = normalizeProgress({ onboarding: { completed: true } });
  assert.deepEqual(p.onboarding, { completed: true, dailyGoal: 0, completedAt: null });
});

test("uniqueToggle adds when absent and removes when present", () => {
  assert.deepEqual(uniqueToggle([], "a"), ["a"]);
  assert.deepEqual(uniqueToggle(["a"], "b"), ["a", "b"]);
  assert.deepEqual(uniqueToggle(["a", "b"], "a"), ["b"]);
});

test("computeStreak returns 0 for no studied dates", () => {
  assert.equal(computeStreak([]), 0);
});

test("computeStreak counts consecutive days ending today", () => {
  const today = "2026-07-01";
  assert.equal(computeStreak(["2026-07-01"], today), 1);
  assert.equal(computeStreak(["2026-06-30", "2026-07-01"], today), 2);
  assert.equal(computeStreak(["2026-06-29", "2026-06-30", "2026-07-01"], today), 3);
});

test("computeStreak still counts when the latest day is yesterday", () => {
  const today = "2026-07-01";
  assert.equal(computeStreak(["2026-06-29", "2026-06-30"], today), 2);
});

test("computeStreak breaks on a gap and ignores older runs", () => {
  const today = "2026-07-01";
  // 07-01 and 06-30 are consecutive; 06-28 is a day gap away from 06-30.
  assert.equal(computeStreak(["2026-06-28", "2026-06-30", "2026-07-01"], today), 2);
});

test("computeStreak returns 0 when the latest day is older than yesterday", () => {
  const today = "2026-07-01";
  assert.equal(computeStreak(["2026-06-01", "2026-06-02"], today), 0);
});

test("scheduleReview schedules a first review deterministically per grade", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  const base = defaultStat(now);
  assert.equal(base.reviewCount, 0);

  const again = scheduleReview(base, "again", now);
  assert.equal(again.intervalDays, 1);
  assert.equal(again.reviewCount, 1);
  assert.equal(again.ease, 2.3);
  assert.equal(again.dueAt, new Date("2026-07-02T12:00:00.000Z").toISOString());

  assert.equal(scheduleReview(base, "hard", now).intervalDays, 1);
  assert.equal(scheduleReview(base, "good", now).intervalDays, 2);

  const easy = scheduleReview(base, "easy", now);
  assert.equal(easy.intervalDays, 4);
  assert.equal(easy.ease, 2.65);
});

test("scheduleReview grows the interval on repeated good reviews", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const first = scheduleReview(defaultStat(now), "good", now); // interval 2
  const second = scheduleReview(first, "good", now); // max(2, 2*2) = 4
  assert.equal(second.intervalDays, 4);
  assert.equal(second.reviewCount, 2);
});

test("scheduleReview clamps ease to a 1.3 floor", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  let stat = { intervalDays: 3, ease: 1.4, dueAt: now.toISOString(), reviewCount: 5 };
  stat = scheduleReview(stat, "again", now); // 1.4 - 0.2 = 1.2 -> floored to 1.3
  assert.equal(stat.ease, 1.3);
  stat = scheduleReview(stat, "again", now); // stays at floor
  assert.equal(stat.ease, 1.3);
});
