"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressState } from "@/lib/types";
import {
  computeStreak,
  defaultStat,
  emptyProgress,
  normalizeProgress,
  scheduleReview,
  todayISO,
  uniqueToggle,
  updateQuizStats,
} from "@/lib/progress-logic";

export { computeStreak };

const STORAGE_KEY = "learn-10-mandarin-progress-v1";

function recordStudyToday(current: ProgressState): ProgressState {
  const today = todayISO();
  if (current.studiedDates.includes(today)) return current;
  return { ...current, studiedDates: [...current.studiedDates, today] };
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
    recordQuizAnswer: (key: string, correct: boolean) => setProgress((current) => recordStudyToday({
      ...current,
      quizStats: updateQuizStats(current.quizStats, key, correct),
    })),
    gradeWord: (key: string, grade: "again" | "hard" | "good" | "easy") => setProgress((current) => {
      const now = new Date();
      const existing = current.flashcardStats[key] ?? defaultStat(now);
      return recordStudyToday({
        ...current,
        flashcardStats: {
          ...current.flashcardStats,
          [key]: scheduleReview(existing, grade, now),
        },
      });
    }),
  }), [progress, loaded, exportProgress, importProgress]);
}
