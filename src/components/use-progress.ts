"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProgressState } from "@/lib/types";

const STORAGE_KEY = "learn-10-mandarin-progress-v1";

const emptyProgress: ProgressState = {
  learnedTopics: [],
  favoriteTopics: [],
  favoriteWords: [],
  flashcardStats: {},
};

function uniqueToggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
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

  return useMemo(() => ({
    progress,
    loaded,
    toggleLearnedTopic: (slug: string) => setProgress((current) => ({
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
      return {
        ...current,
        flashcardStats: {
          ...current.flashcardStats,
          [key]: { intervalDays, ease, dueAt: due.toISOString(), reviewCount: existing.reviewCount + 1 },
        },
      };
    }),
  }), [progress, loaded]);
}
