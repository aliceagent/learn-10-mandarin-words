"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressState } from "@/lib/types";
import {
  computeStreak,
  defaultStat,
  emptyProgress,
  goalProgress,
  normalizeBestCombo,
  normalizeProgress,
  practicedCountOn,
  recordDailyChallenge,
  recordDailyPractice,
  scheduleReview,
  todayISO,
  uniqueToggle,
  updateQuizStats,
} from "@/lib/progress-logic";
import { track } from "@/lib/analytics";

export { computeStreak };

const STORAGE_KEY = "learn-10-mandarin-progress-v1";

function recordStudyToday(current: ProgressState): ProgressState {
  const today = todayISO();
  if (current.studiedDates.includes(today)) return current;
  return { ...current, studiedDates: [...current.studiedDates, today] };
}

// Shared choke point for every graded/practice interaction: stamp today's study
// date AND record `key` as a distinct word practiced today (schema v4). Fires the
// `daily_goal_met` analytics event exactly on the below-goal → at-goal crossing,
// decided by count-before vs. count-after so it can only fire once per day.
function withPractice(current: ProgressState, key: string): ProgressState {
  const today = todayISO();
  const goal = goalProgress(current, today);
  const before = practicedCountOn(current.dailyActivity, today);
  const dailyActivity = recordDailyPractice(current.dailyActivity, key, today);
  const after = practicedCountOn(dailyActivity, today);
  if (goal.goal > 0 && before < goal.goal && after >= goal.goal) {
    track("daily_goal_met", { goal: goal.goal, practiced: after });
  }
  return recordStudyToday({ ...current, dailyActivity });
}

export function useProgress() {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProgress(normalizeProgress(JSON.parse(stored)));
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [loaded, progress]);

  const exportProgress = useCallback(() => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mandarin-progress-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [progress]);

  const importProgress = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      setProgress(normalizeProgress(parsed));
    } catch {
      throw new Error("Invalid progress file");
    }
  }, []);

  return useMemo(() => ({
    progress,
    loaded,
    exportProgress,
    importProgress,
    toggleLearnedTopic: (slug: string) => setProgress((current) => recordStudyToday({
      ...current,
      learnedTopics: uniqueToggle(current.learnedTopics, slug),
    })),
    toggleFavoriteTopic: (slug: string) => setProgress((current) => ({
      ...current,
      favoriteTopics: uniqueToggle(current.favoriteTopics, slug),
    })),
    toggleFavoriteWord: (key: string) => setProgress((current) => ({
      ...current,
      favoriteWords: uniqueToggle(current.favoriteWords, key),
    })),
    completeOnboarding: (dailyGoal: number) => setProgress((current) => ({
      ...current,
      onboarding: { completed: true, dailyGoal, completedAt: todayISO() },
    })),
    skipOnboarding: () => setProgress((current) => ({
      ...current,
      onboarding: { ...current.onboarding, completed: true, completedAt: current.onboarding.completedAt ?? todayISO() },
    })),
    setDailyGoal: (dailyGoal: number) => setProgress((current) => ({
      ...current,
      onboarding: { ...current.onboarding, dailyGoal },
    })),
    recordQuizAnswer: (key: string, correct: boolean) => setProgress((current) => withPractice({
      ...current,
      quizStats: updateQuizStats(current.quizStats, key, correct),
    }, key)),
    // Persist the official Daily Challenge result for `day` (first completion
    // wins). NOT routed through withPractice: each answer already flows through
    // recordQuizAnswer above, which stamps studiedDates + dailyActivity — this
    // only records the once-a-day challenge outcome.
    recordDailyChallengeResult: (day: string, score: number, total: number) => setProgress((current) => ({
      ...current,
      dailyChallenge: recordDailyChallenge(current.dailyChallenge, day, {
        score,
        total,
        completedAt: new Date().toISOString(),
      }),
    })),
    // Raise the all-time best quiz combo to `combo` (monotonic max), so calling
    // it on every combo increment is idempotent-safe. Returns the state unchanged
    // when it wouldn't raise the best, avoiding a needless write. NOT routed
    // through withPractice — a combo isn't a distinctly practiced word; the
    // per-answer recordQuizAnswer already stamps study/goal state.
    recordBestCombo: (combo: number) => setProgress((current) => {
      const next = Math.max(current.bestQuizCombo, normalizeBestCombo(combo));
      return next === current.bestQuizCombo ? current : { ...current, bestQuizCombo: next };
    }),
    gradeWord: (key: string, grade: "again" | "hard" | "good" | "easy") => setProgress((current) => {
      const now = new Date();
      const existing = current.flashcardStats[key] ?? defaultStat(now);
      return withPractice({
        ...current,
        flashcardStats: {
          ...current.flashcardStats,
          [key]: scheduleReview(existing, grade, now),
        },
      }, key);
    }),
  }), [progress, loaded, exportProgress, importProgress]);
}
