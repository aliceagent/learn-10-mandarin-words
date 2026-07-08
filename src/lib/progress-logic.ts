import type {
  BossStat,
  DailyChallengeResult,
  DirectionalFlashcardStat,
  DirectionalFlashcardStats,
  FlashcardStat,
  LastActivity,
  ProgressState,
  QuizStat,
  StreakFreezeState,
  Topic,
  TopicSummary,
  VocabItem,
} from "./types";
import type { ResumableQuizMode, TopicMode } from "./topic-mode-logic.ts";
import type { ConcreteFlashcardDirection } from "./flashcard-direction.ts";
// Value imports need the explicit `.ts` extension so they resolve under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors quiz-logic.ts.
// BOSS_STAGE_COUNT is the single source of truth for the boss round's stage
// count, reused here to cap a persisted bestScore.
import { wordKey } from "./data-logic.ts";
import { BOSS_STAGE_COUNT } from "./boss-logic.ts";
// parseMode/parseQuizMode validate a persisted lastActivity's mode ids without
// duplicating the canonical mode registry here.
import { parseMode, parseQuizMode } from "./topic-mode-logic.ts";

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
//   v6 → v7: added `bossStats` (per-topic Boss Round best score, attempts, and
//   crown date). Older saves lack the field and migrate to an empty `{}`, losing
//   nothing else.
//   v7 → v8: added `lapses` to each FlashcardStat (count of "again" grades, for
//   leech detection). Older stats lack the field and backfill to 0, losing
//   nothing else.
//   v8 → v9: added `streakFreezes` (earned tokens that auto-cover one missed
//   day). Older saves lack the field and default to
//   {available:0, lastEarnedOn:null, frozenDates:[]}, losing nothing else.
//   v9 → v10: added `recentTopics` (most-recently-opened topic slugs, for the
//   home "Jump back in" shelf). Older saves lack the field and migrate to an
//   empty [], losing nothing else.
//   v10 → v11: added `dailyQuiz` (per-day quiz accuracy tally, for the weekly
//   recap card). Older saves lack the field and migrate to an empty `{}`, losing
//   nothing else.
//   v11 → v12: added `lastActivity` (the single most recent topic + practice mode
//   + quiz sub-mode, for the home "Resume where you left off" card). Older saves
//   lack the field and migrate to null, losing nothing else.
//   v12 → v13: added `directionalFlashcardStats` (wordKey → direction → recall
//   quality counts/confidence). Older saves lack the field and migrate to {},
//   leaving `flashcardStats` as the primary SRS queue.
export const CURRENT_PROGRESS_SCHEMA_VERSION = 13;

export const emptyProgress: ProgressState = {
  schemaVersion: CURRENT_PROGRESS_SCHEMA_VERSION,
  learnedTopics: [],
  favoriteTopics: [],
  favoriteWords: [],
  flashcardStats: {},
  directionalFlashcardStats: {},
  quizStats: {},
  dailyActivity: {},
  dailyChallenge: {},
  dailyQuiz: {},
  bestQuizCombo: 0,
  bossStats: {},
  studiedDates: [],
  streakFreezes: { available: 0, lastEarnedOn: null, frozenDates: [] },
  recentTopics: [],
  lastActivity: null,
  onboarding: { completed: false, dailyGoal: 0, completedAt: null },
};

// How many recently-opened topic slugs to persist. The home shelf shows only the
// most recent 3, but we keep more so a single renamed/removed slug (dataset
// drift) can't empty the shelf; the tail is cheap (short slug strings).
export const RECENT_TOPICS_MAX = 8;

// Max streak-freeze tokens a learner can bank at once — a small safety net, not
// a way to coast indefinitely. Earning is gated to one non-overlapping goal-week.
export const MAX_STREAK_FREEZES = 2;
// Consecutive goal-met days required to earn one freeze. DAILY_ACTIVITY_RETENTION_DAYS
// (14) exceeds this, so the full lookback is always computable from persisted data.
export const GOAL_WEEK_DAYS = 7;

// How many days of per-day practice history to retain. Bounds storage growth:
// ~14 days of short wordKey strings. Older days are pruned on every write.
export const DAILY_ACTIVITY_RETENTION_DAYS = 14;

// How many days of Daily Challenge results to retain. Older days are pruned on
// every write so storage stays bounded; ISO keys sort chronologically.
export const DAILY_CHALLENGE_RETENTION_DAYS = 60;

// How many days of per-day quiz tallies to retain. Matches DAILY_ACTIVITY_RETENTION_DAYS
// so the weekly recap's 7-day window is always fully computable; older days are
// pruned on every write so storage stays bounded.
export const DAILY_QUIZ_RETENTION_DAYS = 14;

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
  const lapses =
    Number.isFinite(s.lapses) && (s.lapses as number) >= 0
      ? Math.round(s.lapses as number)
      : base.lapses;
  return {
    intervalDays,
    ease: clampEase(s.ease as number),
    dueAt: isValidISO(s.dueAt) ? s.dueAt : base.dueAt,
    reviewCount,
    lapses,
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

const DIRECTIONAL_DIRECTIONS = new Set<ConcreteFlashcardDirection>(["zh-en", "en-zh", "pinyin-zh"]);

function nonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function clampPercent(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

const EMPTY_GRADE_COUNTS: Record<Grade, number> = { again: 0, hard: 0, good: 0, easy: 0 };
const DIRECTIONAL_GRADE_POINTS: Record<Grade, number> = { again: 0, hard: 25, good: 100, easy: 100 };

function directionalConfidence(gradeCounts: Record<Grade, number>): number {
  const total = Object.values(gradeCounts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  const points = (Object.keys(DIRECTIONAL_GRADE_POINTS) as Grade[]).reduce(
    (sum, grade) => sum + gradeCounts[grade] * DIRECTIONAL_GRADE_POINTS[grade],
    0,
  );
  return Math.round(points / total);
}

export function normalizeDirectionalFlashcardStat(raw: unknown): DirectionalFlashcardStat {
  if (!raw || typeof raw !== "object") {
    return { reviewCount: 0, confidence: 0, gradeCounts: { ...EMPTY_GRADE_COUNTS } };
  }
  const r = raw as Partial<DirectionalFlashcardStat>;
  const rawCounts = r.gradeCounts && typeof r.gradeCounts === "object" ? r.gradeCounts : {};
  const gradeCounts: Record<Grade, number> = {
    again: nonNegativeInt((rawCounts as Partial<Record<Grade, unknown>>).again),
    hard: nonNegativeInt((rawCounts as Partial<Record<Grade, unknown>>).hard),
    good: nonNegativeInt((rawCounts as Partial<Record<Grade, unknown>>).good),
    easy: nonNegativeInt((rawCounts as Partial<Record<Grade, unknown>>).easy),
  };
  const countedReviews = Object.values(gradeCounts).reduce((sum, count) => sum + count, 0);
  return {
    reviewCount: Math.max(nonNegativeInt(r.reviewCount), countedReviews),
    confidence: clampPercent(r.confidence),
    gradeCounts,
  };
}

function normalizeDirectionalFlashcardStats(raw: unknown): DirectionalFlashcardStats {
  if (!raw || typeof raw !== "object") return {};
  const out: DirectionalFlashcardStats = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const directions: Partial<Record<ConcreteFlashcardDirection, DirectionalFlashcardStat>> = {};
    for (const [direction, stat] of Object.entries(value as Record<string, unknown>)) {
      if (!DIRECTIONAL_DIRECTIONS.has(direction as ConcreteFlashcardDirection)) continue;
      directions[direction as ConcreteFlashcardDirection] = normalizeDirectionalFlashcardStat(stat);
    }
    if (Object.keys(directions).length > 0) out[key] = directions;
  }
  return out;
}

export function recordDirectionalFlashcardGrade(
  stats: DirectionalFlashcardStats | undefined,
  key: string,
  direction: ConcreteFlashcardDirection,
  grade: Grade,
): DirectionalFlashcardStats {
  const base = normalizeDirectionalFlashcardStats(stats);
  const wordStats = base[key] ?? {};
  const previous = normalizeDirectionalFlashcardStat(wordStats[direction]);
  const gradeCounts = { ...previous.gradeCounts, [grade]: previous.gradeCounts[grade] + 1 };
  const nextStat: DirectionalFlashcardStat = {
    reviewCount: previous.reviewCount + 1,
    confidence: directionalConfidence(gradeCounts),
    gradeCounts,
  };
  return {
    ...base,
    [key]: {
      ...wordStats,
      [direction]: nextStat,
    },
  };
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

// Sanitize a persisted/imported `dailyQuiz` map (ISO day → QuizStat): drop
// invalid day keys and non-object values, repair each surviving tally via
// normalizeQuizStat (enforcing `correct ≤ attempts`), and keep at most the newest
// DAILY_QUIZ_RETENTION_DAYS day-keys (ISO keys sort chronologically). Never
// throws. Added in schema v11. Mirrors normalizeDailyActivity.
export function normalizeDailyQuiz(raw: unknown): Record<string, QuizStat> {
  if (!raw || typeof raw !== "object") return {};
  const kept: [string, QuizStat][] = [];
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isISODayKey(day)) continue;
    if (!value || typeof value !== "object") continue; // non-object → drop
    kept.push([day, normalizeQuizStat(value)]);
  }
  kept.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const trimmed = kept.slice(Math.max(0, kept.length - DAILY_QUIZ_RETENTION_DAYS));
  const out: Record<string, QuizStat> = {};
  for (const [day, stat] of trimmed) out[day] = stat;
  return out;
}

// Repair a persisted/imported `bestQuizCombo`: any non-number, non-finite, or
// negative value collapses to 0; a valid number is rounded to a whole streak
// count. Never throws. Added in schema v6.
export function normalizeBestCombo(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.round(raw);
}

// Repair a single Boss Round stat: coerce counts to non-negative integers, cap
// `bestScore` at BOSS_STAGE_COUNT (a run can't pass more stages than exist), and
// reduce an invalid `crownedAt` to null. Never throws. Added in schema v7.
export function normalizeBossStat(stat: unknown): BossStat {
  const base: BossStat = { bestScore: 0, attempts: 0, crownedAt: null };
  if (!stat || typeof stat !== "object") return base;
  const s = stat as Partial<BossStat>;
  const attempts =
    Number.isFinite(s.attempts) && (s.attempts as number) >= 0 ? Math.round(s.attempts as number) : 0;
  const rawBest =
    Number.isFinite(s.bestScore) && (s.bestScore as number) >= 0 ? Math.round(s.bestScore as number) : 0;
  const bestScore = Math.min(rawBest, BOSS_STAGE_COUNT);
  const crownedAt = isValidISO(s.crownedAt) ? (s.crownedAt as string) : null;
  return { bestScore, attempts, crownedAt };
}

// Sanitize a persisted/imported `bossStats` map (topic slug → BossStat): drop
// non-object values and repair each surviving entry. Never throws. Added in
// schema v7. Mirrors normalizeQuizStats.
export function normalizeBossStats(raw: unknown): Record<string, BossStat> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, BossStat> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = normalizeBossStat(value);
  }
  return out;
}

// Repair a persisted/imported `streakFreezes` blob: clamp `available` to
// 0..MAX_STREAK_FREEZES (round, non-finite → 0), keep `lastEarnedOn` only if it
// is a valid ISO day key (else null), and filter/dedupe/sort `frozenDates` by the
// same key check. Never throws. Added in schema v9. Mirrors normalizeBossStat.
export function normalizeStreakFreezes(raw: unknown): StreakFreezeState {
  const base: StreakFreezeState = { available: 0, lastEarnedOn: null, frozenDates: [] };
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<StreakFreezeState>;
  const available =
    Number.isFinite(s.available) && (s.available as number) >= 0
      ? Math.min(MAX_STREAK_FREEZES, Math.round(s.available as number))
      : 0;
  const lastEarnedOn =
    typeof s.lastEarnedOn === "string" && isISODayKey(s.lastEarnedOn) ? s.lastEarnedOn : null;
  const frozenDates = Array.isArray(s.frozenDates)
    ? Array.from(
        new Set(
          s.frozenDates.filter((d): d is string => typeof d === "string" && isISODayKey(d)),
        ),
      ).sort()
    : [];
  return { available, lastEarnedOn, frozenDates };
}

// Sanitize a persisted/imported `recentTopics` list: keep only strings, dedupe
// preserving first occurrence (most-recent-first order), and cap at
// RECENT_TOPICS_MAX. Never throws. Added in schema v10. Mirrors the defensive
// style of normalizeDailyActivity.
function normalizeRecentTopics(raw: unknown): string[] {
  const slugs = asStringArray(raw);
  if (!slugs) return [];
  return Array.from(new Set(slugs)).slice(0, RECENT_TOPICS_MAX);
}

// Move `slug` to the front of the recent-topics list, deduping and capping at
// RECENT_TOPICS_MAX (pure). CRITICAL CONTRACT: when `slug` is already at index 0
// the INPUT ARRAY is returned reference-unchanged, so the recording effect in
// topic-app can bail out without re-rendering (see recordTopicVisit). Tolerates
// an `undefined` list (older/partial state).
export function recordRecentTopic(recent: string[] | undefined, slug: string): string[] {
  const list = recent ?? [];
  if (list[0] === slug) return list; // no-op: already most recent
  return [slug, ...list.filter((s) => s !== slug)].slice(0, RECENT_TOPICS_MAX);
}

// Sanitize a persisted/imported `lastActivity` blob into a valid LastActivity or
// null. Never throws (schema v12). Requires a non-empty `topicSlug`, a `mode`
// that parses via the canonical registry, and a valid ISO `updatedAt`; a
// `quizMode` is only kept for the quiz mode. Any failure yields null so the
// resume card simply hides. Deliberately does NOT check the slug against the
// dataset — that resolution/dropping lives in resume-logic against the live
// topics, keeping this module dataset-independent (mirrors normalizeRecentTopics).
function normalizeLastActivity(raw: unknown): LastActivity | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.topicSlug !== "string" || a.topicSlug === "") return null;
  const mode = parseMode(a.mode as string | null | undefined);
  if (!mode) return null;
  if (!isValidISO(a.updatedAt)) return null;
  const quizMode = mode === "quiz" ? parseQuizMode(a.quizMode as string | null | undefined) : null;
  const activity: LastActivity = { topicSlug: a.topicSlug, mode, updatedAt: a.updatedAt };
  if (quizMode) activity.quizMode = quizMode;
  return activity;
}

// Build the new lastActivity for a (slug, mode, quizMode) the learner just
// switched to (pure). CRITICAL CONTRACT: when the slug + mode + quiz sub-mode
// already match `prev`, the SAME reference is returned so the recording effect in
// topic-app stays loop-free (mirrors recordRecentTopic). Any real change yields a
// new object with a fresh `updatedAt`. `quizMode` is dropped for non-quiz modes.
// `now` is injectable for deterministic tests.
export function recordLastActivity(
  prev: LastActivity | null | undefined,
  next: { slug: string; mode: TopicMode; quizMode?: ResumableQuizMode },
  now: Date = new Date(),
): LastActivity {
  const quizMode = next.mode === "quiz" ? next.quizMode : undefined;
  if (
    prev &&
    prev.topicSlug === next.slug &&
    prev.mode === next.mode &&
    (prev.quizMode ?? undefined) === (quizMode ?? undefined)
  ) {
    return prev; // no-op: nothing meaningful changed
  }
  const activity: LastActivity = {
    topicSlug: next.slug,
    mode: next.mode,
    updatedAt: now.toISOString(),
  };
  if (quizMode) activity.quizMode = quizMode;
  return activity;
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
    directionalFlashcardStats: normalizeDirectionalFlashcardStats(p.directionalFlashcardStats),
    quizStats: normalizeQuizStats(p.quizStats),
    dailyActivity: normalizeDailyActivity(p.dailyActivity),
    dailyChallenge: normalizeDailyChallenge(p.dailyChallenge),
    dailyQuiz: normalizeDailyQuiz(p.dailyQuiz),
    bestQuizCombo: normalizeBestCombo(p.bestQuizCombo),
    bossStats: normalizeBossStats(p.bossStats),
    studiedDates: asStringArray(p.studiedDates) ?? [],
    streakFreezes: normalizeStreakFreezes(p.streakFreezes),
    recentTopics: normalizeRecentTopics(p.recentTopics),
    lastActivity: normalizeLastActivity(p.lastActivity),
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
  /** Words repeatedly failed in review and flagged for a rescue drill. */
  leechWords: number;
};

export function computeStats(progress: ProgressState, now: Date = new Date()): ProgressStats {
  const stats = Object.values(progress.flashcardStats ?? {});
  const nowMs = now.getTime();

  let dueReviews = 0;
  let reviewedWords = 0;
  let totalReviews = 0;
  let leechWords = 0;
  for (const stat of stats) {
    const due = new Date(stat.dueAt).getTime();
    if (Number.isFinite(due) && due <= nowMs) dueReviews++;
    if (stat.reviewCount > 0) reviewedWords++;
    totalReviews += stat.reviewCount;
    if (isLeech(stat)) leechWords++;
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
    // from the injectable clock so tests stay deterministic. The streak reads the
    // studied ∪ frozen union so a spent freeze bridges its covered day, while
    // daysStudied stays on real study days only (frozen days never inflate it).
    streak: computeStreak(studiedWithFreezes(progress), isoDay(now)),
    leechWords,
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
  // Accepts a full Topic or the slimmed TopicSummary (home shelf) — only `slug`
  // and each item's `hanzi` are read, via wordKey.
  topic: Pick<Topic, "slug"> & { items: readonly Pick<VocabItem, "hanzi">[] },
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
  /** Count of "again" grades ever recorded for this word (drives leech flag). */
  lapses: number;
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
          // Legacy pre-v8 stats may predate the lapse counter; default to 0 so
          // the DueCard contract's `lapses: number` never leaks `undefined`.
          lapses: stat.lapses ?? 0,
        });
      }
    }
  }
  return cards.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

// ─── Leech detection ──────────────────────────────────────────────────────────
//
// A "leech" is a word the learner keeps failing: it has lapsed (been graded
// "again") enough times to signal it isn't sticking, yet its review interval
// hasn't climbed back to mastery. This is the SRS-failure complement to the
// quiz-accuracy "tricky"/weak-word signal above — a separate, additive signal
// over `flashcardStats` rather than `quizStats`.
//
// Threshold 4 (rather than Anki's classic 8) because this app's decks are 10
// words per topic with short intervals: four failed reviews is already a strong
// "not sticking" signal at this scale. It's a single named constant, tunable in
// one place.
export const LEECH_LAPSE_THRESHOLD = 4;

// True iff the given stat has lapsed at least LEECH_LAPSE_THRESHOLD times AND
// its interval is still below mastery. Reaching MASTERED_INTERVAL_DAYS graduates
// a word off the leech list (no explicit un-flag or reset needed). The input is
// normalized first so legacy/corrupt entries (including ones missing `lapses`)
// are handled per house style; `undefined` is never a leech.
export function isLeech(stat: FlashcardStat | undefined): boolean {
  if (!stat) return false;
  const s = normalizeStat(stat, new Date());
  return s.lapses >= LEECH_LAPSE_THRESHOLD && s.intervalDays < MASTERED_INTERVAL_DAYS;
}

// Every word across `topics` currently flagged as a leech, resolved to the same
// DueCard shape as `dueCards` but IGNORING the due date (a leech deserves focus
// whether or not it happens to be due). Sorted most-lapsed first, then oldest
// due date, then key — a stable, deterministic order. Pure; no clock needed
// beyond `isLeech`'s mastery check.
export function leechCards(
  topics: Topic[],
  flashcardStats: Record<string, FlashcardStat>,
): DueCard[] {
  const cards: DueCard[] = [];
  for (const topic of topics) {
    for (const item of topic.items) {
      const key = wordKey(topic, item);
      const stat = flashcardStats[key];
      if (stat && isLeech(stat)) {
        cards.push({
          topicSlug: topic.slug,
          topicTitle: topic.titleEn,
          hanzi: item.hanzi,
          pinyin: item.pinyin,
          english: item.english,
          key,
          dueAt: stat.dueAt,
          intervalDays: stat.intervalDays,
          lapses: stat.lapses ?? 0,
        });
      }
    }
  }
  return cards.sort(
    (a, b) =>
      b.lapses - a.lapses ||
      new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
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
  return { intervalDays: 0, ease: DEFAULT_EASE, dueAt: now.toISOString(), reviewCount: 0, lapses: 0 };
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
  // A lapse is an "again" grade: the word slipped and had to be relearned. Only
  // this grade bumps the counter that drives leech detection; every other grade
  // preserves it.
  const lapses = stat.lapses + (grade === "again" ? 1 : 0);
  return { intervalDays, ease, dueAt: due.toISOString(), reviewCount: stat.reviewCount + 1, lapses };
}

// Learner-declared quick mastery. This is intentionally stronger than a first
// "easy" grade but not a permanent exemption: it moves the card to at least the
// mastery threshold, bumps ease gently, preserves lapse history, and keeps any
// already-longer interval instead of downgrading it.
export function markWordKnown(existing: FlashcardStat | undefined, now: Date): FlashcardStat {
  const stat = existing ? normalizeStat(existing, now) : defaultStat(now);
  const intervalDays = Math.max(stat.intervalDays, MASTERED_INTERVAL_DAYS);
  const ease = clampEase(stat.ease + EASE_DELTA.easy);
  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);
  return {
    intervalDays,
    ease,
    dueAt: due.toISOString(),
    reviewCount: stat.reviewCount + 1,
    lapses: stat.lapses,
  };
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

// Record one quiz answer into `day`'s tally, returning a NEW map (pure). The
// existing tally is normalized first so a corrupt entry can't corrupt the
// increment; `attempts` always rises and `correct` rises only on a right answer.
// The result is pruned to the newest DAILY_QUIZ_RETENTION_DAYS day-keys so
// storage stays bounded; ISO day keys sort chronologically. The input map is
// never mutated. Added in schema v11; mirrors recordDailyPractice.
export function recordDailyQuizAnswer(
  map: Record<string, QuizStat> | undefined,
  day: string,
  correct: boolean,
): Record<string, QuizStat> {
  const base = map && typeof map === "object" ? map : {};
  const prev = normalizeQuizStat(base[day]);
  const next: Record<string, QuizStat> = {
    ...base,
    [day]: { correct: prev.correct + (correct ? 1 : 0), attempts: prev.attempts + 1 },
  };
  const days = Object.keys(next).sort();
  if (days.length <= DAILY_QUIZ_RETENTION_DAYS) return next;
  const keep = new Set(days.slice(days.length - DAILY_QUIZ_RETENTION_DAYS));
  const pruned: Record<string, QuizStat> = {};
  for (const d of days) if (keep.has(d)) pruned[d] = next[d];
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

// ─── Streak freezes (schema v9) ────────────────────────────────────────────────

// True when `day`'s practiced count meets the CURRENT daily goal (0 goal never
// meets). NOTE: only the per-day practiced count is stored, not the goal that was
// in force that day — so past days are always evaluated against the goal set
// today. Lowering the goal can retroactively complete a goal-week; acceptable for
// a local, single-user app. `dailyActivity` retains DAILY_ACTIVITY_RETENTION_DAYS
// (14) days, so a 7-day lookback is always fully available.
export function goalMetOn(progress: ProgressState, day: string): boolean {
  const goal = progress.onboarding?.dailyGoal ?? 0;
  return goal > 0 && practicedCountOn(progress.dailyActivity, day) >= goal;
}

// Consecutive goal-met days ending on `today` (0 when today itself is unmet).
// Drives the "n of 7 goal days" freeze-progress copy. Uses the same 86400000-ms
// day stepping as computeStreak, capped implicitly by the retained activity
// window. `today` is injectable for tests.
export function consecutiveGoalDays(progress: ProgressState, today: string = todayISO()): number {
  let count = 0;
  let cursor = new Date(today).getTime();
  // Walk backward from today while each day meets the goal; stop at the first miss.
  while (goalMetOn(progress, isoDay(new Date(cursor)))) {
    count++;
    cursor -= 86400000;
    // Never look past the retained activity window — beyond it goalMetOn is
    // always false anyway, but bound the loop defensively.
    if (count > DAILY_ACTIVITY_RETENTION_DAYS) break;
  }
  return count;
}

// Pure earn check for the goal-met crossing. Awards one freeze token iff the goal
// was met on all GOAL_WEEK_DAYS days today..today-6, the stash is below
// MAX_STREAK_FREEZES, and the last award was null or ≥ GOAL_WEEK_DAYS days ago
// (so one hot week can't pay out daily). On award returns a NEW state with
// available+1 and lastEarnedOn = today; otherwise returns the INPUT OBJECT
// UNCHANGED (referential no-op, like recordBestCombo) so callers can detect a
// change for analytics. When blocked ONLY by the cap, lastEarnedOn is left
// untouched — the week isn't "spent". `today` is injectable for tests.
export function earnFreezeOnGoalMet(progress: ProgressState, today: string = todayISO()): ProgressState {
  const freezes = progress.streakFreezes;
  // Every day of the goal-week must be met.
  const todayMs = new Date(today).getTime();
  for (let i = 0; i < GOAL_WEEK_DAYS; i++) {
    if (!goalMetOn(progress, isoDay(new Date(todayMs - i * 86400000)))) return progress;
  }
  // Non-overlapping weeks: block a fresh award until 7 days after the last one.
  if (freezes.lastEarnedOn !== null) {
    const sinceLast = Math.round((todayMs - new Date(freezes.lastEarnedOn).getTime()) / 86400000);
    if (sinceLast < GOAL_WEEK_DAYS) return progress;
  }
  // Cap reached: no award AND don't stamp lastEarnedOn (the week isn't spent).
  if (freezes.available >= MAX_STREAK_FREEZES) return progress;
  return {
    ...progress,
    streakFreezes: {
      ...freezes,
      available: freezes.available + 1,
      lastEarnedOn: today,
    },
  };
}

// Pure load-time consumption: cover yesterday with a banked freeze iff exactly
// one day was missed. Consumes iff a token exists, yesterday (today-1) is in
// neither studiedDates nor frozenDates, and the day before (today-2) IS in that
// union — i.e. the streak was alive through T-2 and only yesterday is missing. A
// gap of 2+ days never consumes (the streak is already dead — don't waste a
// token). On consume returns a NEW state with yesterday appended to frozenDates
// (kept sorted) and available-1; otherwise returns the INPUT OBJECT UNCHANGED so
// the hook can detect the change for analytics. `today` is injectable for tests.
export function applyStreakFreeze(progress: ProgressState, today: string = todayISO()): ProgressState {
  const freezes = progress.streakFreezes;
  if (freezes.available <= 0) return progress;
  const todayMs = new Date(today).getTime();
  const yesterday = isoDay(new Date(todayMs - 86400000));
  const dayBefore = isoDay(new Date(todayMs - 2 * 86400000));
  const union = new Set([...progress.studiedDates, ...freezes.frozenDates]);
  // Only a single missed day is coverable: yesterday absent, day-before present.
  if (union.has(yesterday) || !union.has(dayBefore)) return progress;
  return {
    ...progress,
    streakFreezes: {
      ...freezes,
      available: freezes.available - 1,
      frozenDates: [...freezes.frozenDates, yesterday].sort(),
    },
  };
}

// studiedDates ∪ frozenDates (deduped). Feed to computeStreak / streakAtRisk so a
// spent freeze bridges its covered day; never used for daysStudied / heatmap.
export function studiedWithFreezes(progress: ProgressState): string[] {
  return Array.from(
    new Set([...(progress.studiedDates ?? []), ...(progress.streakFreezes?.frozenDates ?? [])]),
  );
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

// ─── Topic Boss Round (schema v7) ──────────────────────────────────────────────

// Record one completed Boss Round for topic `slug`, returning a NEW map (pure).
// `attempts` always increments; `bestScore` only ever rises (clamped to
// `total`); `crownedAt` is stamped the FIRST time a run passes every stage
// (`score === total`) and is never overwritten afterwards, so the original crown
// date is preserved even on later worse runs. The input map is never mutated.
export function recordBossResult(
  bossStats: Record<string, BossStat> | undefined,
  slug: string,
  score: number,
  total: number,
  now: Date = new Date(),
): Record<string, BossStat> {
  const base = bossStats && typeof bossStats === "object" ? bossStats : {};
  const prev = normalizeBossStat(base[slug]);
  const cappedScore = Math.max(0, Math.min(Math.round(score), Math.round(total)));
  const crowned = cappedScore === Math.round(total) && total > 0;
  return {
    ...base,
    [slug]: {
      bestScore: Math.max(prev.bestScore, cappedScore),
      attempts: prev.attempts + 1,
      // First crown wins: keep the earliest crown date once set.
      crownedAt: prev.crownedAt ?? (crowned ? now.toISOString() : null),
    },
  };
}

// True when topic `slug` has been crowned (a flawless Boss Round on record).
export function isCrowned(bossStats: Record<string, BossStat> | undefined, slug: string): boolean {
  return Boolean(bossStats?.[slug]?.crownedAt);
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
