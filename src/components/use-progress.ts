"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressState } from "@/lib/types";

const STORAGE_KEY = "learn-10-mandarin-progress-v1";

const emptyProgress: ProgressState = {
  learnedTopics: [],
  favoriteTopics: [],
  favoriteWords: [],
  flashcardStats: {},
  studiedDates: [],
};

function uniqueToggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function recordStudyToday(current: ProgressState): ProgressState {
  const today = todayISO();
  if (current.studiedDates.includes(today)) return current;
  return { ...current, studiedDates: [...current.studiedDates, today] };
}

export function computeStreak(studiedDates: string[]): number {
  if (!studiedDates.length) return 0;
  const sorted = [...studiedDates].sort().reverse();
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
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

export function useProgress() {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProgress({ ...emptyProgress, ...JSON.parse(stored) });
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
      setProgress({ ...emptyProgress, ...parsed });
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
    gradeWord: (key: string, grade: "again" | "hard" | "good" | "easy") => setProgress((current) => {
      const existing = current.flashcardStats[key] ?? { intervalDays: 0, ease: 2.5, dueAt: new Date().toISOString(), reviewCount: 0 };
      const intervalDays = grade === "again" ? 1 : grade === "hard" ? Math.max(1, existing.intervalDays + 1) : grade === "good" ? Math.max(2, existing.intervalDays * 2 || 2) : Math.max(4, existing.intervalDays * 3 || 4);
      const ease = Math.max(1.3, existing.ease + (grade === "easy" ? 0.15 : grade === "again" ? -0.2 : 0));
      const due = new Date();
      due.setDate(due.getDate() + intervalDays);
      return recordStudyToday({
        ...current,
        flashcardStats: {
          ...current.flashcardStats,
          [key]: { intervalDays, ease, dueAt: due.toISOString(), reviewCount: existing.reviewCount + 1 },
        },
      });
    }),
  }), [progress, loaded, exportProgress, importProgress]);
}
