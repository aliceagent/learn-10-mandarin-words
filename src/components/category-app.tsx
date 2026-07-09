"use client";

import Link from "next/link";
import type { Category, Topic } from "@/lib/types";
import { masterySummary } from "@/lib/progress-logic";
import { downloadableMp4Url } from "@/lib/video";
import { useProgress } from "./use-progress";
import { useSavedLessons } from "./use-saved-lessons";
import { TopicCard } from "./topic-card";
import { SaveCategoryOfflineButton } from "./save-category-offline-button";

// Per-category browsing page: shows just the topics in one category using the
// same topic-card styling as the home library grid. Additive to the home page's
// search/filter — this is a standalone, focused view of a single category.
export function CategoryApp({ category, topics }: { category: Category; topics: Topic[] }) {
  const { progress, loaded, toggleFavoriteTopic } = useProgress();
  // Videos already in the offline cache — drives the card "✓ Offline" chips.
  const savedOffline = useSavedLessons();

  // Words-mastered summary across this category, derived from existing progress.
  const summary = masterySummary(topics, progress.flashcardStats, progress.quizStats);

  return (
    <main className="mobile-bottom-safe mx-auto max-w-7xl px-4 pt-5 md:px-10 md:pt-8">
      <Link href="/#categories" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
        ← All categories
      </Link>

      <div className="mt-5 md:mt-8">
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-400">
          Category
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:mt-4 md:text-5xl">{category.name}</h1>
        <p className="mt-2 max-w-2xl text-base text-slate-300 md:mt-3 md:text-lg">
          {topics.length} topic{topics.length !== 1 ? "s" : ""} · {topics.length * 10} words
        </p>
        {summary.total > 0 ? (
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/[0.08] px-3 py-1 text-sm font-semibold text-emerald-200">
            {summary.mastered} of {summary.total} words mastered
          </span>
        ) : null}
        <SaveCategoryOfflineButton
          categorySlug={category.slug}
          categoryName={category.name}
          topics={topics}
        />
      </div>

      {topics.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-white/10 bg-surface p-10 text-center">
          <p className="text-4xl">📭</p>
          <p className="mt-4 text-xl font-semibold text-white">No topics in this category yet</p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            Browse the library
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:mt-10 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {topics.map((topic) => (
            <TopicCard
              key={topic.slug}
              topic={topic}
              learned={progress.learnedTopics.includes(topic.slug)}
              favorite={progress.favoriteTopics.includes(topic.slug)}
              crowned={Boolean(progress.bossStats[topic.slug]?.crownedAt)}
              savedOffline={savedOffline.has(downloadableMp4Url(topic) ?? "")}
              flashcardStats={progress.flashcardStats}
              quizStats={progress.quizStats}
              onToggleFavorite={() => toggleFavoriteTopic(topic.slug)}
            />
          ))}
        </div>
      )}

      {!loaded ? (
        <p className="sr-only" aria-live="polite">
          Loading your saved progress…
        </p>
      ) : null}
    </main>
  );
}
