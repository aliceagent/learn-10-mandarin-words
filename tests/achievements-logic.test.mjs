import test from "node:test";
import assert from "node:assert/strict";

import {
  longestStreak,
  bestQuizTopicProgress,
  computeAchievements,
} from "../src/lib/achievements-logic.ts";
import { emptyProgress, normalizeProgress } from "../src/lib/progress-logic.ts";

// Minimal Topic fixtures. Achievements read only slug / items (hanzi) /
// categorySlug, so those are the only fields present. wordKey is `slug:hanzi`.
function makeTopic(slug, hanziList, categorySlug = "cat-a") {
  return {
    slug,
    categorySlug,
    items: hanziList.map((hanzi) => ({
      hanzi,
      pinyin: `${hanzi}-pinyin`,
      english: `${hanzi}-english`,
    })),
  };
}

const TEN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

// Two ten-word topics in different categories, matching the real dataset shape
// (10 words per topic) so "perfect topic" targets read as 10.
const alpha = makeTopic("alpha", TEN, "cat-a");
const beta = makeTopic("beta", TEN, "cat-b");
const TOPICS = [alpha, beta];

// Convenience: fetch a badge by id from a computed shelf.
function badge(achievements, id) {
  const found = achievements.find((a) => a.id === id);
  assert.ok(found, `badge ${id} should exist`);
  return found;
}

// Build a quizStats map making the first `perfect` words of `topic` flawless.
function perfectWords(topic, perfect) {
  const stats = {};
  topic.items.slice(0, perfect).forEach((item) => {
    stats[`${topic.slug}:${item.hanzi}`] = { correct: 3, attempts: 3 };
  });
  return stats;
}

test("computeAchievements: empty progress → all 10 badges locked with zero progress and correct targets", () => {
  const achievements = computeAchievements(emptyProgress, TOPICS);
  assert.equal(achievements.length, 10);
  for (const a of achievements) {
    assert.equal(a.unlocked, false, `${a.id} should be locked`);
    assert.equal(a.progress.current, 0, `${a.id} current should be 0`);
  }
  const targets = Object.fromEntries(achievements.map((a) => [a.id, a.progress.target]));
  assert.deepEqual(targets, {
    "first-topic": 1,
    "topic-collector": 10,
    "streak-3": 3,
    "streak-7": 7,
    "first-review": 1,
    "century-club": 100,
    "perfect-topic": 10, // best topic's total word count
    "first-mastery": 1,
    "word-collector": 10,
    "explorer": 5,
  });
});

test("longestStreak: empty and single-day inputs", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-06-01"]), 1);
});

test("longestStreak: best-ever run survives a lapse; unsorted + duplicate input handled", () => {
  // Current streak here is 0 (nothing recent), but the historical run of
  // 2026-06-10..16 is 7 days long, so a "7-day streak" badge must still unlock.
  const dates = [
    "2026-06-16",
    "2026-06-01",
    "2026-06-02",
    "2026-06-14",
    "2026-06-10",
    "2026-06-03",
    "2026-06-11",
    "2026-06-12",
    "2026-06-13",
    "2026-06-15",
    "2026-06-13", // duplicate
  ];
  assert.equal(longestStreak(dates), 7);

  const streak7 = badge(
    computeAchievements({ ...emptyProgress, studiedDates: dates }, TOPICS),
    "streak-7",
  );
  assert.equal(streak7.unlocked, true);
});

test("century-club: locked at 99, clamped bar; unlocked at 100; over-target clamps to target", () => {
  const at99 = badge(
    computeAchievements(
      { ...emptyProgress, flashcardStats: { "alpha:一": mkStat(99) } },
      TOPICS,
    ),
    "century-club",
  );
  assert.equal(at99.unlocked, false);
  assert.deepEqual(at99.progress, { current: 99, target: 100 });

  const at100 = badge(
    computeAchievements(
      { ...emptyProgress, flashcardStats: { "alpha:一": mkStat(100) } },
      TOPICS,
    ),
    "century-club",
  );
  assert.equal(at100.unlocked, true);

  const at250 = badge(
    computeAchievements(
      { ...emptyProgress, flashcardStats: { "alpha:一": mkStat(250) } },
      TOPICS,
    ),
    "century-club",
  );
  assert.equal(at250.unlocked, true);
  assert.equal(at250.progress.current, 100); // clamped to target
});

// A flashcard stat with a given reviewCount (interval below mastery unless set).
function mkStat(reviewCount, intervalDays = 0) {
  return { intervalDays, ease: 2.5, dueAt: "2026-06-01T00:00:00.000Z", reviewCount };
}

test("first-review: unlocks on the very first graded review", () => {
  const shelf = computeAchievements(
    { ...emptyProgress, flashcardStats: { "alpha:一": mkStat(1) } },
    TOPICS,
  );
  assert.equal(badge(shelf, "first-review").unlocked, true);
});

test("perfect-topic: 9/10 locked, 10/10 unlocked (bestQuizTopicProgress)", () => {
  const p9 = bestQuizTopicProgress(TOPICS, perfectWords(alpha, 9));
  assert.deepEqual(p9, { perfectWords: 9, topicTotal: 10 });
  const locked = badge(
    computeAchievements({ ...emptyProgress, quizStats: perfectWords(alpha, 9) }, TOPICS),
    "perfect-topic",
  );
  assert.equal(locked.unlocked, false);
  assert.deepEqual(locked.progress, { current: 9, target: 10 });

  const p10 = bestQuizTopicProgress(TOPICS, perfectWords(alpha, 10));
  assert.deepEqual(p10, { perfectWords: 10, topicTotal: 10 });
  const unlocked = badge(
    computeAchievements({ ...emptyProgress, quizStats: perfectWords(alpha, 10) }, TOPICS),
    "perfect-topic",
  );
  assert.equal(unlocked.unlocked, true);
});

test("perfect-topic: a miss blocks one topic while another fully-perfect topic still unlocks", () => {
  const quizStats = {
    // alpha: 9 perfect + 1 miss → perfectWords 9, capped below perfect.
    ...perfectWords(alpha, 9),
    "alpha:十": { correct: 2, attempts: 3 }, // a recorded miss
    // beta: all 10 perfect → unlocks regardless of alpha.
    ...perfectWords(beta, 10),
  };
  const best = bestQuizTopicProgress(TOPICS, quizStats);
  assert.deepEqual(best, { perfectWords: 10, topicTotal: 10 });
  assert.equal(
    badge(computeAchievements({ ...emptyProgress, quizStats }, TOPICS), "perfect-topic").unlocked,
    true,
  );
});

test("perfect-topic: corrupt quiz stats do not throw and are treated safely", () => {
  const quizStats = {
    "alpha:一": { correct: -5, attempts: Number.NaN },
    "alpha:二": "junk",
    "alpha:三": null,
  };
  assert.doesNotThrow(() => bestQuizTopicProgress(TOPICS, quizStats));
  const best = bestQuizTopicProgress(TOPICS, quizStats);
  // None of the corrupt entries count as perfect (normalizeQuizStat → 0/0).
  assert.equal(best.perfectWords, 0);
  const shelf = computeAchievements({ ...emptyProgress, quizStats }, TOPICS);
  assert.equal(badge(shelf, "perfect-topic").unlocked, false);
});

test("first-mastery: boundary at MASTERED_INTERVAL_DAYS (7 unlocks, 6 does not)", () => {
  const at7 = computeAchievements(
    { ...emptyProgress, flashcardStats: { "alpha:一": mkStat(1, 7) } },
    TOPICS,
  );
  assert.equal(badge(at7, "first-mastery").unlocked, true);

  const at6 = computeAchievements(
    { ...emptyProgress, flashcardStats: { "alpha:一": mkStat(1, 6) } },
    TOPICS,
  );
  assert.equal(badge(at6, "first-mastery").unlocked, false);
});

test("explorer: 4 categories locked, 5 unlocked; unknown learned slugs ignored", () => {
  const topics = [
    makeTopic("t1", TEN, "cat-1"),
    makeTopic("t2", TEN, "cat-2"),
    makeTopic("t3", TEN, "cat-3"),
    makeTopic("t4", TEN, "cat-4"),
    makeTopic("t5", TEN, "cat-5"),
  ];
  const four = badge(
    computeAchievements(
      { ...emptyProgress, learnedTopics: ["t1", "t2", "t3", "t4", "ghost"] },
      topics,
    ),
    "explorer",
  );
  assert.equal(four.unlocked, false);
  assert.deepEqual(four.progress, { current: 4, target: 5 });

  const five = badge(
    computeAchievements(
      { ...emptyProgress, learnedTopics: ["t1", "t2", "t3", "t4", "t5"] },
      topics,
    ),
    "explorer",
  );
  assert.equal(five.unlocked, true);
});

test("first-topic and topic-collector track learnedTopics count", () => {
  const one = computeAchievements({ ...emptyProgress, learnedTopics: ["alpha"] }, TOPICS);
  assert.equal(badge(one, "first-topic").unlocked, true);
  assert.equal(badge(one, "topic-collector").unlocked, false);
  assert.deepEqual(badge(one, "topic-collector").progress, { current: 1, target: 10 });
});

test("word-collector unlocks at 10 favorite words", () => {
  const nine = computeAchievements(
    { ...emptyProgress, favoriteWords: Array.from({ length: 9 }, (_, i) => `alpha:${i}`) },
    TOPICS,
  );
  assert.equal(badge(nine, "word-collector").unlocked, false);
  assert.deepEqual(badge(nine, "word-collector").progress, { current: 9, target: 10 });

  const ten = computeAchievements(
    { ...emptyProgress, favoriteWords: Array.from({ length: 10 }, (_, i) => `alpha:${i}`) },
    TOPICS,
  );
  assert.equal(badge(ten, "word-collector").unlocked, true);
});

test("computeAchievements: legacy/corrupt progress normalized first derives without throwing", () => {
  // A schema-v2-shaped object missing quizStats/dailyActivity/dailyChallenge,
  // plus an outright corrupt flashcardStats value.
  const legacy = {
    schemaVersion: 2,
    learnedTopics: ["alpha"],
    flashcardStats: "junk",
  };
  const normalized = normalizeProgress(legacy, new Date("2026-07-01T00:00:00.000Z"));
  assert.doesNotThrow(() => computeAchievements(normalized, TOPICS));
  const shelf = computeAchievements(normalized, TOPICS);
  assert.equal(shelf.length, 10);
  assert.equal(badge(shelf, "first-topic").unlocked, true);
});
