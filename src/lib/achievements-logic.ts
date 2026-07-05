import type { ProgressState, QuizStat, TopicSummary } from "./types";
// Value imports need the explicit `.ts` extension so they resolve under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors progress-logic.ts.
import { wordKey } from "./data-logic.ts";
import { MASTERED_INTERVAL_DAYS, normalizeQuizStat, normalizeStat } from "./progress-logic.ts";

// Pure "Achievement shelf" derivation, mirroring progress-logic.ts: no React,
// DOM, or localStorage. Every badge below is computed purely from fields that
// already live in the persisted ProgressState — nothing new is stored, no schema
// bump. The learner earns these milestones invisibly through normal use; this
// module just makes them visible. Tolerant of legacy/corrupt saves via the
// normalize* helpers so the shelf can never crash the /stats page.

export type AchievementId =
  | "first-topic"
  | "topic-collector"
  | "streak-3"
  | "streak-7"
  | "first-review"
  | "century-club"
  | "perfect-topic"
  | "first-mastery"
  | "word-collector"
  | "explorer";

export type Achievement = {
  id: AchievementId;
  /** Rendered large; grayscaled when locked. */
  emoji: string;
  title: string;
  /** Locked state: what to do to earn it. */
  hint: string;
  /** Unlocked state: what was accomplished. */
  earned: string;
  unlocked: boolean;
  /** Progress toward unlock; `current` is always clamped to `[0, target]`. */
  progress: { current: number; target: number };
};

// Fixed clock for normalizing flashcard stats here: this module only reads
// `intervalDays` / `reviewCount` off each stat (never the `dueAt` default that a
// live clock would seed), so pinning it keeps the derivation pure and
// deterministic. Mirrors MASTERY_NORMALIZE_EPOCH in progress-logic.ts.
const NORMALIZE_EPOCH = new Date(0);

/**
 * Longest run of consecutive studied days anywhere in history. Unlike
 * `computeStreak`, this does NOT anchor on today, so a "7-day streak" badge never
 * vanishes once earned — `studiedDates` is the full, unpruned day history.
 * Dedupe + chronological sort of the ISO day strings, then scan for the longest
 * run where each day is exactly one day after the previous. Invalid entries are
 * skipped so a corrupt save can't throw.
 */
export function longestStreak(studiedDates: string[]): number {
  const days = Array.from(new Set(studiedDates))
    .filter((d) => Number.isFinite(new Date(d).getTime()))
    .sort();
  if (days.length === 0) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round(
      (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000,
    );
    if (diff === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else if (diff !== 0) {
      // A gap (diff > 1) breaks the run; diff === 0 is a same-day duplicate that
      // the string dedupe above already collapses, so it's a harmless no-op.
      run = 1;
    }
  }
  return longest;
}

/**
 * Best topic-quiz completeness across all topics: the count of perfectly-quizzed
 * words in the topic closest to a flawless quiz sweep, plus that topic's total
 * word count. A word is "perfect" once it has been quiz-answered at least once
 * with zero misses (`attempts >= 1 && correct === attempts`); a single recorded
 * miss on a word drops it (and caps its topic below perfect). Powers both the
 * `perfect-topic` unlock (perfectWords === topicTotal) and its locked progress
 * bar. Pure; corrupt quiz stats pass through `normalizeQuizStat` so they never
 * throw.
 */
export function bestQuizTopicProgress(
  topics: Pick<TopicSummary, "slug" | "items">[],
  quizStats: Record<string, QuizStat> | undefined,
): { perfectWords: number; topicTotal: number } {
  const stats = quizStats ?? {};
  // Default when there are no topics at all: an empty, unreachable target.
  let best = { perfectWords: 0, topicTotal: topics[0]?.items.length ?? 0 };
  for (const topic of topics) {
    let perfectWords = 0;
    for (const item of topic.items) {
      const stat = normalizeQuizStat(stats[wordKey(topic, item)]);
      if (stat.attempts >= 1 && stat.correct === stat.attempts) perfectWords += 1;
    }
    // Track the topic nearest to a perfect sweep. A fully-perfect topic
    // (perfectWords === items.length) always beats any partial one, so a later
    // perfect topic still unlocks even if an earlier topic has a miss.
    if (perfectWords > best.perfectWords) {
      best = { perfectWords, topicTotal: topic.items.length };
    }
  }
  return best;
}

// Assemble one badge, clamping `current` into `[0, target]` so a locked bar can
// never overflow and an over-target count still reads as "done".
function badge(
  id: AchievementId,
  emoji: string,
  title: string,
  hint: string,
  earned: string,
  current: number,
  target: number,
): Achievement {
  const clamped = Math.max(0, Math.min(current, target));
  return {
    id,
    emoji,
    title,
    hint,
    earned,
    unlocked: current >= target && target > 0,
    progress: { current: clamped, target },
  };
}

/**
 * Derive all ten shelf badges from the persisted progress and the dataset. Pure
 * and tolerant of legacy/corrupt saves (every stat read goes through a normalize
 * helper). Returns the badges in a fixed display order.
 */
export function computeAchievements(
  progress: ProgressState,
  topics: Pick<TopicSummary, "slug" | "items" | "categorySlug">[],
): Achievement[] {
  const learnedTopics = progress.learnedTopics ?? [];
  const favoriteWords = progress.favoriteWords ?? [];

  // Total graded flashcard reviews and any-word mastery, from flashcardStats.
  let totalReviews = 0;
  let masteredWords = 0;
  for (const raw of Object.values(progress.flashcardStats ?? {})) {
    const stat = normalizeStat(raw, NORMALIZE_EPOCH);
    totalReviews += stat.reviewCount;
    if (stat.intervalDays >= MASTERED_INTERVAL_DAYS) masteredWords += 1;
  }

  const best = bestQuizTopicProgress(topics, progress.quizStats);
  const bestStreak = longestStreak(progress.studiedDates ?? []);

  // Distinct categories spanned by the learner's learned topics. Learned slugs
  // that no longer exist in the dataset are ignored gracefully.
  const categoryBySlug = new Map(topics.map((t) => [t.slug, t.categorySlug]));
  const learnedCategories = new Set<string>();
  for (const slug of learnedTopics) {
    const categorySlug = categoryBySlug.get(slug);
    if (categorySlug) learnedCategories.add(categorySlug);
  }

  return [
    badge(
      "first-topic",
      "🌱",
      "First Steps",
      "Mark your first topic as learned.",
      "You learned your first topic!",
      learnedTopics.length,
      1,
    ),
    badge(
      "topic-collector",
      "📚",
      "Shelf Builder",
      "Learn 10 topics.",
      "10 topics learned — a real shelf now.",
      learnedTopics.length,
      10,
    ),
    badge(
      "streak-3",
      "⚡",
      "Spark",
      "Study 3 days in a row.",
      "A 3-day streak — habit forming.",
      bestStreak,
      3,
    ),
    badge(
      "streak-7",
      "🔥",
      "On Fire",
      "Study 7 days in a row.",
      "A full week of daily Mandarin.",
      bestStreak,
      7,
    ),
    badge(
      "first-review",
      "🃏",
      "First Flip",
      "Grade your first flashcard.",
      "Your spaced-repetition journey has begun.",
      totalReviews,
      1,
    ),
    badge(
      "century-club",
      "💯",
      "Century Club",
      "Grade 100 flashcard reviews.",
      "100 reviews graded. Consistency wins.",
      totalReviews,
      100,
    ),
    badge(
      "perfect-topic",
      "🎯",
      "Perfect Ten",
      "Quiz every word in one topic without a single miss.",
      "One topic, zero misses. Flawless.",
      best.perfectWords,
      best.topicTotal,
    ),
    badge(
      "first-mastery",
      "🧠",
      "Deep Roots",
      "Get one word to a week-long review interval.",
      "Your first mastered word — it stuck.",
      masteredWords,
      1,
    ),
    badge(
      "word-collector",
      "⭐",
      "Word Hoarder",
      "Save 10 favorite words.",
      "10 favorites saved for quick practice.",
      favoriteWords.length,
      10,
    ),
    badge(
      "explorer",
      "🧭",
      "Explorer",
      "Learn topics in 5 different categories.",
      "5 categories explored — well traveled.",
      learnedCategories.size,
      5,
    ),
  ];
}
