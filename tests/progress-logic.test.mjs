import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_PROGRESS_SCHEMA_VERSION,
  DAILY_ACTIVITY_RETENTION_DAYS,
  DAILY_CHALLENGE_RETENTION_DAYS,
  EASE_CEIL,
  EASE_FLOOR,
  challengeStreak,
  computeStreak,
  computeWeakWords,
  defaultStat,
  dueCards,
  emptyProgress,
  formatIntervalDays,
  goalProgress,
  isCrowned,
  isLeech,
  LEECH_LAPSE_THRESHOLD,
  leechCards,
  longestStreak,
  MASTERED_INTERVAL_DAYS,
  masterySummary,
  normalizeBossStat,
  normalizeBossStats,
  normalizeProgress,
  normalizeQuizStat,
  normalizeStat,
  practicedCountOn,
  previewIntervals,
  recordBossResult,
  recordDailyChallenge,
  recordDailyPractice,
  recordLastActivity,
  scheduleReview,
  streakAtRisk,
  topicProgress,
  topicWordStatuses,
  updateQuizStats,
  uniqueToggle,
  wordStatus,
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

// ── lastActivity (schema v12) ────────────────────────────────────────────────

test("normalizeProgress({}) is at schema v12 with lastActivity: null", () => {
  const p = normalizeProgress({});
  assert.equal(p.schemaVersion, 12);
  assert.equal(CURRENT_PROGRESS_SCHEMA_VERSION, 12);
  assert.equal(p.lastActivity, null);
});

test("a legacy v11 save without lastActivity migrates to null, losing nothing else", () => {
  const legacy = {
    schemaVersion: 11, // pre-lastActivity save
    learnedTopics: ["ten-types-of-pets"],
    recentTopics: ["ten-types-of-pets", "ten-types-of-drinks"],
    studiedDates: ["2026-06-30"],
    // No lastActivity field at all.
  };
  const p = normalizeProgress(legacy);
  assert.equal(p.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION);
  assert.equal(p.lastActivity, null); // backfilled, lossless
  assert.deepEqual(p.learnedTopics, legacy.learnedTopics);
  assert.deepEqual(p.recentTopics, legacy.recentTopics);
  assert.deepEqual(p.studiedDates, legacy.studiedDates);
});

test("normalizeProgress passes a valid lastActivity through, keeping its quizMode", () => {
  const p = normalizeProgress({
    lastActivity: {
      topicSlug: "ten-types-of-drinks",
      mode: "quiz",
      quizMode: "english-hanzi",
      updatedAt: "2026-07-06T10:00:00.000Z",
    },
  });
  assert.deepEqual(p.lastActivity, {
    topicSlug: "ten-types-of-drinks",
    mode: "quiz",
    quizMode: "english-hanzi",
    updatedAt: "2026-07-06T10:00:00.000Z",
  });
});

test("normalizeProgress drops a quizMode when the mode is not quiz", () => {
  const p = normalizeProgress({
    lastActivity: {
      topicSlug: "ten-types-of-drinks",
      mode: "flashcards",
      quizMode: "english-hanzi", // stray sub-mode on a non-quiz mode
      updatedAt: "2026-07-06T10:00:00.000Z",
    },
  });
  assert.deepEqual(p.lastActivity, {
    topicSlug: "ten-types-of-drinks",
    mode: "flashcards",
    updatedAt: "2026-07-06T10:00:00.000Z",
  });
});

test("normalizeProgress repairs a corrupt lastActivity to null (never throws)", () => {
  // Bad mode id.
  assert.equal(
    normalizeProgress({
      lastActivity: { topicSlug: "x", mode: "nope", updatedAt: "2026-07-06T10:00:00.000Z" },
    }).lastActivity,
    null,
  );
  // Bad ISO timestamp.
  assert.equal(
    normalizeProgress({
      lastActivity: { topicSlug: "x", mode: "words", updatedAt: "not-a-date" },
    }).lastActivity,
    null,
  );
  // Missing / empty slug.
  assert.equal(
    normalizeProgress({
      lastActivity: { topicSlug: "", mode: "words", updatedAt: "2026-07-06T10:00:00.000Z" },
    }).lastActivity,
    null,
  );
  // Wholly wrong types never throw.
  assert.equal(normalizeProgress({ lastActivity: "nope" }).lastActivity, null);
  assert.equal(normalizeProgress({ lastActivity: 42 }).lastActivity, null);
});

test("recordLastActivity returns the SAME reference when nothing meaningful changed", () => {
  const now = new Date("2026-07-06T10:00:00.000Z");
  const prev = recordLastActivity(null, { slug: "a", mode: "quiz", quizMode: "english-hanzi" }, now);
  // Same slug + mode + quizMode → loop-free no-op (identical reference).
  const same = recordLastActivity(
    prev,
    { slug: "a", mode: "quiz", quizMode: "english-hanzi" },
    new Date("2026-07-06T11:00:00.000Z"),
  );
  assert.equal(same, prev);
});

test("recordLastActivity ignores quizMode differences outside quiz mode (no-op)", () => {
  const now = new Date("2026-07-06T10:00:00.000Z");
  const prev = recordLastActivity(null, { slug: "a", mode: "words" }, now);
  const same = recordLastActivity(
    prev,
    { slug: "a", mode: "words", quizMode: "english-hanzi" }, // stray quizMode dropped
    new Date("2026-07-06T11:00:00.000Z"),
  );
  assert.equal(same, prev);
  assert.equal(prev.quizMode, undefined);
});

test("recordLastActivity returns a NEW object with a fresh timestamp when the mode changes", () => {
  const t1 = new Date("2026-07-06T10:00:00.000Z");
  const t2 = new Date("2026-07-06T12:30:00.000Z");
  const prev = recordLastActivity(null, { slug: "a", mode: "words" }, t1);
  const next = recordLastActivity(prev, { slug: "a", mode: "flashcards" }, t2);
  assert.notEqual(next, prev);
  assert.deepEqual(next, {
    topicSlug: "a",
    mode: "flashcards",
    updatedAt: "2026-07-06T12:30:00.000Z",
  });
});

test("recordLastActivity treats a slug change and a quiz sub-mode change as real changes", () => {
  const now = new Date("2026-07-06T10:00:00.000Z");
  const prev = recordLastActivity(null, { slug: "a", mode: "quiz", quizMode: "english-hanzi" }, now);
  // Different slug.
  assert.notEqual(recordLastActivity(prev, { slug: "b", mode: "quiz", quizMode: "english-hanzi" }, now), prev);
  // Different quiz sub-mode.
  const subChange = recordLastActivity(prev, { slug: "a", mode: "quiz", quizMode: "listening" }, now);
  assert.notEqual(subChange, prev);
  assert.equal(subChange.quizMode, "listening");
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
    lapses: 0, // pre-v8 stat lacks the lapse counter → backfilled to 0
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
    "a:好": { intervalDays: 2, ease: 2.5, dueAt: "2026-07-01T00:00:00.000Z", reviewCount: 1, lapses: 3 },
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
    lapses: 3, // carried through from the stat (drives the leech flag)
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

// ─── leech detection (schema v8) ────────────────────────────────────────────────

// A flashcard stat with the given lapse count and interval; the other fields are
// irrelevant to isLeech/leechCards so they take fixed defaults.
function makeLeechStat({ lapses, intervalDays = 1, dueAt = "2026-07-01T00:00:00.000Z" }) {
  return { intervalDays, ease: 2.5, dueAt, reviewCount: lapses, lapses };
}

test("isLeech flags a word only at/above the lapse threshold and below mastery", () => {
  // Below the threshold → not a leech, however low the interval.
  assert.equal(isLeech(makeLeechStat({ lapses: LEECH_LAPSE_THRESHOLD - 1 })), false);
  // At the threshold with a sub-mastery interval → a leech.
  assert.equal(isLeech(makeLeechStat({ lapses: LEECH_LAPSE_THRESHOLD })), true);
  assert.equal(isLeech(makeLeechStat({ lapses: LEECH_LAPSE_THRESHOLD + 3 })), true);
  // Enough lapses, but the interval has reached mastery → graduated, not a leech.
  assert.equal(
    isLeech(makeLeechStat({ lapses: LEECH_LAPSE_THRESHOLD, intervalDays: MASTERED_INTERVAL_DAYS })),
    false,
  );
});

test("isLeech tolerates undefined and legacy stats missing the lapse counter", () => {
  assert.equal(isLeech(undefined), false);
  // Pre-v8 stat with no `lapses` field normalizes to 0 lapses → never a leech.
  assert.equal(isLeech({ intervalDays: 1, ease: 2.5, dueAt: "2026-07-01T00:00:00.000Z", reviewCount: 9 }), false);
});

test("leechCards returns flagged words most-lapsed first, ignoring the due date", () => {
  const topics = [makeTopic("a", ["好", "坏", "妙"], "Topic A"), makeTopic("b", ["空"], "Topic B")];
  const flashcardStats = {
    // Flagged: 4 lapses, sub-mastery — and due far in the future, yet still listed.
    "a:好": makeLeechStat({ lapses: 4, intervalDays: 1, dueAt: "2030-01-01T00:00:00.000Z" }),
    // Not flagged: below threshold.
    "a:坏": makeLeechStat({ lapses: 2 }),
    // Flagged, more lapses → sorts before 好.
    "a:妙": makeLeechStat({ lapses: 6, intervalDays: 2, dueAt: "2026-06-01T00:00:00.000Z" }),
    // Not flagged: enough lapses but already mastered.
    "b:空": makeLeechStat({ lapses: 5, intervalDays: MASTERED_INTERVAL_DAYS }),
  };
  const cards = leechCards(topics, flashcardStats);
  assert.deepEqual(cards.map((c) => c.key), ["a:妙", "a:好"]);
  assert.equal(cards[0].lapses, 6);
  assert.equal(cards[0].topicTitle, "Topic A");
});

test("leechCards is [] when no word has lapsed enough", () => {
  const topics = [makeTopic("a", ["好", "坏"])];
  const flashcardStats = {
    "a:好": makeLeechStat({ lapses: LEECH_LAPSE_THRESHOLD - 1 }),
  };
  assert.deepEqual(leechCards(topics, flashcardStats), []);
});

test("scheduleReview increments lapses only on an 'again' grade", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const start = makeLeechStat({ lapses: 2, intervalDays: 3 });
  assert.equal(scheduleReview(start, "again", now).lapses, 3);
  assert.equal(scheduleReview(start, "hard", now).lapses, 2);
  assert.equal(scheduleReview(start, "good", now).lapses, 2);
  assert.equal(scheduleReview(start, "easy", now).lapses, 2);
  // A brand-new card's first 'again' records the first lapse.
  assert.equal(scheduleReview(defaultStat(now), "again", now).lapses, 1);
});

test("defaultStat starts with a zero lapse counter", () => {
  assert.equal(defaultStat(new Date("2026-07-01T00:00:00.000Z")).lapses, 0);
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

test("previewIntervals matches a brand-new card's per-grade intervals", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  assert.deepEqual(previewIntervals(undefined, now), { again: 1, hard: 1, good: 2, easy: 4 });
});

test("previewIntervals projects intervals from an existing card without mutating it", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const existing = { intervalDays: 10, ease: 2.5, dueAt: now.toISOString(), reviewCount: 3 };
  const before = { ...existing };
  assert.deepEqual(previewIntervals(existing, now), { again: 1, hard: 11, good: 20, easy: 30 });
  // The input stat is never mutated by the preview.
  assert.deepEqual(existing, before);
});

test("previewIntervals equals scheduleReview's actual interval for each grade", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const existing = { intervalDays: 6, ease: 2.4, dueAt: now.toISOString(), reviewCount: 2 };
  const preview = previewIntervals(existing, now);
  for (const grade of ["again", "hard", "good", "easy"]) {
    assert.equal(preview[grade], scheduleReview(existing, grade, now).intervalDays);
  }
});

test("formatIntervalDays renders days, weeks, and months at the boundaries", () => {
  assert.equal(formatIntervalDays(1), "1d");
  assert.equal(formatIntervalDays(6), "6d");
  assert.equal(formatIntervalDays(7), "1w");
  assert.equal(formatIntervalDays(13), "2w");
  assert.equal(formatIntervalDays(14), "2w");
  assert.equal(formatIntervalDays(59), "8w");
  assert.equal(formatIntervalDays(60), "2mo");
  assert.equal(formatIntervalDays(90), "3mo");
});

test("streakAtRisk is true only when a live streak has nothing logged today", () => {
  const today = "2026-07-01";
  // Studied yesterday only: streak alive, today empty -> at risk.
  assert.equal(streakAtRisk(["2026-06-30"], today), true);
  // Today already studied -> not at risk.
  assert.equal(streakAtRisk(["2026-06-30", "2026-07-01"], today), false);
  // No streak at all -> not at risk.
  assert.equal(streakAtRisk([], today), false);
  // Dead streak (latest day older than yesterday) -> not at risk.
  assert.equal(streakAtRisk(["2026-06-28", "2026-06-29"], today), false);
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

// ─── dailyActivity: migration, normalization, pruning, goal progress (schema v4) ─

test("normalizeProgress migrates a v3 save to v4 and backfills empty dailyActivity", () => {
  const v3 = {
    schemaVersion: 3, // pre-dailyActivity save
    learnedTopics: ["ten-types-of-pets"],
    favoriteTopics: [],
    favoriteWords: ["ten-types-of-pets:狗"],
    flashcardStats: {},
    quizStats: { "ten-types-of-pets:狗": { correct: 2, attempts: 3 } },
    studiedDates: ["2026-06-30"],
    onboarding: { completed: true, dailyGoal: 10, completedAt: "2026-06-30" },
  };
  const p = normalizeProgress(v3);
  assert.equal(p.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION); // 4
  assert.deepEqual(p.dailyActivity, {}); // backfilled, lossless
  // Everything the v3 save carried is preserved untouched.
  assert.deepEqual(p.learnedTopics, v3.learnedTopics);
  assert.deepEqual(p.favoriteWords, v3.favoriteWords);
  assert.deepEqual(p.quizStats, v3.quizStats);
  assert.deepEqual(p.studiedDates, v3.studiedDates);
  assert.deepEqual(p.onboarding, v3.onboarding);
});

test("normalizeProgress sanitizes corrupt dailyActivity shapes without throwing", () => {
  // The whole field is a number, not a map → empty map.
  assert.deepEqual(normalizeProgress({ dailyActivity: 42 }).dailyActivity, {});

  const p = normalizeProgress({
    dailyActivity: {
      "2026-07-01": ["t:好", "t:坏"], // valid, passes through
      "2026-07-02": "t:空", // a day mapped to a bare string → dropped
      "2026-07-03": ["t:半", 7, null], // a day array holding non-strings → members filtered
      "not-a-day": ["t:x"], // invalid day key → dropped
      "2026-13-40": ["t:y"], // impossible date → dropped
    },
  });
  assert.deepEqual(new Set(Object.keys(p.dailyActivity)), new Set(["2026-07-01", "2026-07-03"]));
  assert.deepEqual(p.dailyActivity["2026-07-01"], ["t:好", "t:坏"]);
  assert.deepEqual(p.dailyActivity["2026-07-03"], ["t:半"]); // non-string members removed
});

test("normalizeProgress prunes dailyActivity to the newest retention window", () => {
  const activity = {};
  for (let d = 1; d <= 16; d++) {
    const day = `2026-07-${String(d).padStart(2, "0")}`;
    activity[day] = [`t:${d}`];
  }
  const p = normalizeProgress({ dailyActivity: activity });
  const days = Object.keys(p.dailyActivity).sort();
  assert.equal(days.length, DAILY_ACTIVITY_RETENTION_DAYS); // 14
  assert.equal(days[0], "2026-07-03"); // oldest two (07-01, 07-02) dropped
  assert.equal(days[days.length - 1], "2026-07-16");
});

test("recordDailyPractice: same-day dedup, new-day creation, and purity", () => {
  const start = {};
  const day1 = recordDailyPractice(start, "t:狗", "2026-07-01");
  assert.deepEqual(day1, { "2026-07-01": ["t:狗"] });
  assert.deepEqual(start, {}); // input untouched (pure)

  // Re-practicing the same word the same day does not grow the list.
  const again = recordDailyPractice(day1, "t:狗", "2026-07-01");
  assert.deepEqual(again["2026-07-01"], ["t:狗"]);

  // A distinct word the same day appends.
  const more = recordDailyPractice(again, "t:猫", "2026-07-01");
  assert.deepEqual(more["2026-07-01"], ["t:狗", "t:猫"]);

  // A new day creates a new key without touching the old one.
  const day2 = recordDailyPractice(more, "t:鸟", "2026-07-02");
  assert.deepEqual(day2["2026-07-01"], ["t:狗", "t:猫"]);
  assert.deepEqual(day2["2026-07-02"], ["t:鸟"]);
  assert.deepEqual(more["2026-07-02"], undefined); // previous map untouched
});

test("recordDailyPractice prunes to the newest retention window on write", () => {
  let activity = {};
  // Fill 14 days, then write two more distinct days: the oldest two drop.
  for (let d = 1; d <= 16; d++) {
    const day = `2026-07-${String(d).padStart(2, "0")}`;
    activity = recordDailyPractice(activity, `t:${d}`, day);
  }
  const days = Object.keys(activity).sort();
  assert.equal(days.length, DAILY_ACTIVITY_RETENTION_DAYS); // 14
  assert.equal(days[0], "2026-07-03"); // 07-01 and 07-02 pruned
  assert.equal(days[days.length - 1], "2026-07-16");
});

test("practicedCountOn returns distinct-word counts, 0 when absent", () => {
  const activity = { "2026-07-01": ["t:狗", "t:猫"] };
  assert.equal(practicedCountOn(activity, "2026-07-01"), 2);
  assert.equal(practicedCountOn(activity, "2026-07-02"), 0);
  assert.equal(practicedCountOn(undefined, "2026-07-01"), 0);
});

test("goalProgress reports practiced/goal/met including goal:0 and the exact boundary", () => {
  const base = { ...emptyProgress, dailyActivity: { "2026-07-01": ["t:a", "t:b", "t:c"] } };

  // goal 0 (unset): met stays false regardless of practice.
  const unset = goalProgress({ ...base, onboarding: { ...base.onboarding, dailyGoal: 0 } }, "2026-07-01");
  assert.deepEqual(unset, { practiced: 3, goal: 0, met: false });

  // Below goal.
  const below = goalProgress({ ...base, onboarding: { ...base.onboarding, dailyGoal: 5 } }, "2026-07-01");
  assert.deepEqual(below, { practiced: 3, goal: 5, met: false });

  // Exactly at goal → met.
  const exact = goalProgress({ ...base, onboarding: { ...base.onboarding, dailyGoal: 3 } }, "2026-07-01");
  assert.deepEqual(exact, { practiced: 3, goal: 3, met: true });

  // Over goal → still met.
  const over = goalProgress({ ...base, onboarding: { ...base.onboarding, dailyGoal: 2 } }, "2026-07-01");
  assert.deepEqual(over, { practiced: 3, goal: 2, met: true });

  // A day with no activity reads 0 practiced.
  const empty = goalProgress({ ...base, onboarding: { ...base.onboarding, dailyGoal: 3 } }, "2026-07-09");
  assert.deepEqual(empty, { practiced: 0, goal: 3, met: false });
});

test("normalizeProgress round-trips dailyActivity through serialization", () => {
  const state = {
    ...emptyProgress,
    dailyActivity: {
      "2026-07-01": ["ten-types-of-pets:狗", "ten-types-of-pets:猫"],
      "2026-07-02": ["ten-types-of-drinks:茶"],
    },
  };
  const roundTripped = normalizeProgress(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(roundTripped.dailyActivity, state.dailyActivity);
});

// ─── Sprint 10: word / topic mastery status ────────────────────────────────────

// Build a flashcard stat with a given interval / reviewCount; other fields are
// irrelevant to wordStatus but kept well-formed.
function makeStat({ intervalDays = 0, reviewCount = 0 } = {}) {
  return { intervalDays, ease: 2.5, dueAt: "2026-07-01T00:00:00.000Z", reviewCount };
}

test("wordStatus: new when there is no flashcard or quiz activity", () => {
  assert.equal(wordStatus(undefined, undefined), "new");
  // A stat that exists but has never been reviewed and no quiz attempts is new.
  assert.equal(wordStatus(makeStat({ intervalDays: 0, reviewCount: 0 }), { correct: 0, attempts: 0 }), "new");
});

test("wordStatus: learning from a graded card or any quiz attempt", () => {
  assert.equal(wordStatus(makeStat({ intervalDays: 2, reviewCount: 1 }), undefined), "learning");
  assert.equal(wordStatus(undefined, { correct: 1, attempts: 1 }), "learning");
});

test("wordStatus: mastered once the interval reaches the threshold", () => {
  assert.equal(wordStatus(makeStat({ intervalDays: 7, reviewCount: 3 }), undefined), "mastered");
  // Just under the threshold is not mastered.
  assert.equal(wordStatus(makeStat({ intervalDays: 6, reviewCount: 3 }), undefined), "learning");
});

test("wordStatus: tricky when quizzed enough and mostly wrong", () => {
  // 1/4 correct over 4 attempts → 25% < 50% with attempts >= 3 → tricky.
  assert.equal(wordStatus(undefined, { correct: 1, attempts: 4 }), "tricky");
  // Not enough attempts (2 < 3) → falls back to learning, not tricky.
  assert.equal(wordStatus(undefined, { correct: 0, attempts: 2 }), "learning");
  // Exactly 50% is not below the max-accuracy cutoff → learning, not tricky.
  assert.equal(wordStatus(undefined, { correct: 2, attempts: 4 }), "learning");
});

test("wordStatus: precedence mastered > tricky > learning > new", () => {
  // mastered + tricky → mastered (the SRS interval is the stronger signal).
  assert.equal(
    wordStatus(makeStat({ intervalDays: 10, reviewCount: 5 }), { correct: 0, attempts: 5 }),
    "mastered",
  );
  // tricky + learning → tricky (quiz attempts also satisfy learning, tricky wins).
  assert.equal(
    wordStatus(makeStat({ intervalDays: 1, reviewCount: 1 }), { correct: 0, attempts: 3 }),
    "tricky",
  );
});

test("wordStatus: tolerates corrupt inputs without throwing", () => {
  assert.equal(wordStatus({}, {}), "new");
  assert.equal(wordStatus({ intervalDays: "oops", reviewCount: null }, { correct: "x", attempts: -2 }), "new");
  // A corrupt stat with a valid mastery interval still resolves to mastered.
  assert.equal(wordStatus({ intervalDays: 30 }, undefined), "mastered");
});

test("topicWordStatuses returns statuses in topic.items order", () => {
  const topic = makeTopic("t", ["好", "坏", "空", "半"]);
  const flashcardStats = {
    "t:好": makeStat({ intervalDays: 7, reviewCount: 3 }), // mastered
    "t:空": makeStat({ intervalDays: 2, reviewCount: 1 }), // learning
  };
  const quizStats = {
    "t:坏": { correct: 0, attempts: 4 }, // tricky
    // 半 has nothing → new
  };
  assert.deepEqual(topicWordStatuses(topic, flashcardStats, quizStats), [
    "mastered",
    "tricky",
    "learning",
    "new",
  ]);
});

test("masterySummary counts sum to the total across mixed topics", () => {
  const topics = [makeTopic("a", ["好", "坏", "空"]), makeTopic("b", ["半", "天"])];
  const flashcardStats = {
    "a:好": makeStat({ intervalDays: 7, reviewCount: 3 }), // mastered
    "a:空": makeStat({ intervalDays: 2, reviewCount: 1 }), // learning
  };
  const quizStats = {
    "a:坏": { correct: 0, attempts: 3 }, // tricky
    "b:天": { correct: 1, attempts: 1 }, // learning
    // b:半 → new
  };
  const summary = masterySummary(topics, flashcardStats, quizStats);
  assert.deepEqual(summary, { mastered: 1, learning: 2, tricky: 1, new: 1, total: 5 });
  assert.equal(summary.mastered + summary.learning + summary.tricky + summary.new, summary.total);
});

test("masterySummary on empty progress is all-new", () => {
  const topics = [makeTopic("a", ["好", "坏"]), makeTopic("b", ["空"])];
  const summary = masterySummary(topics, {}, {});
  assert.deepEqual(summary, { mastered: 0, learning: 0, tricky: 0, new: 3, total: 3 });
});

// ─── dailyChallenge: migration, normalization, first-wins, prune, streak (v5) ───

function challengeResult(day, score, total) {
  return { score, total, completedAt: `${day}T12:00:00.000Z` };
}

test("normalizeProgress migrates a v4 save to v5 and backfills empty dailyChallenge", () => {
  const v4 = {
    schemaVersion: 4, // pre-dailyChallenge save
    learnedTopics: ["ten-types-of-pets"],
    dailyActivity: { "2026-07-01": ["t:好"] },
  };
  const p = normalizeProgress(v4);
  assert.equal(p.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION); // 5
  assert.deepEqual(p.dailyChallenge, {}); // backfilled, lossless
  assert.deepEqual(p.learnedTopics, ["ten-types-of-pets"]); // nothing else lost
  assert.deepEqual(p.dailyActivity, { "2026-07-01": ["t:好"] });
});

test("normalizeProgress sanitizes corrupt dailyChallenge shapes without throwing", () => {
  assert.deepEqual(normalizeProgress({ dailyChallenge: 42 }).dailyChallenge, {});
  const p = normalizeProgress({
    dailyChallenge: {
      "2026-07-01": { score: 8, total: 10, completedAt: "2026-07-01T09:00:00.000Z" },
      "not-a-day": { score: 5, total: 10, completedAt: "x" }, // junk key → dropped
      "2026-07-02": "nope", // non-object → dropped
      "2026-07-03": { score: 99, total: 10 }, // score clamped to total; completedAt repaired
      "2026-07-04": { score: -3, total: -1 }, // negatives coerced to 0
    },
  });
  assert.deepEqual(new Set(Object.keys(p.dailyChallenge)), new Set(["2026-07-01", "2026-07-03", "2026-07-04"]));
  assert.deepEqual(p.dailyChallenge["2026-07-01"], { score: 8, total: 10, completedAt: "2026-07-01T09:00:00.000Z" });
  assert.equal(p.dailyChallenge["2026-07-03"].score, 10); // clamped to total
  assert.ok(Number.isFinite(new Date(p.dailyChallenge["2026-07-03"].completedAt).getTime())); // repaired ISO
  assert.deepEqual(p.dailyChallenge["2026-07-04"], { score: 0, total: 0, completedAt: p.dailyChallenge["2026-07-04"].completedAt });
});

test("normalizeProgress prunes dailyChallenge to the newest retention window", () => {
  const map = {};
  for (let i = 0; i < DAILY_CHALLENGE_RETENTION_DAYS + 10; i++) {
    const day = `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
    map[day] = challengeResult(day, 5, 10);
  }
  const p = normalizeProgress({ dailyChallenge: map });
  assert.equal(Object.keys(p.dailyChallenge).length, DAILY_CHALLENGE_RETENTION_DAYS);
});

test("recordDailyChallenge keeps the FIRST completion for a day and leaves input untouched", () => {
  const before = { "2026-07-05": challengeResult("2026-07-05", 6, 10) };
  const frozen = JSON.parse(JSON.stringify(before));
  const after = recordDailyChallenge(before, "2026-07-05", challengeResult("2026-07-05", 10, 10));
  assert.deepEqual(after["2026-07-05"], challengeResult("2026-07-05", 6, 10)); // first wins
  assert.deepEqual(before, frozen); // pure — input not mutated
  assert.notEqual(after, before); // returns a new object
});

test("recordDailyChallenge adds a new day and prunes past the retention window", () => {
  let map = {};
  for (let i = 0; i < DAILY_CHALLENGE_RETENTION_DAYS + 5; i++) {
    const day = `2025-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
    map = recordDailyChallenge(map, day, challengeResult(day, 7, 10));
  }
  assert.equal(Object.keys(map).length, DAILY_CHALLENGE_RETENTION_DAYS);
});

test("challengeStreak counts consecutive completed days ending today (mirrors computeStreak)", () => {
  const map = {
    "2026-07-03": challengeResult("2026-07-03", 8, 10),
    "2026-07-04": challengeResult("2026-07-04", 9, 10),
    "2026-07-05": challengeResult("2026-07-05", 10, 10),
  };
  assert.equal(challengeStreak(map, "2026-07-05"), 3);
  // Yesterday-anchored streaks still count (mirrors computeStreak): with today
  // 07-06 absent, 07-05 is yesterday and 07-04/07-03 chain back from it → 3.
  assert.equal(challengeStreak(map, "2026-07-06"), 3);
  assert.equal(challengeStreak({}, "2026-07-05"), 0);
});

test("longestStreak finds the longest consecutive run anywhere in history", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-07-05"]), 1);
  // A 4-day run in the past, a gap, then a 2-day run → 4.
  assert.equal(
    longestStreak([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-06-10",
      "2026-06-11",
    ]),
    4,
  );
  // Unsorted input and duplicates are handled.
  assert.equal(
    longestStreak(["2026-03-03", "2026-03-01", "2026-03-02", "2026-03-02"]),
    3,
  );
  // Unlike computeStreak, the best run can be entirely in the past: a 5-day run
  // long ago beats the 1-day "current" run.
  assert.equal(
    longestStreak([
      "2025-02-01",
      "2025-02-02",
      "2025-02-03",
      "2025-02-04",
      "2025-02-05",
      "2026-07-05",
    ]),
    5,
  );
  // Malformed entries are dropped without throwing.
  assert.equal(longestStreak(["junk", "2026-05-05", "2026-05-06"]), 2);
});

// ─── Boss Round (schema v7) ─────────────────────────────────────────────────

test("normalizeBossStat: repairs counts, caps bestScore, nulls a bad crownedAt", () => {
  assert.deepEqual(normalizeBossStat(undefined), { bestScore: 0, attempts: 0, crownedAt: null });
  assert.deepEqual(normalizeBossStat("junk"), { bestScore: 0, attempts: 0, crownedAt: null });
  // Negative / non-finite counts collapse to 0; a score above the stage count caps.
  assert.deepEqual(
    normalizeBossStat({ bestScore: 99, attempts: -2, crownedAt: "nope" }),
    { bestScore: 4, attempts: 0, crownedAt: null },
  );
  // Fractional counts round; a valid ISO crownedAt is kept.
  const iso = "2026-07-05T10:00:00.000Z";
  assert.deepEqual(
    normalizeBossStat({ bestScore: 2.6, attempts: 3.2, crownedAt: iso }),
    { bestScore: 3, attempts: 3, crownedAt: iso },
  );
});

test("normalizeBossStats: drops non-object entries, repairs the rest", () => {
  const out = normalizeBossStats({
    "a": { bestScore: 4, attempts: 1, crownedAt: "2026-07-05T00:00:00.000Z" },
    "b": null,
    "c": { bestScore: -1, attempts: "x" },
  });
  assert.equal(out.a.bestScore, 4);
  assert.deepEqual(out.b, { bestScore: 0, attempts: 0, crownedAt: null });
  assert.deepEqual(out.c, { bestScore: 0, attempts: 0, crownedAt: null });
  // Non-object input → empty map, never throws.
  assert.deepEqual(normalizeBossStats(null), {});
  assert.deepEqual(normalizeBossStats(42), {});
});

test("recordBossResult: first run sets attempts + bestScore, no crown below total", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const out = recordBossResult({}, "pets", 3, 4, now);
  assert.deepEqual(out.pets, { bestScore: 3, attempts: 1, crownedAt: null });
});

test("recordBossResult: a flawless run crowns with the injected timestamp", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const out = recordBossResult({}, "pets", 4, 4, now);
  assert.deepEqual(out.pets, { bestScore: 4, attempts: 1, crownedAt: now.toISOString() });
  assert.ok(isCrowned(out, "pets"));
});

test("recordBossResult: later worse runs keep the crown + bestScore, bump attempts", () => {
  const crownTime = new Date("2026-07-05T12:00:00.000Z");
  const crowned = recordBossResult({}, "pets", 4, 4, crownTime);
  // A later 2/4 run: attempts++ but crownedAt and bestScore are preserved.
  const later = recordBossResult(crowned, "pets", 2, 4, new Date("2026-07-06T09:00:00.000Z"));
  assert.equal(later.pets.attempts, 2);
  assert.equal(later.pets.bestScore, 4);
  assert.equal(later.pets.crownedAt, crownTime.toISOString());
});

test("recordBossResult: score is clamped into [0, total] and the input map is untouched", () => {
  const base = {};
  const out = recordBossResult(base, "pets", 9, 4, new Date("2026-07-05T00:00:00.000Z"));
  assert.equal(out.pets.bestScore, 4);
  assert.equal(out.pets.crownedAt !== null, true); // 9 clamps to 4 === total → crown
  assert.deepEqual(base, {}, "input map is not mutated");
});

test("isCrowned: true only once a crown date is on record", () => {
  assert.equal(isCrowned(undefined, "pets"), false);
  assert.equal(isCrowned({}, "pets"), false);
  assert.equal(isCrowned({ pets: { bestScore: 3, attempts: 5, crownedAt: null } }, "pets"), false);
  assert.equal(
    isCrowned({ pets: { bestScore: 4, attempts: 1, crownedAt: "2026-07-05T00:00:00.000Z" } }, "pets"),
    true,
  );
});

test("normalizeProgress: a v6 save (no bossStats) migrates to an empty map, v7 stamped", () => {
  const legacy = {
    schemaVersion: 6,
    learnedTopics: ["pets"],
    favoriteTopics: [],
    favoriteWords: [],
    flashcardStats: {},
    quizStats: {},
    dailyActivity: {},
    dailyChallenge: {},
    bestQuizCombo: 5,
    studiedDates: ["2026-07-05"],
    onboarding: { completed: true, dailyGoal: 10, completedAt: "2026-07-05" },
  };
  const migrated = normalizeProgress(legacy);
  assert.equal(migrated.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION);
  assert.deepEqual(migrated.bossStats, {});
  // Everything else survives the migration untouched.
  assert.deepEqual(migrated.learnedTopics, ["pets"]);
  assert.equal(migrated.bestQuizCombo, 5);
});

test("normalizeProgress: corrupt bossStats entries normalize safely and round-trip", () => {
  const dirty = {
    ...emptyProgress,
    bossStats: { pets: { bestScore: 99, attempts: -1, crownedAt: "junk" }, bad: null },
  };
  const once = normalizeProgress(dirty);
  assert.deepEqual(once.bossStats.pets, { bestScore: 4, attempts: 0, crownedAt: null });
  assert.deepEqual(once.bossStats.bad, { bestScore: 0, attempts: 0, crownedAt: null });
  // Idempotent: normalizing the cleaned state changes nothing.
  const twice = normalizeProgress(once);
  assert.deepEqual(twice.bossStats, once.bossStats);
});

test("emptyProgress carries a bossStats map at the current schema version", () => {
  assert.deepEqual(emptyProgress.bossStats, {});
  assert.equal(emptyProgress.schemaVersion, CURRENT_PROGRESS_SCHEMA_VERSION);
});
