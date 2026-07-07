"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressState } from "@/lib/types";
import type { ResumableQuizMode, TopicMode } from "@/lib/topic-mode-logic";
import {
  applyStreakFreeze,
  computeStreak,
  defaultStat,
  earnFreezeOnGoalMet,
  emptyProgress,
  goalProgress,
  normalizeBestCombo,
  normalizeProgress,
  practicedCountOn,
  recordBossResult,
  recordDailyChallenge,
  recordDailyPractice,
  recordDailyQuizAnswer,
  recordLastActivity,
  recordRecentTopic,
  scheduleReview,
  todayISO,
  uniqueToggle,
  updateQuizStats,
} from "@/lib/progress-logic";
import { track } from "@/lib/analytics";
import { progressExportFilename } from "@/lib/settings-logic";

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
  const next = recordStudyToday({ ...current, dailyActivity });
  if (goal.goal > 0 && before < goal.goal && after >= goal.goal) {
    track("daily_goal_met", { goal: goal.goal, practiced: after });
    // On the once-a-day goal crossing, check whether it completed a 7-day
    // goal-week and banks a streak freeze. earnFreezeOnGoalMet is a referential
    // no-op unless a token is awarded, so this fires at most once per week.
    const earned = earnFreezeOnGoalMet(next, today);
    if (earned !== next) {
      track("streak_freeze_earned", { available: earned.streakFreezes.available });
      return earned;
    }
  }
  return next;
}

export function useProgress() {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Consume a banked freeze at load time if exactly one day was missed.
        // applyStreakFreeze is a referential no-op unless it covers yesterday, so
        // an unchanged state means nothing was spent.
        const normalized = normalizeProgress(JSON.parse(stored));
        const next = applyStreakFreeze(normalized, todayISO());
        if (next !== normalized) {
          track("streak_freeze_used", { remaining: next.streakFreezes.available });
        }
        setProgress(next);
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
    a.download = progressExportFilename(todayISO());
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
      // Also tally today's accuracy by day (schema v11) so the weekly recap card
      // can derive a trailing-7-day quiz accuracy. gradeWord is deliberately
      // excluded — accuracy is the quiz signal, same as the Trickiest words list.
      dailyQuiz: recordDailyQuizAnswer(current.dailyQuiz, todayISO(), correct),
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
    // Persist a completed Boss Round for `slug` (raises bestScore, bumps
    // attempts, crowns on a flawless run). NOT routed through withPractice: every
    // stage answer already flows through recordQuizAnswer, which stamps
    // studiedDates + dailyActivity — this only records the once-per-run outcome.
    recordBossResult: (slug: string, score: number, total: number) => setProgress((current) => ({
      ...current,
      bossStats: recordBossResult(current.bossStats, slug, score, total),
    })),
    // Record that the learner opened topic `slug`, moving it to the front of the
    // recent-topics shelf. Deliberately NOT routed through withPractice or
    // recordStudyToday: merely visiting a lesson is not practice and must never
    // affect streaks or the daily goal. Like recordBestCombo, returns the state
    // unchanged (referential no-op) when recordRecentTopic reports no change —
    // this is what keeps the recording effect in topic-app loop-free.
    recordTopicVisit: (slug: string) => setProgress((current) => {
      const recentTopics = recordRecentTopic(current.recentTopics, slug);
      return recentTopics === current.recentTopics ? current : { ...current, recentTopics };
    }),
    // Record the (topic, mode, quiz sub-mode) the learner just switched to as the
    // single "last activity" powering the home resume card (schema v12). Like
    // recordTopicVisit, this is deliberately NOT routed through withPractice or
    // recordStudyToday — switching a practice mode is not practice and must never
    // affect streaks or the daily goal. Returns the state unchanged (referential
    // no-op) when recordLastActivity reports no meaningful change, keeping the
    // recording effect in topic-app loop-free.
    recordLastActivity: (slug: string, mode: TopicMode, quizMode?: ResumableQuizMode) =>
      setProgress((current) => {
        const lastActivity = recordLastActivity(current.lastActivity, { slug, mode, quizMode });
        return lastActivity === current.lastActivity ? current : { ...current, lastActivity };
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
