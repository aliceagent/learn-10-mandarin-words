"use client";

import Link from "next/link";
import type { FlashcardStat, TopicSummary } from "@/lib/types";
import { topicProgress } from "@/lib/progress-logic";

// Home "Jump back in" shelf: quick-resume cards for the last few topics the
// learner opened (Sprint 10). Purely presentational — the parent owns state and
// hands down already-resolved, already-capped topics (most-recent first),
// mirroring ContinueLearningCard. Renders nothing when there is no history, so
// first-time visitors see only the "Start here" CTA.
export function RecentTopicsShelf({
  topics,
  flashcardStats,
  onResume,
}: {
  /** Already resolved from slugs and capped (typically to 3), most-recent first. */
  topics: TopicSummary[];
  flashcardStats: Record<string, FlashcardStat>;
  onResume?: (slug: string, rank: number) => void;
}) {
  if (topics.length === 0) return null;

  return (
    <section className="mx-auto mt-8 max-w-7xl px-6 md:px-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
        Recently studied
      </p>
      <h2 className="mt-1 text-xl font-semibold text-white">Jump back in</h2>
      <p className="mt-1 text-sm text-slate-400">
        Pick up where you left off — your last topics, one tap away.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic, index) => {
          const { studied } = topicProgress(topic, flashcardStats);
          return (
            <Link
              key={topic.slug}
              href={`/topics/${topic.slug}`}
              aria-label={`Resume ${topic.titleEn}`}
              onClick={() => onResume?.(topic.slug, index)}
              className="group flex flex-col rounded-3xl border border-white/10 bg-surface p-5 transition hover:bg-surface-hover"
            >
              <p className="truncate font-semibold text-white">{topic.titleEn}</p>
              <p className="font-hanzi text-emerald-300">{topic.titleCn}</p>
              <p className="mt-1 text-xs text-slate-500">{studied}/10 studied</p>
              <p className="mt-3 text-sm font-semibold text-slate-300 transition group-hover:text-emerald-300">
                Resume →
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
