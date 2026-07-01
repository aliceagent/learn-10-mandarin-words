"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MandarinData, Topic } from "@/lib/types";
import { useProgress } from "./use-progress";

function statLabel(value: number, label: string) {
  return `${value.toLocaleString()} ${label}`;
}

export function HomeApp({ data }: { data: MandarinData }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { progress } = useProgress();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.topics.filter((topic) => {
      const matchesCategory = category === "all" || topic.categorySlug === category;
      const haystack = [topic.titleEn, topic.titleCn, topic.category, ...topic.items.flatMap((item) => [item.hanzi, item.pinyin, item.english])].join(" ").toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [category, data.topics, query]);

  const learnedCount = progress.learnedTopics.length;
  const favoriteCount = progress.favoriteWords.length + progress.favoriteTopics.length;

  return (
    <main>
      <section className="mx-auto grid min-h-[88dvh] max-w-7xl items-center gap-10 px-6 py-12 md:grid-cols-[1.05fr_0.95fr] md:px-10">
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
            <a href="#practice" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300/70">
              See practice tools
            </a>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur">
          <div className="rounded-[1.5rem] bg-slate-950 p-5">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-sm font-semibold text-slate-300">Today&apos;s learning map</span>
              <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">Local first</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric value={statLabel(data.categories.length, "categories")} label="Global-friendly sections" />
              <Metric value={statLabel(data.topics.length, "videos")} label="Ten-word lessons" />
              <Metric value={statLabel(data.topics.length * 10, "words")} label="Flashcard-ready items" />
              <Metric value={statLabel(learnedCount, "learned")} label={`${favoriteCount} saved favorites`} />
            </div>
          </div>
        </div>
      </section>

      <section id="practice" className="border-y border-white/10 bg-slate-950/70 px-6 py-12 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          <Feature title="Video lessons" body="Each topic gets one short drill video with Chinese, pinyin, and English." />
          <Feature title="Matching quizzes" body="Pair hanzi with English and pinyin to make recall active." />
          <Feature title="Flashcards" body="Reveal answers, grade difficulty, and build a lightweight review queue." />
          <Feature title="Progress tracking" body="Favorite words, save lists, and mark topics as learned in your browser." />
        </div>
      </section>

      <section id="library" className="mx-auto max-w-7xl px-6 py-14 md:px-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Vocabulary library</h2>
            <p className="mt-3 max-w-2xl text-slate-400">Filter by category, search any Chinese word, and jump into a topic lesson.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words, pinyin, English"
              className="min-w-72 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
            >
              <option value="all">All categories</option>
              {data.categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((topic) => <TopicCard key={topic.slug} topic={topic} learned={progress.learnedTopics.includes(topic.slug)} favorite={progress.favoriteTopics.includes(topic.slug)} />)}
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-2xl font-semibold text-white">{value}</div><div className="mt-1 text-sm text-slate-400">{label}</div></div>;
}

function Feature({ title, body }: { title: string; body: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div>;
}

function TopicCard({ topic, learned, favorite }: { topic: Topic; learned: boolean; favorite: boolean }) {
  return (
    <Link href={`/topics/${topic.slug}`} className="group rounded-3xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-white/[0.07]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{topic.category}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{topic.titleEn}</h3>
          <p className="mt-1 text-xl font-medium text-emerald-300">{topic.titleCn}</p>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          {favorite ? <span className="rounded-full bg-amber-300 px-2 py-1 text-slate-950">Saved</span> : null}
          {learned ? <span className="rounded-full bg-emerald-300 px-2 py-1 text-slate-950">Learned</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {topic.items.slice(0, 5).map((item) => <span key={item.hanzi} className="rounded-full bg-slate-900 px-3 py-1 text-sm text-slate-300">{item.hanzi}</span>)}
      </div>
      <p className="mt-5 text-sm font-semibold text-emerald-300">Open lesson</p>
    </Link>
  );
}
