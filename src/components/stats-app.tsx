"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { MandarinData, ProgressState, Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data-logic";
import { useProgress } from "./use-progress";
import { useLightningBest } from "./use-lightning-best";
import { tierForScore } from "@/lib/lightning-logic";
import { LoadingScreen } from "./loading-screen";
import { ProgressRing } from "./progress-ring";
import { GoalEditor } from "./goal-editor";
import { computeStats, computeWeakWords } from "@/lib/stats-logic";
import { LEECH_LAPSE_THRESHOLD, MAX_STREAK_FREEZES } from "@/lib/progress-logic";
import {
  consecutiveGoalDays,
  goalProgress,
  GOAL_WEEK_DAYS,
  masterySummary,
  streakAtRisk,
  studiedWithFreezes,
  todayISO,
  type MasterySummary,
} from "@/lib/progress-logic";
import { computeAchievements } from "@/lib/achievements-logic";
import { computeWeeklyRecap, type WeeklyRecap } from "@/lib/weekly-recap-logic";
import type { ShareCardData } from "@/lib/share-card-logic";
import { AchievementShelf } from "./achievement-shelf";
import { StudyHeatmap } from "./study-heatmap";
import { ShareScoreButton } from "./share-score-button";

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
  // Device-local Lightning Round personal best, surfaced as a live stat card.
  const { best: lightningBest } = useLightningBest();

  // computeStats defaults `now` to the real clock; recompute when progress changes.
  const stats = useMemo(() => computeStats(progress), [progress]);

  // Trailing-7-day recap for the "This week" section + share card. Defaults its
  // endDay to today; recompute only when progress changes.
  const weeklyRecap = useMemo(() => computeWeeklyRecap(progress), [progress]);

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

  // Achievement badges derived purely from the persisted progress + dataset.
  // Same cost class as masterySummary (one pass over all words) and memoized so
  // it only recomputes when progress or the topic set changes.
  const achievements = useMemo(
    () => computeAchievements(progress, data.topics),
    [progress, data.topics],
  );

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

  // Streak-freeze surfaces: banked token count and whether yesterday was covered
  // by a spent freeze (drives the "your streak is safe" note).
  const freezeCount = progress.streakFreezes.available;
  const yesterdayISO = new Date(new Date(todayISO()).getTime() - 86400000).toISOString().slice(0, 10);
  const yesterdayFrozen = progress.streakFreezes.frozenDates.includes(yesterdayISO);

  const hasActivity =
    stats.learnedTopics > 0 ||
    stats.favoriteWords > 0 ||
    stats.favoriteTopics > 0 ||
    stats.wordsTracked > 0 ||
    stats.daysStudied > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:px-10 md:pb-12 md:pt-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-emerald-300 hover:text-emerald-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 md:mt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Your Stats</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 md:mt-3 md:text-lg">
            A local progress snapshot from this device. No account, no cloud.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {streakAtRisk(studiedWithFreezes(progress)) ? (
            <Link
              href="/review"
              className="rounded-full border border-amber-400/60 px-4 py-2 text-sm font-bold text-amber-300 transition hover:border-amber-300 hover:text-amber-200"
            >
              🔥 {stats.streak}-day streak. Practice today to keep it
            </Link>
          ) : stats.streak > 0 ? (
            <div className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2" aria-label={`${stats.streak} day streak`}>
              <span className="text-lg font-black text-slate-950">{stats.streak}</span>
              <span className="text-sm font-bold text-slate-950">day streak 🔥</span>
            </div>
          ) : null}
          {freezeCount > 0 ? (
            <span
              className="rounded-full border border-sky-400/60 px-4 py-2 text-sm font-bold text-sky-300"
              title="Covers one missed day automatically"
              aria-label={`${freezeCount} streak freeze${freezeCount === 1 ? "" : "s"} banked, covers one missed day automatically`}
            >
              ❄️ {freezeCount} streak freeze{freezeCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <ShareScoreButton
            surface="stats"
            data={{
              kind: "stats",
              streak: stats.streak,
              reviewedWords: stats.reviewedWords,
              totalWords,
              learnedTopics: stats.learnedTopics,
              daysStudied: stats.daysStudied,
            }}
          />
        </div>
      </div>

      {yesterdayFrozen ? (
        <p className="mt-4 text-sm font-semibold text-sky-300">
          ❄️ A streak freeze covered yesterday. Your streak is safe.
        </p>
      ) : null}

      {!hasActivity ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-surface p-5 text-center md:mt-10 md:p-10">
          <p className="text-3xl md:text-5xl">📊</p>
          <p className="mt-3 text-xl font-semibold text-white md:mt-4 md:text-2xl">No stats yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400 md:mt-3 md:text-base">
            Study a topic, favorite words, or grade flashcards. Your progress stays on this device.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:mt-6 md:flex md:flex-wrap md:justify-center">
            <Link href="/path" className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cta md:px-6 md:text-base">
              Start the path
            </Link>
            <Link href="/" className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-emerald-300 md:px-6 md:text-base">
              Browse topics
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Stat grid (always rendered so an empty state still shows zeros) ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 lg:grid-cols-3">
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
          value={`${stats.leechWords}`}
          label={`word${stats.leechWords !== 1 ? "s" : ""} flagged for rescue`}
          sublabel={`missed ${LEECH_LAPSE_THRESHOLD}+ reviews. Run a rescue drill`}
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
        <StatCard
          value={lightningBest.bestScore > 0 ? lightningBest.bestScore.toLocaleString() : "⚡"}
          label="lightning best"
          sublabel={
            lightningBest.bestScore > 0
              ? `${tierForScore(lightningBest.bestScore)?.name ? `${tierForScore(lightningBest.bestScore)!.name} tier · ` : ""}60-second challenge`
              : "try your first round"
          }
          href="/lightning"
        />
      </div>

      {/* ── This week recap (always rendered; the share button hides on an empty week) ── */}
      <section className="mt-10" aria-label="This week">
        <h2 className="text-xl font-semibold text-white">This week</h2>
        <p className="mt-1 text-sm text-slate-400">
          Your last 7 days, computed on this device. Share it as a card.
        </p>
        <ThisWeekCard recap={weeklyRecap} />
      </section>

      {/* ── Study activity heatmap (always rendered; a blank year is informative) ── */}
      <section className="mt-10" aria-label="Study activity">
        <h2 className="text-xl font-semibold text-white">Study activity</h2>
        <p className="mt-1 text-sm text-slate-400">
          {stats.daysStudied > 0
            ? "Every square is a day. One flashcard can light it up."
            : "A whole year of blank squares, and the first green one is a single flashcard away."}
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-surface p-5">
          <StudyHeatmap
            studiedDates={progress.studiedDates}
            dailyActivity={progress.dailyActivity}
            streak={stats.streak}
          />
          <p className="mt-4 text-xs text-slate-500">
            Word counts are kept for the last 14 days; older days show a single shade of green.
          </p>
        </div>
      </section>

      {/* ── Achievement shelf (always rendered; locked badges are informative) ── */}
      <AchievementShelf achievements={achievements} />

      {/* ── Mastery by category (always rendered; zeros are informative) ── */}
      <section className="mt-10" aria-label="Mastery by category">
        <h2 className="text-xl font-semibold text-white">Mastery by category</h2>
        <p className="mt-1 text-sm text-slate-400">
          Words per category, mastered when their review interval reaches a week.
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
              className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-5 py-2 font-semibold text-slate-950 transition hover:bg-cta"
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
                  className="block rounded-2xl border border-white/10 bg-surface p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-surface-hover"
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

// ── This week recap card ──────────────────────────────────────────────────────
// The four trailing-7-day figures, a presence-only day-dot row, and the weekly
// share button (which hides itself on an empty week). Accuracy falls back to "-"
// until quiz answers land this week, since the per-day tally starts empty at ship.
function ThisWeekCard({ recap }: { recap: WeeklyRecap }) {
  const accuracyLabel = recap.accuracy == null ? "-" : `${Math.round(recap.accuracy * 100)}%`;
  const data: ShareCardData = {
    kind: "weekly",
    wordsPracticed: recap.wordsPracticed,
    activeDays: recap.activeDays,
    dayFlags: recap.dayFlags,
    accuracy: recap.accuracy,
    streak: recap.streak,
    weekLabel: recap.weekLabel,
  };
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <WeekFigure value={`${recap.wordsPracticed}`} label="words practiced" />
          <WeekFigure value={accuracyLabel} label="quiz accuracy" />
          <WeekFigure value={`${recap.activeDays}/7`} label="days active" />
          <WeekFigure
            value={`${recap.streak}`}
            label={`day streak${recap.streak > 0 ? " 🔥" : ""}`}
          />
        </div>
        <ShareScoreButton surface="weekly" data={data} />
      </div>
      <div className="mt-5 flex items-center gap-2" aria-label={`${recap.activeDays} of 7 days active this week`}>
        {recap.dayFlags.map((active, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full ${active ? "bg-emerald-400" : "border border-white/15"}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Quiz accuracy counts answers from this week on this device.
      </p>
    </div>
  );
}

// One labelled figure inside the weekly recap card.
function WeekFigure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
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
      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-surface p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-surface-hover"
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
  const atFreezeCap = progress.streakFreezes.available >= MAX_STREAK_FREEZES;
  // Consecutive goal-met days, displayed capped at a full week.
  const goalDays = Math.min(consecutiveGoalDays(progress), GOAL_WEEK_DAYS);

  return (
    <div className="col-span-2 rounded-2xl border border-white/10 bg-surface p-4 md:p-5 lg:col-span-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:gap-5">
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
            {current > 0 ? (
              <p className="mt-1 text-xs text-sky-300/90">
                {atFreezeCap
                  ? `Freeze stash full. ${MAX_STREAK_FREEZES} ❄️ banked`
                  : `${goalDays} of ${GOAL_WEEK_DAYS} goal days toward a streak freeze ❄️`}
              </p>
            ) : null}
          </div>
        </div>

        <GoalEditor current={current} onChange={setDailyGoal} />
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
      <div className="text-2xl font-semibold text-white md:text-3xl">{value}</div>
      <div className="mt-1 text-xs font-medium leading-snug text-slate-300 md:text-sm">{label}</div>
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
        className="block min-h-[112px] rounded-2xl border border-white/10 bg-surface p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-surface-hover md:p-5"
      >
        {body}
      </Link>
    );
  }
  return <div className="min-h-[112px] rounded-2xl border border-white/10 bg-surface p-4 md:p-5">{body}</div>;
}
