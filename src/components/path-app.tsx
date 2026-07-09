"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { PathSection } from "@/lib/data";
import { nextRecommendedTopic } from "@/lib/data";
import { useProgress } from "./use-progress";
import { TopicCard } from "./topic-card";

// Guided learning path: a static, ordered curriculum through existing topics.
// Sections come straight from `pathSections` (server-computed, dataset-only).
// Local progress is layered in purely client-side — the next recommended topic
// is highlighted and each section shows how many of its topics are learned — so
// the page is fully useful with no account or backend.
export function PathApp({ sections }: { sections: PathSection[] }) {
  const { progress, loaded, toggleFavoriteTopic } = useProgress();
  const learned = useMemo(() => new Set(progress.learnedTopics), [progress.learnedTopics]);

  const nextTopic = useMemo(
    () => nextRecommendedTopic(progress.learnedTopics),
    [progress.learnedTopics]
  );

  const totalTopics = sections.reduce((sum, s) => sum + s.topics.length, 0);
  const learnedInPath = sections.reduce(
    (sum, s) => sum + s.topics.filter((t) => learned.has(t.slug)).length,
    0
  );

  return (
    <main className="mobile-bottom-safe mx-auto max-w-7xl px-6 pt-8 md:px-10">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
        ← Library
      </Link>

      <div className="mt-8">
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-400">
          Learning path
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          A guided path through Mandarin
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-300">
          A recommended order through the topics you already have — start with the essentials, then
          build up section by section. No account needed; your progress stays on this device.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {sections.length} sections · {totalTopics} topics
          {loaded && learnedInPath > 0 ? ` · ${learnedInPath} learned` : ""}
        </p>
      </div>

      {/* Continue CTA — the first not-yet-learned topic along the path. */}
      {loaded ? (
        <Link
          href={`/topics/${nextTopic.slug}`}
          className="mt-8 flex flex-col gap-1 rounded-3xl border border-emerald-300/30 bg-emerald-300/[0.06] p-6 transition hover:border-emerald-300/60 hover:bg-emerald-300/[0.1]"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            {learnedInPath > 0 ? "Continue where you left off" : "Start here"}
          </span>
          <span className="text-2xl font-semibold text-white">{nextTopic.titleEn}</span>
          <span className="font-hanzi text-lg text-emerald-200">{nextTopic.titleCn}</span>
          <span className="mt-1 text-sm font-semibold text-emerald-300">Open lesson →</span>
        </Link>
      ) : null}

      <div className="mt-12 space-y-14">
        {sections.map((section, index) => {
          const doneInSection = section.topics.filter((t) => learned.has(t.slug)).length;
          return (
            <section key={section.key} aria-labelledby={`path-${section.key}`}>
              <div className="flex items-start gap-4">
                <span
                  className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-sm font-bold text-emerald-300"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2
                    id={`path-${section.key}`}
                    className="text-2xl font-semibold tracking-tight text-white md:text-3xl"
                  >
                    {section.title}
                  </h2>
                  <p className="mt-1 text-slate-400">{section.blurb}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {section.topics.length} topic{section.topics.length !== 1 ? "s" : ""}
                    {loaded && doneInSection > 0 ? ` · ${doneInSection} learned` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.topics.map((topic) => (
                  <TopicCard
                    key={topic.slug}
                    topic={topic}
                    learned={learned.has(topic.slug)}
                    favorite={progress.favoriteTopics.includes(topic.slug)}
                    crowned={Boolean(progress.bossStats[topic.slug]?.crownedAt)}
                    flashcardStats={progress.flashcardStats}
                    onToggleFavorite={() => toggleFavoriteTopic(topic.slug)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {!loaded ? (
        <p className="sr-only" aria-live="polite">
          Loading your saved progress…
        </p>
      ) : null}
    </main>
  );
}
