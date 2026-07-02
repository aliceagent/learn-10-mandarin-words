import type { FlashcardStat, ProgressState, QuizStat } from "./types";

// Pure progress helpers, extracted from use-progress.ts so they can be
// unit-tested without React. The hook imports these and layers persistence /
// setState on top; the logic here never touches the DOM or localStorage.

// Bump this whenever the persisted ProgressState shape changes. Old saves that
// carry a lower (or missing) version are upgraded by `normalizeProgress`, which
// is written to never throw and never drop user data.
//   v2 → v3: added `quizStats` (per-word quiz accuracy). Older saves simply lack
//   the field and migrate to an empty `{}`, losing nothing else.
export const CURRENT_PROGRESS_SCHEMA_VERSION = 3;

export const emptyProgress: ProgressState = {
  schemaVersion: CURRENT_PROGRESS_SCHEMA_VERSION,
  learnedTopics: [],
  favoriteTopics: [],
  favoriteWords: [],
  flashcardStats: {},
  quizStats: {},
  studiedDates: [],
  onboarding: { completed: false, dailyGoal: 0, completedAt: null },
};

// ─── SM-2-ish scheduling constants ────────────────────────────────────────────
// The scheduler below is a simplified SuperMemo-2 variant. `ease` behaves like
// SM-2's E-Factor: it starts at 2.5 and is nudged per grade, clamped to a sane
// range so a string of "again"s can't drive intervals to zero and a string of
// "easy"s can't explode them.
const DEFAULT_EASE = 2.5;
export const EASE_FLOOR = 1.3; // classic SM-2 lower bound
export const EASE_CEIL = 3.0; // upper guard so intervals stay finite

function clampEase(ease: number): number {
  if (!Number.isFinite(ease)) return DEFAULT_EASE;
  return Math.min(EASE_CEIL, Math.max(EASE_FLOOR, ease));
}

// ─── Normalization / migration ────────────────────────────────────────────────

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function isValidISO(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

// Repair a single flashcard stat: coerce out-of-range / non-finite / missing
// fields to safe defaults so a corrupt or partial legacy entry can never crash
// scheduling or the review queue.
export function normalizeStat(stat: unknown, now: Date): FlashcardStat {
  const base = defaultStat(now);
  if (!stat || typeof stat !== "object") return base;
  const s = stat as Partial<FlashcardStat>;
  const intervalDays =
    Number.isFinite(s.intervalDays) && (s.intervalDays as number) >= 0
      ? Math.round(s.intervalDays as number)
      : base.intervalDays;
  const reviewCount =
    Number.isFinite(s.reviewCount) && (s.reviewCount as number) >= 0
      ? Math.round(s.reviewCount as number)
      : base.reviewCount;
  return {
    intervalDays,
    ease: clampEase(s.ease as number),
    dueAt: isValidISO(s.dueAt) ? s.dueAt : base.dueAt,
    reviewCount,
  };
}

function normalizeFlashcardStats(raw: unknown, now: Date): Record<string, FlashcardStat> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, FlashcardStat> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = normalizeStat(value, now);
  }
  return out;
}

// Repair a single quiz stat: coerce missing/non-finite/negative counts to safe
// non-negative integers and enforce the `correct ≤ attempts` invariant so a
// corrupt entry can never yield an accuracy above 100% or below 0.
export function normalizeQuizStat(stat: unknown): QuizStat {
  const base: QuizStat = { correct: 0, attempts: 0 };
  if (!stat || typeof stat !== "object") return base;
  const s = stat as Partial<QuizStat>;
  const attempts =
    Number.isFinite(s.attempts) && (s.attempts as number) >= 0 ? Math.round(s.attempts as number) : 0;
  const rawCorrect =
    Number.isFinite(s.correct) && (s.correct as number) >= 0 ? Math.round(s.correct as number) : 0;
  return { correct: Math.min(rawCorrect, attempts), attempts };
}

function normalizeQuizStats(raw: unknown): Record<string, QuizStat> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, QuizStat> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = normalizeQuizStat(value);
  }
  return out;
}

// Record one quiz answer against `key`, returning a NEW quizStats map (pure).
// The existing entry is normalized first so a corrupt stat can't corrupt the
// increment. Used by the useProgress hook's `recordQuizAnswer`.
export function updateQuizStats(
  quizStats: Record<string, QuizStat>,
  key: string,
  correct: boolean,
): Record<string, QuizStat> {
  const prev = normalizeQuizStat(quizStats?.[key]);
  return {
    ...quizStats,
    [key]: { correct: prev.correct + (correct ? 1 : 0), attempts: prev.attempts + 1 },
  };
}

// Merge stored data over defaults and migrate legacy saves. This is the single
// entry point for loading persisted or imported progress: it upgrades saves
// that predate `schemaVersion`, `onboarding`, `reviewCount`, or `quizStats`,
// sanitizes unexpected/partial values, and never throws — preserving
// learnedTopics, favoriteTopics, favoriteWords, flashcardStats, quizStats, and
// studiedDates. `now` is injectable so repaired stats have deterministic
// timestamps in tests.
export function normalizeProgress(
  partial: Partial<ProgressState> | Record<string, unknown> | null | undefined = {},
  now: Date = new Date(),
): ProgressState {
  const p = (partial && typeof partial === "object" ? partial : {}) as Partial<ProgressState>;
  const onboarding =
    p.onboarding && typeof p.onboarding === "object" ? p.onboarding : {};
  return {
    // Always stamp the current version: this IS the migration step.
    schemaVersion: CURRENT_PROGRESS_SCHEMA_VERSION,
    learnedTopics: asStringArray(p.learnedTopics) ?? [],
    favoriteTopics: asStringArray(p.favoriteTopics) ?? [],
    favoriteWords: asStringArray(p.favoriteWords) ?? [],
    flashcardStats: normalizeFlashcardStats(p.flashcardStats, now),
    quizStats: normalizeQuizStats(p.quizStats),
    studiedDates: asStringArray(p.studiedDates) ?? [],
    onboarding: { ...emptyProgress.onboarding, ...onboarding },
  };
}

export function uniqueToggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return isoDay(new Date());
}

// Consecutive-day streak ending today (or yesterday, so an in-progress day
// isn't punished before it's studied). `today` is injectable for testing day
// boundaries; it defaults to the real current day so callers are unaffected.
export function computeStreak(studiedDates: string[], today: string = todayISO()): number {
  if (!studiedDates.length) return 0;
  const sorted = [...studiedDates].sort().reverse();
  const yesterday = isoDay(new Date(new Date(today).getTime() - 86400000));
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

// ─── Derived dashboard stats ──────────────────────────────────────────────────

// Pure, dataset-independent stats derived from a ProgressState, used by the
// /stats page. Everything below reads only fields that already exist in the
// persisted schema — nothing is invented. `now` is injectable so "due today"
// and the streak anchor are deterministic in tests.
export type ProgressStats = {
  /** Topics the user has marked learned. */
  learnedTopics: number;
  /** Individual words saved as favorites. */
  favoriteWords: number;
  /** Whole topics saved as favorites. */
  favoriteTopics: number;
  /** Flashcards whose next review is due now or in the past. */
  dueReviews: number;
  /** Distinct words that have been graded at least once. */
  reviewedWords: number;
  /** Distinct words tracked in the spaced-repetition queue. */
  wordsTracked: number;
  /** Total graded reviews across all words. */
  totalReviews: number;
  /** Distinct days on which the user studied. */
  daysStudied: number;
  /** Consecutive-day study streak ending today (or yesterday). */
  streak: number;
};

export function computeStats(progress: ProgressState, now: Date = new Date()): ProgressStats {
  const stats = Object.values(progress.flashcardStats ?? {});
  const nowMs = now.getTime();

  let dueReviews = 0;
  let reviewedWords = 0;
  let totalReviews = 0;
  for (const stat of stats) {
    const due = new Date(stat.dueAt).getTime();
    if (Number.isFinite(due) && due <= nowMs) dueReviews++;
    if (stat.reviewCount > 0) reviewedWords++;
    totalReviews += stat.reviewCount;
  }

  return {
    learnedTopics: progress.learnedTopics.length,
    favoriteWords: progress.favoriteWords.length,
    favoriteTopics: progress.favoriteTopics.length,
    dueReviews,
    reviewedWords,
    wordsTracked: stats.length,
    totalReviews,
    daysStudied: progress.studiedDates.length,
    // computeStreak takes the "today" anchor as an ISO day string; derive it
    // from the injectable clock so tests stay deterministic.
    streak: computeStreak(progress.studiedDates ?? [], isoDay(now)),
  };
}

// ─── Weak / tricky words ──────────────────────────────────────────────────────

export type WeakWord = {
  /** The `wordKey` (`topic.slug:hanzi`) this stat belongs to. */
  key: string;
  correct: number;
  attempts: number;
  /** Share of attempts answered correctly, in [0, 1]. */
  accuracy: number;
};

// Rank the learner's quizzed words from weakest (lowest accuracy) to strongest,
// keeping only words with at least `minAttempts` recorded answers so a single
// unlucky guess doesn't dominate. Ties break toward more-attempted words (more
// evidence), then by key for a stable order. Pure; reads only `quizStats`.
export function computeWeakWords(
  quizStats: Record<string, QuizStat> | undefined,
  { minAttempts = 3, limit = 10 }: { minAttempts?: number; limit?: number } = {},
): WeakWord[] {
  const out: WeakWord[] = [];
  for (const [key, raw] of Object.entries(quizStats ?? {})) {
    const stat = normalizeQuizStat(raw);
    if (stat.attempts < minAttempts) continue;
    out.push({
      key,
      correct: stat.correct,
      attempts: stat.attempts,
      accuracy: stat.attempts > 0 ? stat.correct / stat.attempts : 0,
    });
  }
  out.sort(
    (a, b) =>
      a.accuracy - b.accuracy ||
      b.attempts - a.attempts ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  return out.slice(0, limit);
}

export type Grade = "again" | "hard" | "good" | "easy";

// The stat used for a word's very first review.
export function defaultStat(now: Date): FlashcardStat {
  return { intervalDays: 0, ease: DEFAULT_EASE, dueAt: now.toISOString(), reviewCount: 0 };
}

// Per-grade nudge applied to `ease` (SM-2 E-Factor). "good" leaves ease
// unchanged (the card is on track); "again"/"hard" pull it down, "easy" lifts
// it. The result is clamped to [EASE_FLOOR, EASE_CEIL].
const EASE_DELTA: Record<Grade, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

// Next interval in whole days given the grade and the previous interval:
//   again → 1 (relearn tomorrow)
//   hard  → previous + 1 day (grows slowly, minimum 1)
//   good  → double the previous interval (minimum 2)
//   easy  → triple the previous interval (minimum 4)
// The `|| N` guards handle the first review, where the previous interval is 0.
function nextInterval(grade: Grade, prevInterval: number): number {
  switch (grade) {
    case "again":
      return 1;
    case "hard":
      return Math.max(1, prevInterval + 1);
    case "good":
      return Math.max(2, prevInterval * 2 || 2);
    case "easy":
      return Math.max(4, prevInterval * 3 || 4);
  }
}

// Documented SM-2-ish review update. Given the card's existing stat, a grade,
// and the current time, return the next stat with an updated interval, ease,
// due date, and review count. `now` is injectable so scheduling is
// deterministic in tests; the hook passes the real clock. The incoming stat is
// normalized first so scheduling is robust to legacy/corrupt entries.
export function scheduleReview(existing: FlashcardStat, grade: Grade, now: Date): FlashcardStat {
  const stat = normalizeStat(existing, now);
  const intervalDays = nextInterval(grade, stat.intervalDays);
  const ease = clampEase(stat.ease + EASE_DELTA[grade]);
  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);
  return { intervalDays, ease, dueAt: due.toISOString(), reviewCount: stat.reviewCount + 1 };
}
