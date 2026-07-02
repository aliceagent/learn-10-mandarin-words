import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_PROGRESS_SCHEMA_VERSION,
  EASE_CEIL,
  EASE_FLOOR,
  computeStreak,
  computeWeakWords,
  defaultStat,
  dueCards,
  emptyProgress,
  normalizeProgress,
  normalizeQuizStat,
  normalizeStat,
  scheduleReview,
  topicProgress,
  updateQuizStats,
  uniqueToggle,
} from "../src/lib/progress-logic.ts";

// Minimal Topic/VocabItem fixtures for the dataset-shaped helpers. Only the
// fields the helpers read need to be present; wordKey is `slug:hanzi`.
function makeTopic(slug, hanziList, titleEn = slug) {
  return {
    slug,
    titleEn,
    items: hanziList.map((hanzi) => ({
      hanzi,
      pinyin: `${hanzi}-pinyin`,
      english: `${hanzi}-english`,
      sentences: [],
    })),
  };
}

test("normalizeProgress fills a full shape from empty input", () => {
  const p = normalizeProgress({});
  assert.deepEqual(p, emptyProgress);
  assert.equal(p.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION);
  // Returns a fresh object, not the shared default.
  assert.notEqual(p, emptyProgress);
});

test("normalizeProgress upgrades a legacy save without schemaVersion or onboarding", () => {
  const legacy = {
    // No schemaVersion and no onboarding — a pre-migration save.
    learnedTopics: ["ten-types-of-pets"],
    favoriteTopics: ["ten-types-of-drinks"],
    favoriteWords: ["ten-types-of-pets:狗"],
    flashcardStats: {},
    studiedDates: ["2026-06-30"],
  };
  const p = normalizeProgress(legacy);
  // Migration stamps the current version and backfills onboarding...
  assert.equal(p.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION);
  assert.deepEqual(p.onboarding, { completed: false, dailyGoal: 0, completedAt: null });
  // ...without dropping any of the user's existing data.
  assert.deepEqual(p.learnedTopics, legacy.learnedTopics);
  assert.deepEqual(p.favoriteTopics, legacy.favoriteTopics);
  assert.deepEqual(p.favoriteWords, legacy.favoriteWords);
  assert.deepEqual(p.studiedDates, legacy.studiedDates);
});

test("normalizeProgress never throws on garbage and preserves valid arrays", () => {
  const p = normalizeProgress({
    schemaVersion: 1,
    learnedTopics: ["keep-me", 42, null], // non-strings are dropped
    favoriteTopics: "not-an-array", // wrong type falls back to []
    favoriteWords: ["ten-types-of-fruit:桃"],
    studiedDates: ["2026-06-30"],
    onboarding: "nope",
  });
  assert.equal(p.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION);
  assert.deepEqual(p.learnedTopics, ["keep-me"]);
  assert.deepEqual(p.favoriteTopics, []);
  assert.deepEqual(p.favoriteWords, ["ten-types-of-fruit:桃"]);
  assert.deepEqual(p.studiedDates, ["2026-06-30"]);
  assert.deepEqual(p.onboarding, emptyProgress.onboarding);
});

test("normalizeProgress repairs partial/invalid flashcard stats without dropping keys", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const p = normalizeProgress(
    {
      flashcardStats: {
        // Valid entry passes through untouched.
        "topic:好": { intervalDays: 3, ease: 2.4, dueAt: "2026-07-05T00:00:00.000Z", reviewCount: 2 },
        // Missing reviewCount + out-of-range ease + bad dueAt are all repaired.
        "topic:坏": { intervalDays: 5, ease: 9, dueAt: "not-a-date" },
        // Fully broken entry becomes a fresh default stat.
        "topic:空": null,
      },
    },
    now,
  );
  const keys = new Set(Object.keys(p.flashcardStats));
  assert.deepEqual(keys, new Set(["topic:好", "topic:坏", "topic:空"]));
  assert.deepEqual(p.flashcardStats["topic:好"], {
    intervalDays: 3,
    ease: 2.4,
    dueAt: "2026-07-05T00:00:00.000Z",
    reviewCount: 2,
  });
  assert.equal(p.flashcardStats["topic:坏"].ease, EASE_CEIL); // 9 clamped down
  assert.equal(p.flashcardStats["topic:坏"].reviewCount, 0); // backfilled
  assert.equal(p.flashcardStats["topic:坏"].dueAt, now.toISOString()); // invalid date repaired
  assert.deepEqual(p.flashcardStats["topic:空"], defaultStat(now));
});

test("normalizeStat clamps ease to the sane range and floors negatives", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  assert.equal(normalizeStat({ ease: 99 }, now).ease, EASE_CEIL);
  assert.equal(normalizeStat({ ease: 0.1 }, now).ease, EASE_FLOOR);
  assert.equal(normalizeStat({ ease: Number.NaN }, now).ease, defaultStat(now).ease);
  assert.equal(normalizeStat({ intervalDays: -4 }, now).intervalDays, 0);
});

test("normalizeProgress keeps a partial onboarding and backfills the rest", () => {
  const p = normalizeProgress({ onboarding: { completed: true } });
  assert.deepEqual(p.onboarding, { completed: true, dailyGoal: 0, completedAt: null });
});

// ─── quizStats: migration, normalization, weak-word derivation ──────────────────

test("normalizeProgress migrates a v2 save to v3 and backfills empty quizStats", () => {
  const v2 = {
    schemaVersion: 2, // pre-quizStats save
    learnedTopics: ["ten-types-of-pets"],
    favoriteTopics: [],
    favoriteWords: ["ten-types-of-pets:狗"],
    flashcardStats: {},
    studiedDates: ["2026-06-30"],
    onboarding: { completed: true, dailyGoal: 5, completedAt: "2026-06-30" },
  };
  const p = normalizeProgress(v2);
  assert.equal(p.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION); // 3
  assert.deepEqual(p.quizStats, {}); // backfilled, lossless
  // Everything the v2 save carried is preserved untouched.
  assert.deepEqual(p.learnedTopics, v2.learnedTopics);
  assert.deepEqual(p.favoriteWords, v2.favoriteWords);
  assert.deepEqual(p.studiedDates, v2.studiedDates);
  assert.deepEqual(p.onboarding, v2.onboarding);
});

test("normalizeProgress repairs corrupt quizStats without dropping keys", () => {
  const p = normalizeProgress({
    quizStats: {
      "t:好": { correct: 4, attempts: 6 }, // valid, passes through
      "t:坏": { correct: 10, attempts: 3 }, // correct clamped down to attempts
      "t:半": { correct: 2.7, attempts: 5.2 }, // rounded to integers
      "t:空": "garbage", // non-object → 0/0
      "t:负": { correct: -1, attempts: -4 }, // negatives → 0/0
    },
  });
  const keys = new Set(Object.keys(p.quizStats));
  assert.deepEqual(keys, new Set(["t:好", "t:坏", "t:半", "t:空", "t:负"]));
  assert.deepEqual(p.quizStats["t:好"], { correct: 4, attempts: 6 });
  assert.deepEqual(p.quizStats["t:坏"], { correct: 3, attempts: 3 }); // clamped
  assert.deepEqual(p.quizStats["t:半"], { correct: 3, attempts: 5 }); // rounded
  assert.deepEqual(p.quizStats["t:空"], { correct: 0, attempts: 0 });
  assert.deepEqual(p.quizStats["t:负"], { correct: 0, attempts: 0 });
});

test("normalizeQuizStat enforces correct ≤ attempts and non-negative integers", () => {
  assert.deepEqual(normalizeQuizStat({ correct: 3, attempts: 5 }), { correct: 3, attempts: 5 });
  assert.deepEqual(normalizeQuizStat({ correct: 9, attempts: 2 }), { correct: 2, attempts: 2 });
  assert.deepEqual(normalizeQuizStat({ correct: 3 }), { correct: 0, attempts: 0 }); // no attempts
  assert.deepEqual(normalizeQuizStat(null), { correct: 0, attempts: 0 });
  assert.deepEqual(normalizeQuizStat({ attempts: Number.NaN }), { correct: 0, attempts: 0 });
});

test("updateQuizStats increments attempts (and correct) immutably", () => {
  const start = {};
  const afterWrong = updateQuizStats(start, "t:好", false);
  assert.deepEqual(afterWrong, { "t:好": { correct: 0, attempts: 1 } });
  assert.deepEqual(start, {}); // input untouched
  const afterRight = updateQuizStats(afterWrong, "t:好", true);
  assert.deepEqual(afterRight["t:好"], { correct: 1, attempts: 2 });
  // A corrupt existing entry is normalized before the increment.
  const fromGarbage = updateQuizStats({ "t:坏": { correct: 99, attempts: 1 } }, "t:坏", true);
  assert.deepEqual(fromGarbage["t:坏"], { correct: 2, attempts: 2 }); // 1→normalized to 1/1, then +1/+1
});

test("computeWeakWords sorts by lowest accuracy and filters by attempts", () => {
  const quizStats = {
    a: { correct: 1, attempts: 4 }, // 25%
    b: { correct: 3, attempts: 4 }, // 75%
    c: { correct: 2, attempts: 2 }, // 100% but only 2 attempts → filtered out (min 3)
    d: { correct: 0, attempts: 5 }, // 0%
    e: { correct: 4, attempts: 4 }, // 100%
  };
  const weak = computeWeakWords(quizStats);
  assert.deepEqual(weak.map((w) => w.key), ["d", "a", "b", "e"]);
  assert.deepEqual(weak[0], { key: "d", correct: 0, attempts: 5, accuracy: 0 });
  assert.equal(weak[1].accuracy, 0.25);
});

test("computeWeakWords respects the limit and minAttempts options", () => {
  const quizStats = {
    a: { correct: 1, attempts: 4 },
    b: { correct: 3, attempts: 4 },
    d: { correct: 0, attempts: 5 },
  };
  assert.deepEqual(computeWeakWords(quizStats, { limit: 2 }).map((w) => w.key), ["d", "a"]);
  // minAttempts 5 leaves only the 5-attempt word.
  assert.deepEqual(computeWeakWords(quizStats, { minAttempts: 5 }).map((w) => w.key), ["d"]);
});

test("computeWeakWords breaks accuracy ties toward more-attempted words", () => {
  const quizStats = {
    x: { correct: 1, attempts: 4 }, // 25%, 4 attempts
    y: { correct: 2, attempts: 8 }, // 25%, 8 attempts
  };
  assert.deepEqual(computeWeakWords(quizStats).map((w) => w.key), ["y", "x"]);
});

test("computeWeakWords tolerates empty or missing quizStats", () => {
  assert.deepEqual(computeWeakWords({}), []);
  assert.deepEqual(computeWeakWords(undefined), []);
});

// ─── topicProgress ──────────────────────────────────────────────────────────────

test("topicProgress counts studied and mastered against the thresholds", () => {
  const topic = makeTopic("t", ["好", "坏", "空", "半"]);
  const flashcardStats = {
    // studied (reviewCount > 0) but not mastered (interval < 7).
    "t:好": { reviewCount: 2, intervalDays: 3 },
    // studied and mastered (interval == 7, the threshold).
    "t:坏": { reviewCount: 5, intervalDays: 7 },
    // not studied (reviewCount 0) but still mastered: mastery keys off the
    // interval alone, independent of reviewCount — matching the original.
    "t:空": { reviewCount: 0, intervalDays: 30 },
    // no stat at all for "半".
  };
  assert.deepEqual(topicProgress(topic, flashcardStats), { studied: 2, mastered: 2, total: 4 });
});

test("topicProgress returns all-zero counts for an untouched topic", () => {
  const topic = makeTopic("t", ["一", "二", "三"]);
  assert.deepEqual(topicProgress(topic, {}), { studied: 0, mastered: 0, total: 3 });
});

// ─── dueCards ─────────────────────────────────────────────────────────────────

test("dueCards returns only due words, sorted oldest-due first", () => {
  const now = new Date("2026-07-02T00:00:00.000Z");
  const topics = [makeTopic("a", ["好", "坏"], "Topic A"), makeTopic("b", ["空"], "Topic B")];
  const flashcardStats = {
    // Due yesterday → included, and oldest so it sorts first.
    "a:好": { intervalDays: 2, ease: 2.5, dueAt: "2026-07-01T00:00:00.000Z", reviewCount: 1 },
    // Due in the future → excluded.
    "a:坏": { intervalDays: 4, ease: 2.5, dueAt: "2026-07-10T00:00:00.000Z", reviewCount: 1 },
    // Due exactly at `now` → included (boundary is inclusive).
    "b:空": { intervalDays: 3, ease: 2.5, dueAt: "2026-07-02T00:00:00.000Z", reviewCount: 1 },
  };
  const cards = dueCards(topics, flashcardStats, now);
  assert.deepEqual(cards.map((c) => c.key), ["a:好", "b:空"]);
  assert.deepEqual(cards[0], {
    topicSlug: "a",
    topicTitle: "Topic A",
    hanzi: "好",
    pinyin: "好-pinyin",
    english: "好-english",
    key: "a:好",
    dueAt: "2026-07-01T00:00:00.000Z",
    intervalDays: 2,
  });
});

test("dueCards ignores words with no flashcard stat and returns [] when none are due", () => {
  const now = new Date("2026-07-02T00:00:00.000Z");
  const topics = [makeTopic("a", ["好", "坏"])];
  // Only one word tracked, and it is not yet due.
  const flashcardStats = {
    "a:好": { intervalDays: 4, ease: 2.5, dueAt: "2026-08-01T00:00:00.000Z", reviewCount: 1 },
  };
  assert.deepEqual(dueCards(topics, flashcardStats, now), []);
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

  const hard = scheduleReview(base, "hard", now);
  assert.equal(hard.intervalDays, 1);
  assert.equal(hard.ease, 2.35); // 2.5 - 0.15

  const good = scheduleReview(base, "good", now);
  assert.equal(good.intervalDays, 2);
  assert.equal(good.ease, 2.5); // "good" leaves ease unchanged

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

test("scheduleReview clamps ease to the EASE_CEIL upper bound", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  let stat = { intervalDays: 10, ease: 2.95, dueAt: now.toISOString(), reviewCount: 4 };
  stat = scheduleReview(stat, "easy", now); // 2.95 + 0.15 = 3.1 -> capped at 3.0
  assert.equal(stat.ease, EASE_CEIL);
  stat = scheduleReview(stat, "easy", now); // stays at ceiling
  assert.equal(stat.ease, EASE_CEIL);
});

test("scheduleReview grows intervals deterministically and normalizes bad input", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  // easy triples the interval each time (min 4): 4 -> 12 -> 36.
  const first = scheduleReview(defaultStat(now), "easy", now);
  assert.equal(first.intervalDays, 4);
  const second = scheduleReview(first, "easy", now);
  assert.equal(second.intervalDays, 12);
  assert.equal(second.dueAt, new Date("2026-07-13T00:00:00.000Z").toISOString());

  // A corrupt existing stat is normalized before scheduling, never throwing.
  const fromGarbage = scheduleReview({ intervalDays: -2, ease: 99, reviewCount: -1 }, "good", now);
  assert.equal(fromGarbage.intervalDays, 2); // interval floored to 0 then doubled -> 2
  assert.equal(fromGarbage.ease, EASE_CEIL); // 99 clamped to 3.0, "good" adds 0
  assert.equal(fromGarbage.reviewCount, 1); // -1 repaired to 0 then incremented
});
