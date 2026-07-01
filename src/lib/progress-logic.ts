import type { FlashcardStat, ProgressState } from "./types";

// Pure progress helpers, extracted from use-progress.ts so they can be
// unit-tested without React. The hook imports these and layers persistence /
// setState on top; the logic here never touches the DOM or localStorage.

export const emptyProgress: ProgressState = {
  learnedTopics: [],
  favoriteTopics: [],
  favoriteWords: [],
  flashcardStats: {},
  studiedDates: [],
  onboarding: { completed: false, dailyGoal: 0, completedAt: null },
};

// Merge stored data over defaults without dropping the nested onboarding shape
// (older saves predate the onboarding field, and imports may omit it).
export function normalizeProgress(partial: Partial<ProgressState>): ProgressState {
  return {
    ...emptyProgress,
    ...partial,
    onboarding: { ...emptyProgress.onboarding, ...(partial.onboarding ?? {}) },
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

export type Grade = "again" | "hard" | "good" | "easy";

// The stat used for a word's very first review.
export function defaultStat(now: Date): FlashcardStat {
  return { intervalDays: 0, ease: 2.5, dueAt: now.toISOString(), reviewCount: 0 };
}

// SRS interval + ease update. `now` is injectable so scheduling is deterministic
// in tests; the hook passes the real clock.
export function scheduleReview(existing: FlashcardStat, grade: Grade, now: Date): FlashcardStat {
  const intervalDays =
    grade === "again"
      ? 1
      : grade === "hard"
        ? Math.max(1, existing.intervalDays + 1)
        : grade === "good"
          ? Math.max(2, existing.intervalDays * 2 || 2)
          : Math.max(4, existing.intervalDays * 3 || 4);
  const ease = Math.max(1.3, existing.ease + (grade === "easy" ? 0.15 : grade === "again" ? -0.2 : 0));
  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);
  return { intervalDays, ease, dueAt: due.toISOString(), reviewCount: existing.reviewCount + 1 };
}
