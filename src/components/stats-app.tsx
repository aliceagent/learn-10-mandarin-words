"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { MandarinData, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { useProgress } from "./use-progress";
import { LoadingScreen } from "./loading-screen";
import { computeStats, computeWeakWords } from "@/lib/stats-logic";

type WeakWordRow = VocabItem & {
  topicSlug: string;
  topicTitle: string;
  accuracy: number;
  attempts: number;
};

// Local stats dashboard. Reads only the existing localStorage progress via
// useProgress and derives everything with the pure computeStats helper, so it
// renders without an account and tolerates a totally empty progress state.
export function StatsApp({
  data,
  totalTopics,
  totalWords,
}: {
  data: MandarinData;
  totalTopics: number;
  totalWords: number;
}) {
  const { progress, loaded } = useProgress();

  // computeStats defaults `now` to the real clock; recompute when progress changes.
  const stats = useMemo(() => computeStats(progress), [progress]);

  // Weakest quizzed words, resolved back to their word + topic for display.
  // computeWeakWords already filters to words with enough attempts, so an entry
  // whose key no longer matches the dataset is simply dropped.
  const weakWords = useMemo<WeakWordRow[]>(() => {
    const byKey = new Map<string, { item: VocabItem; topicSlug: string; topicTitle: string }>();
    for (const topic of data.topics) {
      for (const item of topic.items) {
        byKey.set(wordKey(topic, item), { item, topicSlug: topic.slug, topicTitle: topic.titleEn });
      }
    }
    const rows: WeakWordRow[] = [];
    for (const weak of computeWeakWords(progress.quizStats)) {
      const found = byKey.get(weak.key);
      if (!found) continue;
      rows.push({
        ...found.item,
        topicSlug: found.topicSlug,
        topicTitle: found.topicTitle,
        accuracy: weak.accuracy,
        attempts: weak.attempts,
      });
    }
    return rows;
  }, [data.topics, progress.quizStats]);

  if (!loaded) {
    return <LoadingScreen />;
  }

  const hasActivity =
    stats.learnedTopics > 0 ||
    stats.favoriteWords > 0 ||
    stats.favoriteTopics > 0 ||
    stats.wordsTracked > 0 ||
    stats.daysStudied > 0;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Your Stats</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-300">
            A local snapshot of your progress. Everything here is computed on your device from your saved
            progress — no account, no cloud.
          </p>
        </div>
        {stats.streak > 0 ? (
          <div className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2" aria-label={`${stats.streak} day streak`}>
            <span className="text-lg font-black text-slate-950">{stats.streak}</span>
            <span className="text-sm font-bold text-slate-950">day streak 🔥</span>
          </div>
        ) : null}
      </div>

      {!hasActivity ? (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.045] p-10 text-center">
          <p className="text-5xl">📊</p>
          <p className="mt-4 text-2xl font-semibold text-white">No stats yet</p>
          <p className="mt-3 mx-auto max-w-sm text-slate-400">
            Study a topic, favorite a few words, and grade some flashcards. Your progress will show up here —
            and it never leaves this device.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/path" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
              Start the path
            </Link>
            <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300">
              Browse topics
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Stat grid (always rendered so an empty state still shows zeros) ── */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          value={`${stats.learnedTopics}`}
          label={`of ${totalTopics} topics learned`}
          sublabel="marked as learned"
          progress={{ current: stats.learnedTopics, max: totalTopics }}
        />
        <StatCard
          value={`${stats.reviewedWords}`}
          label={`of ${totalWords} words reviewed`}
          sublabel="graded at least once"
          progress={{ current: stats.reviewedWords, max: totalWords }}
        />
        <StatCard
          value={`${stats.dueReviews}`}
          label="reviews due now"
          sublabel={stats.wordsTracked > 0 ? `${stats.wordsTracked} word${stats.wordsTracked !== 1 ? "s" : ""} in queue` : "flashcard queue"}
          href="/review"
        />
        <StatCard
          value={`${stats.favoriteWords}`}
          label={`favorite word${stats.favoriteWords !== 1 ? "s" : ""}`}
          sublabel={`${stats.favoriteTopics} favorite topic${stats.favoriteTopics !== 1 ? "s" : ""}`}
          href="/favorites"
        />
        <StatCard
          value={`${stats.totalReviews}`}
          label={`total review${stats.totalReviews !== 1 ? "s" : ""}`}
          sublabel="flashcards graded"
        />
        <StatCard
          value={`${stats.daysStudied}`}
          label={`day${stats.daysStudied !== 1 ? "s" : ""} studied`}
          sublabel={stats.streak > 0 ? `${stats.streak}-day current streak` : "build a streak by studying daily"}
        />
      </div>

      {/* ── Trickiest words (only once there's enough quiz history) ── */}
      {weakWords.length > 0 ? (
        <section className="mt-10" aria-label="Trickiest words">
          <h2 className="text-xl font-semibold text-white">Trickiest words</h2>
          <p className="mt-1 text-sm text-slate-400">
            The words you miss most in quizzes. Tap one to jump back to its topic and practice.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weakWords.map((word) => (
              <li key={`${word.topicSlug}:${word.hanzi}`}>
                <Link
                  href={`/topics/${word.topicSlug}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-white/[0.07]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-hanzi text-3xl font-semibold text-white">{word.hanzi}</p>
                      <p className="font-hanzi mt-1 text-base text-emerald-300">{word.pinyin}</p>
                      <p className="mt-1 font-semibold text-slate-200">{word.english}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold text-rose-300">{Math.round(word.accuracy * 100)}%</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {word.attempts} attempt{word.attempts !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 truncate text-xs text-slate-500">{word.topicTitle}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

// ── Stat card, optionally linked, with an optional progress bar ────────────────
// Mirrors the Metric card on the home page so the dashboard stays visually
// consistent with the existing dark theme.
function StatCard({
  value,
  label,
  sublabel,
  progress,
  href,
}: {
  value: string;
  label: string;
  sublabel?: string;
  progress?: { current: number; max: number };
  href?: string;
}) {
  const pct = progress ? Math.min(100, progress.max > 0 ? (progress.current / progress.max) * 100 : 0) : 0;
  const body = (
    <>
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-300">{label}</div>
      {sublabel ? <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div> : null}
      {progress && progress.max > 0 ? (
        <div className="progress-bar-track mt-3">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-white/[0.07]"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">{body}</div>;
}
