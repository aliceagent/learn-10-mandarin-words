import type {
  DailyChallengeResult,
  FlashcardStat,
  ProgressState,
  QuizStat,
  Topic,
  TopicSummary,
} from "./types";
// Value import needs the explicit `.ts` extension so it resolves under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors quiz-logic.ts.
import { wordKey } from "./data-logic.ts";

// Pure progress helpers, extracted from use-progress.ts so they can be
// unit-tested without React. The hook imports these and layers persistence /
// setState on top; the logic here never touches the DOM or localStorage.

// Bump this whenever the persisted ProgressState shape changes. Old saves that
// carry a lower (or missing) version are upgraded by `normalizeProgress`, which
// is written to never throw and never drop user data.
//   v2 → v3: added `quizStats` (per-word quiz accuracy). Older saves simply lack
//   the field and migrate to an empty `{}`, losing nothing else.
//   v3 → v4: added `dailyActivity` (distinct wordKeys practiced per ISO day).
//   Older saves lack the field and migrate to an empty `{}`, losing nothing else.
//   v4 → v5: added `dailyChallenge` (one Daily Challenge result per ISO day).
//   Older saves lack the field and migrate to an empty `{}`, losing nothing else.
//   v5 → v6: added `bestQuizCombo` (all-time best consecutive-correct quiz streak).
//   Older saves lack the field and backfill to 0, losing nothing else.
export const CURRENT_PROGRESS_SCHEMA_VERSION = 6;

export const emptyProgress: ProgressState = {
  schemaVersion: CURRENT_PROGRESS_SCHEMA_VERSION,
  learnedTopics: [],
  favoriteTopics: [],
  favoriteWords: [],
  flashcardStats: {},
  quizStats: {},
  dailyActivity: {},
  dailyChallenge: {},
  bestQuizCombo: 0,
  studiedDates: [],
  onboarding: { completed: false, dailyGoal: 0, completedAt: null },
};

// How many days of per-day practice history to retain. Bounds storage growth:
// ~14 days of short wordKey strings. Older days are pruned on every write.
export const DAILY_ACTIVITY_RETENTION_DAYS = 14;

// How many days of Daily Challenge results to retain. Older days are pruned on
// every write so storage stays bounded; ISO keys sort chronologically.
export const DAILY_CHALLENGE_RETENTION_DAYS = 60;

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

// True for a well-formed ISO day key ("YYYY-MM-DD"). Used to drop junk keys from
// a corrupt `dailyActivity` map without throwing.
function isISODayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime());
}

// Sanitize a persisted/imported `dailyActivity` map: drop non-array day values,
// non-string members, and invalid day keys; dedupe each day's words; and keep at
// most the newest DAILY_ACTIVITY_RETENTION_DAYS day-keys (ISO keys sort
// chronologically). Never throws. Added in schema v4.
function normalizeDailyActivity(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const kept: [string, string[]][] = [];
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isISODayKey(day)) continue;
    const words = asStringArray(value);
    if (!words) continue; // non-array (incl. a day mapped to a bare string) → drop
    kept.push([day, Array.from(new Set(words))]);
  }
  kept.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const trimmed = kept.slice(Math.max(0, kept.length - DAILY_ACTIVITY_RETENTION_DAYS));
  const out: Record<string, string[]> = {};
  for (const [day, words] of trimmed) out[day] = words;
  return out;
}

// Sanitize a persisted/imported `dailyChallenge` map: drop invalid day keys and
// non-object values; coerce score/total to non-negative integers with the
// `score ≤ total` invariant; repair a missing/invalid `completedAt` to the day's
// UTC midnight (deterministic, DOM-free); and keep at most the newest
// DAILY_CHALLENGE_RETENTION_DAYS day-keys. Never throws. Added in schema v5.
// Mirrors normalizeDailyActivity.
function normalizeDailyChallenge(raw: unknown): Record<string, DailyChallengeResult> {
  if (!raw || typeof raw !== "object") return {};
  const kept: [string, DailyChallengeResult][] = [];
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isISODayKey(day)) continue;
    if (!value || typeof value !== "object") continue; // non-object → drop
    const v = value as Partial<DailyChallengeResult>;
    const total =
      Number.isFinite(v.total) && (v.total as number) >= 0 ? Math.round(v.total as number) : 0;
    const rawScore =
      Number.isFinite(v.score) && (v.score as number) >= 0 ? Math.round(v.score as number) : 0;
    const score = Math.min(rawScore, total);
    const completedAt = isValidISO(v.completedAt) ? (v.completedAt as string) : new Date(day).toISOString();
    kept.push([day, { score, total, completedAt }]);
  }
  kept.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const trimmed = kept.slice(Math.max(0, kept.length - DAILY_CHALLENGE_RETENTION_DAYS));
  const out: Record<string, DailyChallengeResult> = {};
  for (const [day, result] of trimmed) out[day] = result;
  return out;
}

// Repair a persisted/imported `bestQuizCombo`: any non-number, non-finite, or
// negative value collapses to 0; a valid number is rounded to a whole streak
// count. Never throws. Added in schema v6.
export function normalizeBestCombo(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.round(raw);
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
    dailyActivity: normalizeDailyActivity(p.dailyActivity),
    dailyChallenge: normalizeDailyChallenge(p.dailyChallenge),
    bestQuizCombo: normalizeBestCombo(p.bestQuizCombo),
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

// Longest run of consecutive UTC days ever studied, anywhere in the history —
// unlike computeStreak, which only counts the run ending today/yesterday. A cheap
// companion stat for the heatmap header ("Best: N days"). Sorts + dedupes the day
// strings and walks gaps with the same 86400000-ms arithmetic as computeStreak;
// malformed date strings are dropped defensively so a corrupt entry can't throw.
export function longestStreak(studiedDates: string[]): number {
  const days = Array.from(
    new Set(studiedDates.filter((d) => typeof d === "string" && isValidISO(d))),
  ).sort();
  if (!days.length) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000);
    if (diff === 1) run++;
    else if (diff === 0) continue; // duplicate (Set already dedupes) — ignore
    else run = 1;
    if (run > best) best = run;
  }
  return best;
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

// ─── Per-topic progress ───────────────────────────────────────────────────────

export type TopicProgress = {
  /** Words in the topic graded at least once. */
  studied: number;
  /** Words whose review interval has reached the mastery threshold. */
  mastered: number;
  /** Total words in the topic. */
  total: number;
};

// A word counts as "mastered" once its spaced-repetition interval reaches a
// week. Kept as a named constant so the topic page and any future surface share
// exactly one threshold.
export const MASTERED_INTERVAL_DAYS = 7;

// Studied / mastered / total counts for a single topic, derived from the
// persisted flashcard stats. Pure and dataset-independent: it reads only
// `reviewCount` and `intervalDays` off each word's stat, keyed by `wordKey`, so
// the thresholds live in one place. Extracted from topic-app's `topicStats`
// with identical behavior.
export function topicProgress(
  topic: Topic,
  flashcardStats: Record<string, Pick<FlashcardStat, "reviewCount" | "intervalDays">>,
): TopicProgress {
  let studied = 0;
  let mastered = 0;
  for (const item of topic.items) {
    const stat = flashcardStats[wordKey(topic, item)];
    if (stat && stat.reviewCount > 0) studied++;
    if (stat && stat.intervalDays >= MASTERED_INTERVAL_DAYS) mastered++;
  }
  return { studied, mastered, total: topic.items.length };
}

// ─── Spaced-repetition review queue ────────────────────────────────────────────

// A word due for review, resolved back to its display fields and originating
// topic. Built by `dueCards` and rendered directly by the /review page.
export type DueCard = {
  topicSlug: string;
  topicTitle: string;
  hanzi: string;
  pinyin: string;
  english: string;
  key: string;
  dueAt: string;
  intervalDays: number;
};

// Every word across `topics` whose next review is due at or before `now`,
// sorted oldest-due first. Pure; `now` is injectable so the queue is
// deterministic in tests (defaults to the real clock, matching the component's
// previous inline `new Date()`). Extracted from review-app's `dueCards` memo
// with identical behavior.
export function dueCards(
  topics: Topic[],
  flashcardStats: Record<string, FlashcardStat>,
  now: Date = new Date(),
): DueCard[] {
  const cards: DueCard[] = [];
  for (const topic of topics) {
    for (const item of topic.items) {
      const key = wordKey(topic, item);
      const stat = flashcardStats[key];
      if (stat && new Date(stat.dueAt) <= now) {
        cards.push({
          topicSlug: topic.slug,
          topicTitle: topic.titleEn,
          hanzi: item.hanzi,
          pinyin: item.pinyin,
          english: item.english,
          key,
          dueAt: stat.dueAt,
          intervalDays: stat.intervalDays,
        });
      }
    }
  }
  return cards.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
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

// ─── Grading feedback previews ─────────────────────────────────────────────────

// Every grade in scheduling order — shared so previews line up with the grade
// buttons.
const GRADES: Grade[] = ["again", "hard", "good", "easy"];

// Projected next interval (whole days) per grade, WITHOUT persisting anything.
// Calls `scheduleReview` (the single source of interval math) once per grade on
// a defensive copy of the card, so the UI can label grade buttons with the exact
// interval a real grade would produce. A brand-new card uses `defaultStat`, so
// `previewIntervals(undefined, now)` yields `{again:1, hard:1, good:2, easy:4}`.
export function previewIntervals(existing: FlashcardStat | undefined, now: Date): Record<Grade, number> {
  const base = existing ?? defaultStat(now);
  const out = {} as Record<Grade, number>;
  for (const grade of GRADES) {
    // scheduleReview normalizes its input and never mutates it, so `base` is
    // untouched across the loop.
    out[grade] = scheduleReview(base, grade, now).intervalDays;
  }
  return out;
}

// Compact human label for a whole-day interval: "1d" | "6d" | "2w" | "3mo".
// < 7 days → days + "d"; < 60 days → round(days / 7) + "w"; else round(days / 30) + "mo".
export function formatIntervalDays(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

// True when there is a live streak that today's inactivity would break: the
// streak is alive courtesy of yesterday and nothing has been logged today.
// `computeStreak` already anchors on today-or-yesterday, so this is exactly
// "streak > 0 AND today not yet studied". `today` is injectable for tests.
export function streakAtRisk(studiedDates: string[], today: string = todayISO()): boolean {
  return computeStreak(studiedDates, today) > 0 && !studiedDates.includes(today);
}

// ─── Daily goal loop (schema v4) ───────────────────────────────────────────────

// Add `key` to `today`'s set of practiced words, returning a NEW map (pure).
// Re-practicing the same word the same day is a no-op for the count (deduped).
// The result is pruned to the newest DAILY_ACTIVITY_RETENTION_DAYS day-keys so
// storage stays bounded; ISO day keys sort chronologically.
export function recordDailyPractice(
  activity: Record<string, string[]> | undefined,
  key: string,
  today: string,
): Record<string, string[]> {
  const base = activity && typeof activity === "object" ? activity : {};
  const existing = Array.isArray(base[today]) ? base[today] : [];
  const todayWords = existing.includes(key) ? existing : [...existing, key];
  const next: Record<string, string[]> = { ...base, [today]: todayWords };
  const days = Object.keys(next).sort();
  if (days.length <= DAILY_ACTIVITY_RETENTION_DAYS) return next;
  const keep = new Set(days.slice(days.length - DAILY_ACTIVITY_RETENTION_DAYS));
  const pruned: Record<string, string[]> = {};
  for (const day of days) if (keep.has(day)) pruned[day] = next[day];
  return pruned;
}

// Number of distinct words practiced on `day` (0 when the day is absent).
export function practicedCountOn(
  activity: Record<string, string[]> | undefined,
  day: string,
): number {
  const words = activity?.[day];
  return Array.isArray(words) ? words.length : 0;
}

// Today's practiced/goal/met, reading the goal from onboarding.dailyGoal. A goal
// of 0 (never set) yields `met: false`; the UI branches on `goal > 0`. Reaching
// exactly the goal counts as met.
export function goalProgress(
  progress: ProgressState,
  today: string = todayISO(),
): { practiced: number; goal: number; met: boolean } {
  const goal = progress.onboarding?.dailyGoal ?? 0;
  const practiced = practicedCountOn(progress.dailyActivity, today);
  return { practiced, goal, met: goal > 0 && practiced >= goal };
}

// ─── Daily Challenge (schema v5) ───────────────────────────────────────────────

// Record one Daily Challenge result for `day`, returning a NEW map (pure). FIRST
// completion wins: if an entry for `day` already exists it is preserved untouched
// (a challenge is one official run per day, Wordle-style). The result is pruned
// to the newest DAILY_CHALLENGE_RETENTION_DAYS day-keys so storage stays bounded;
// ISO day keys sort chronologically. The input map is never mutated.
export function recordDailyChallenge(
  map: Record<string, DailyChallengeResult> | undefined,
  day: string,
  result: DailyChallengeResult,
): Record<string, DailyChallengeResult> {
  const base = map && typeof map === "object" ? map : {};
  // First completion wins — only add when the day has no result yet.
  const next: Record<string, DailyChallengeResult> = base[day]
    ? { ...base }
    : { ...base, [day]: result };
  const days = Object.keys(next).sort();
  if (days.length <= DAILY_CHALLENGE_RETENTION_DAYS) return next;
  const keep = new Set(days.slice(days.length - DAILY_CHALLENGE_RETENTION_DAYS));
  const pruned: Record<string, DailyChallengeResult> = {};
  for (const day2 of days) if (keep.has(day2)) pruned[day2] = next[day2];
  return pruned;
}

// Consecutive-day streak of completed Daily Challenges, ending today (or
// yesterday, so an in-progress day isn't punished). Reuses computeStreak over the
// map's day keys — the same semantics as the study-day streak. `today` is
// injectable for tests.
export function challengeStreak(
  map: Record<string, DailyChallengeResult> | undefined,
  today: string = todayISO(),
): number {
  return computeStreak(Object.keys(map ?? {}), today);
}

// ─── Word / topic mastery status (Sprint 10) ───────────────────────────────────

// Derived, at-a-glance status for a single word. Purely a read over the existing
// flashcard + quiz stats — nothing here is persisted.
export type WordStatus = "new" | "learning" | "mastered" | "tricky";

// Aggregate word-status counts over a set of topics (a category's, or all).
export type MasterySummary = {
  mastered: number;
  learning: number;
  tricky: number;
  new: number;
  total: number;
};

// A word is "tricky" once the learner has quizzed it enough times to trust the
// signal (TRICKY_MIN_ATTEMPTS) and is still getting it wrong more often than not
// (accuracy below TRICKY_MAX_ACCURACY). These mirror computeWeakWords' evidence
// convention so the two surfaces agree, and live as named constants so the
// thresholds sit in exactly one place.
export const TRICKY_MAX_ACCURACY = 0.5;
export const TRICKY_MIN_ATTEMPTS = 3;

// Fixed clock for normalizing a flashcard stat here: `wordStatus` only reads
// `intervalDays` and `reviewCount` (never the `dueAt` default that `now` seeds),
// so pinning it keeps the derivation pure and deterministic.
const MASTERY_NORMALIZE_EPOCH = new Date(0);

// Derive a word's status from its flashcard + quiz stats. Precedence is
// deliberate: mastered > tricky > learning > new. A word whose SRS interval has
// reached the mastery threshold stays "mastered" even if its quiz accuracy is
// poor — the interval is the stronger, longer-horizon signal. Tolerant of
// undefined/corrupt inputs via normalizeStat/normalizeQuizStat, so it never
// throws on legacy data.
export function wordStatus(
  stat: FlashcardStat | undefined,
  quiz: QuizStat | undefined,
): WordStatus {
  const s = stat != null ? normalizeStat(stat, MASTERY_NORMALIZE_EPOCH) : undefined;
  const q = normalizeQuizStat(quiz);
  const accuracy = q.attempts > 0 ? q.correct / q.attempts : 0;

  if (s != null && s.intervalDays >= MASTERED_INTERVAL_DAYS) return "mastered";
  if (q.attempts >= TRICKY_MIN_ATTEMPTS && accuracy < TRICKY_MAX_ACCURACY) return "tricky";
  if ((s != null && s.reviewCount > 0) || q.attempts > 0) return "learning";
  return "new";
}

// Per-item statuses for a topic, in `topic.items` order, keyed by `wordKey`.
export function topicWordStatuses(
  topic: Pick<TopicSummary, "slug" | "items">,
  flashcardStats: Record<string, FlashcardStat>,
  quizStats: Record<string, QuizStat>,
): WordStatus[] {
  return topic.items.map((item) => {
    const key = wordKey(topic, item);
    return wordStatus(flashcardStats?.[key], quizStats?.[key]);
  });
}

// Aggregate word-status counts across a set of topics. `total` always equals the
// sum of the four buckets (one status per word).
export function masterySummary(
  topics: Pick<TopicSummary, "slug" | "items">[],
  flashcardStats: Record<string, FlashcardStat>,
  quizStats: Record<string, QuizStat>,
): MasterySummary {
  const summary: MasterySummary = { mastered: 0, learning: 0, tricky: 0, new: 0, total: 0 };
  for (const topic of topics) {
    for (const status of topicWordStatuses(topic, flashcardStats, quizStats)) {
      summary[status] += 1;
      summary.total += 1;
    }
  }
  return summary;
}
