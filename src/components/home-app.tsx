"use client";

import Link from "next/link";
import { useRef, useMemo, useState } from "react";
import type { MandarinData, Topic } from "@/lib/types";
import { useProgress, computeStreak } from "./use-progress";

// Normalize diacritics so "nǐ", "ni", "ní" all match
function normalizePinyin(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function statLabel(value: number, label: string) {
  return `${value.toLocaleString()} ${label}`;
}

export function HomeApp({ data }: { data: MandarinData }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { progress, exportProgress, importProgress } = useProgress();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = normalizePinyin(query.trim());
    return data.topics.filter((topic) => {
      const matchesCategory = category === "all" || topic.categorySlug === category;
      if (!q) return matchesCategory;
      const haystack = normalizePinyin(
        [topic.titleEn, topic.titleCn, topic.category, ...topic.items.flatMap((item) => [item.hanzi, item.pinyin, item.english])].join(" ")
      );
      return matchesCategory && haystack.includes(q);
    });
  }, [category, data.topics, query]);

  const learnedCount = progress.learnedTopics.length;
  const favoriteCount = progress.favoriteWords.length + progress.favoriteTopics.length;
  const streak = computeStreak(progress.studiedDates ?? []);

  // Count cards studied total across all topics
  const studiedWordsCount = Object.values(progress.flashcardStats).filter((s) => s.reviewCount > 0).length;

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importProgress(ev.target?.result as string);
      } catch {
        alert("Could not import: invalid progress file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <main>
      <section className="mx-auto grid min-h-[88dvh] max-w-7xl items-center gap-10 px-6 py-12 pb-24 md:grid-cols-[1.05fr_0.95fr] md:px-10 md:pb-12">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
            100 Mandarin vocab lists. 1,000 words. One clean habit.
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
            Learn 10 Mandarin Words
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Watch short vocabulary lessons, practice with matching quizzes, save favorite words, and mark each list as learned.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#library" className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
              Browse library
            </a>
            <Link href="/review" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300/70">
              Daily review
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur">
          <div className="rounded-[1.5rem] bg-slate-950 p-5">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-sm font-semibold text-slate-300">Today&apos;s learning map</span>
              {streak > 0 ? (
                <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950" aria-label={`${streak} day streak`}>
                  {streak}d streak
                </span>
              ) : (
                <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">Local first</span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric value={statLabel(data.categories.length, "categories")} label="Global-friendly sections" />
              <Metric value={statLabel(data.topics.length, "topics")} label="Ten-word lessons" />
              <Metric value={statLabel(studiedWordsCount, "studied")} label={`of ${data.topics.length * 10} words`} />
              <Metric value={statLabel(learnedCount, "learned")} label={`${favoriteCount} saved favorites`} />
            </div>
            <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
              <button
                onClick={exportProgress}
                className="flex-1 rounded-2xl border border-white/10 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
                aria-label="Export progress as JSON"
              >
                Export progress
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-2xl border border-white/10 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
                aria-label="Import progress from JSON file"
              >
                Import progress
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="sr-only"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="practice" className="border-y border-white/10 bg-slate-950/70 px-6 py-12 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          <Feature title="Video lessons" body="Each topic gets one short drill video with Chinese, pinyin, and English." />
          <Feature title="Matching quizzes" body="Three quiz modes: Hanzi→English, English→Hanzi, and Hanzi→Pinyin." />
          <Feature title="Flashcards" body="Reveal answers, grade difficulty, and build a spaced-repetition review queue." />
          <Feature title="Progress tracking" body="Favorite words, save lists, streak tracking, and export your progress as JSON." />
        </div>
      </section>

      <section id="library" className="mx-auto max-w-7xl px-6 py-14 pb-24 md:px-10 md:pb-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Vocabulary library</h2>
            <p className="mt-3 max-w-2xl text-slate-400">Filter by category, search any Chinese word or pinyin, and jump into a topic lesson.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words, pinyin, English"
              aria-label="Search vocabulary"
              className="min-w-72 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
            >
              <option value="all">All categories</option>
              {data.categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-slate-400">No topics match your search.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((topic) => (
              <TopicCard
                key={topic.slug}
                topic={topic}
                learned={progress.learnedTopics.includes(topic.slug)}
                favorite={progress.favoriteTopics.includes(topic.slug)}
                flashcardStats={progress.flashcardStats}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function TopicCard({
  topic,
  learned,
  favorite,
  flashcardStats,
}: {
  topic: Topic;
  learned: boolean;
  favorite: boolean;
  flashcardStats: Record<string, { reviewCount: number }>;
}) {
  const studiedCount = topic.items.filter((item) => {
    const key = `${topic.slug}:${item.hanzi}`;
    return (flashcardStats[key]?.reviewCount ?? 0) > 0;
  }).length;

  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="group rounded-3xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-white/[0.07]"
      aria-label={`${topic.titleEn} — ${topic.category}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{topic.category}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{topic.titleEn}</h3>
          <p className="mt-1 text-xl font-medium text-emerald-300">{topic.titleCn}</p>
          {studiedCount > 0 ? (
            <p className="mt-1 text-xs text-slate-500">{studiedCount}/10 studied</p>
          ) : null}
        </div>
        <div className="flex gap-2 text-xs font-bold">
          {favorite ? <span className="rounded-full bg-amber-300 px-2 py-1 text-slate-950">Saved</span> : null}
          {learned ? <span className="rounded-full bg-emerald-300 px-2 py-1 text-slate-950">Learned</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {topic.items.slice(0, 5).map((item) => <span key={item.hanzi} className="rounded-full bg-slate-900 px-3 py-1 text-sm text-slate-300">{item.hanzi}</span>)}
      </div>
      <p className="mt-5 text-sm font-semibold text-emerald-300 group-hover:underline">Open lesson</p>
    </Link>
  );
}

