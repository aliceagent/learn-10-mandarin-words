"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { MandarinData, ProgressState, Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { useProgress } from "./use-progress";
import { LoadingScreen } from "./loading-screen";
import { ProgressRing } from "./progress-ring";
import { GOAL_OPTIONS } from "./onboarding";
import { computeStats, computeWeakWords } from "@/lib/stats-logic";
import { goalProgress, masterySummary, streakAtRisk, type MasterySummary } from "@/lib/progress-logic";

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
  const { progress, loaded, setDailyGoal } = useProgress();

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

  // Per-category mastery, derived from existing flashcard + quiz stats. One row
  // per category (14 total); topics are resolved from the category's slug list.
  const categoryMastery = useMemo(() => {
    const bySlug = new Map(data.topics.map((topic) => [topic.slug, topic]));
    return data.categories.map((category) => {
      const topics = category.topics
        .map((slug) => bySlug.get(slug))
        .filter((topic): topic is Topic => topic != null);
      return {
        name: category.name,
        slug: category.slug,
        summary: masterySummary(topics, progress.flashcardStats, progress.quizStats),
      };
    });
  }, [data.categories, data.topics, progress.flashcardStats, progress.quizStats]);

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
        {streakAtRisk(progress.studiedDates ?? []) ? (
          <Link
            href="/review"
            className="rounded-full border border-amber-400/60 px-4 py-2 text-sm font-bold text-amber-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            🔥 {stats.streak}-day streak — practice today to keep it
          </Link>
        ) : stats.streak > 0 ? (
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
        <GoalCard progress={progress} setDailyGoal={setDailyGoal} />
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

      {/* ── Mastery by category (always rendered; zeros are informative) ── */}
      <section className="mt-10" aria-label="Mastery by category">
        <h2 className="text-xl font-semibold text-white">Mastery by category</h2>
        <p className="mt-1 text-sm text-slate-400">
          Words per category — mastered when their review interval reaches a week.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categoryMastery.map((cat) => (
            <CategoryMasteryCard key={cat.slug} name={cat.name} slug={cat.slug} summary={cat.summary} />
          ))}
        </div>
      </section>

      {/* ── Trickiest words (only once there's enough quiz history) ── */}
      {weakWords.length > 0 ? (
        <section className="mt-10" aria-label="Trickiest words">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Trickiest words</h2>
            <Link
              href="/practice"
              className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-5 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Practice these words
            </Link>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            The words you miss most in quizzes. Tap one to jump back to its topic, or practice them all in one
            focused deck.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Only words you&apos;ve answered at least three times in quizzes appear here, so a single unlucky guess
            never lands a word on the list.
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

// ── Compact per-category mastery card ─────────────────────────────────────────
// A ProgressRing (mastered / total words) with the category name and a learning
// · tricky sub-line, linking to the category page. Reuses the shared ProgressRing
// so the arc's motion is already reduced-motion-guarded in globals.css.
function CategoryMasteryCard({
  name,
  slug,
  summary,
}: {
  name: string;
  slug: string;
  summary: MasterySummary;
}) {
  return (
    <Link
      href={`/categories/${slug}`}
      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-white/[0.07]"
    >
      <ProgressRing
        value={summary.mastered}
        max={summary.total}
        size={64}
        label={`${name}: ${summary.mastered} of ${summary.total} words mastered`}
      >
        {summary.mastered}
      </ProgressRing>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{name}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {summary.mastered} of {summary.total} mastered
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {summary.learning} learning · {summary.tricky} tricky
        </p>
      </div>
    </Link>
  );
}

// ── Today's goal card with an editable daily goal ─────────────────────────────
// Spans the grid so the ring and the goal editor sit side by side. The chips
// reuse the exact GOAL_OPTIONS from onboarding; the numeric input covers any
// value 1–100. Both call setDailyGoal, which persists immediately via useProgress.
function GoalCard({
  progress,
  setDailyGoal,
}: {
  progress: ProgressState;
  setDailyGoal: (goal: number) => void;
}) {
  const goal = goalProgress(progress);
  const current = progress.onboarding.dailyGoal;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {current > 0 ? (
            <ProgressRing
              value={goal.practiced}
              max={goal.goal}
              size={80}
              label={`Daily goal: ${goal.practiced} of ${goal.goal} words practiced today`}
            >
              {goal.practiced}/{goal.goal}
            </ProgressRing>
          ) : (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 text-2xl"
              aria-hidden="true"
            >
              🎯
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-300">Today&apos;s goal</p>
            <p className="mt-0.5 text-lg font-semibold text-white">
              {current > 0
                ? goal.met
                  ? "Goal met 🎉"
                  : `${goal.practiced} of ${goal.goal} words`
                : "No daily goal set"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">distinct words practiced today</p>
          </div>
        </div>

        <div>
          <p id="daily-goal-label" className="mb-2 text-sm font-semibold text-slate-300">
            Daily goal
          </p>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-labelledby="daily-goal-label"
          >
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDailyGoal(opt.value)}
                aria-pressed={current === opt.value}
                className={`min-h-[44px] rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  current === opt.value
                    ? "border-emerald-300 bg-emerald-300/10 text-white"
                    : "border-white/10 text-slate-300 hover:border-emerald-300/60"
                }`}
              >
                {opt.label} {opt.value}
              </button>
            ))}
            <label className="flex min-h-[44px] items-center gap-2 text-xs text-slate-400">
              Custom
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={current > 0 ? current : ""}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (Number.isFinite(n) && n >= 1 && n <= 100) setDailyGoal(n);
                }}
                aria-label="Custom daily goal, 1 to 100 words"
                className="w-16 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
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
