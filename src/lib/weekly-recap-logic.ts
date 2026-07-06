// Pure, DOM-free derivation for the /stats "This week" weekly recap card
// (Sprint 15). It reads ONLY progress fields the app already persists —
// `dailyActivity` (day → distinct wordKeys), `studiedDates` (ISO UTC days, full
// history), and `dailyQuiz` (day → QuizStat, schema v11) — and turns them into a
// trailing-7-day summary: distinct words practiced, quiz accuracy, active days,
// and current streak. No schema change beyond dailyQuiz, no network, no DOM.
//
// Everything uses the app-wide UTC-day convention (`todayISO()` →
// `toISOString().slice(0, 10)`), the same one the streak/goal/heatmap already
// use, so the recap stays in lock-step rather than drifting a day for users far
// from UTC. Injectable `endDay` keeps it deterministic under tests.

// Value imports need the explicit `.ts` extension so they resolve under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors heatmap-logic.ts.
import { computeStreak, normalizeQuizStat, todayISO } from "./progress-logic.ts";
import type { ProgressState } from "./types.ts";

// Whole day in milliseconds — the same constant computeStreak / the heatmap use
// for consecutive-day arithmetic. UTC days have no DST, so fixed-ms math is exact.
const DAY_MS = 86_400_000;

// The recap window: the trailing 7 UTC days, endDay inclusive. Exported so the
// dot row and any future surface share one source of truth.
export const RECAP_WINDOW_DAYS = 7;

// Short UTC month names, indexed by getUTCMonth(). Hardcoded rather than derived
// via toLocaleString so the week label is deterministic and locale-independent
// (the pure logic must not depend on the host's Intl locale). Mirrors
// heatmap-logic's MONTH_NAMES idiom.
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export type WeeklyRecap = {
  /** Distinct wordKeys practiced across the window (union of daily sets). */
  wordsPracticed: number;
  /** Days in the window with a studiedDates entry, 0..7. */
  activeDays: number;
  /** Length-7 presence flags, oldest → newest (endDay last). */
  dayFlags: boolean[];
  /** Correct quiz answers summed across the window. */
  correct: number;
  /** Total quiz answers summed across the window. */
  attempts: number;
  /** correct / attempts in [0, 1]; null when attempts === 0 (days-only fallback). */
  accuracy: number | null;
  /** Current consecutive-day study streak anchored on endDay. */
  streak: number;
  /** Deterministic UTC label, e.g. "Jun 30 – Jul 6". */
  weekLabel: string;
};

// True for a well-formed ISO day string ("YYYY-MM-DD"). Reject junk defensively
// so a corrupt studiedDates / dailyActivity / dailyQuiz entry can never throw.
function isISODay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime());
}

// UTC midnight epoch-ms for an ISO day; ISO day string for an epoch-ms.
function dayMs(day: string): number {
  return new Date(day).getTime();
}
function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// "Jun 30" style label for one ISO day (UTC), locale-independent.
function shortDate(day: string): string {
  const d = new Date(day);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// Derive the trailing-7-UTC-day recap ending at `endDay` (inclusive). Never
// throws on corrupt/empty input: a bad endDay falls back to today, and every
// field defaults to its empty value. `endDay` is injectable for tests.
export function computeWeeklyRecap(
  progress: ProgressState,
  endDay: string = todayISO(),
): WeeklyRecap {
  const anchor = isISODay(endDay) ? endDay : todayISO();
  const endMs = dayMs(anchor);
  // Window days, oldest → newest, endDay last.
  const days: string[] = [];
  for (let i = RECAP_WINDOW_DAYS - 1; i >= 0; i--) days.push(isoDay(endMs - i * DAY_MS));

  const studiedSet = new Set(
    (Array.isArray(progress?.studiedDates) ? progress.studiedDates : []).filter(
      (d): d is string => typeof d === "string" && isISODay(d),
    ),
  );
  const activity =
    progress?.dailyActivity && typeof progress.dailyActivity === "object" ? progress.dailyActivity : {};
  const quiz = progress?.dailyQuiz && typeof progress.dailyQuiz === "object" ? progress.dailyQuiz : {};

  const words = new Set<string>();
  const dayFlags: boolean[] = [];
  let correct = 0;
  let attempts = 0;
  for (const day of days) {
    // Active days read studiedDates, NOT dailyActivity keys: a day can be studied
    // (e.g. via toggleLearnedTopic) without any dailyActivity entry — same caveat
    // heatmap-logic documents.
    dayFlags.push(studiedSet.has(day));
    const entry = activity[day];
    if (Array.isArray(entry)) for (const w of entry) if (typeof w === "string") words.add(w);
    const q = normalizeQuizStat(quiz[day]);
    correct += q.correct;
    attempts += q.attempts;
  }

  return {
    wordsPracticed: words.size,
    activeDays: dayFlags.filter(Boolean).length,
    dayFlags,
    correct,
    attempts,
    accuracy: attempts > 0 ? correct / attempts : null,
    streak: computeStreak(Array.from(studiedSet), anchor),
    weekLabel: `${shortDate(days[0])} – ${shortDate(days[days.length - 1])}`,
  };
}
