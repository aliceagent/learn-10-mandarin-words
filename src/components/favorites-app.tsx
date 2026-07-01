"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { MandarinData } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { useProgress } from "./use-progress";
import { SpeakButton } from "./speak-button";

export function FavoritesApp({ data }: { data: MandarinData }) {
  const { progress, loaded, toggleFavoriteWord, toggleFavoriteTopic } = useProgress();

  const favoriteTopics = useMemo(
    () => data.topics.filter((t) => progress.favoriteTopics.includes(t.slug)),
    [data.topics, progress.favoriteTopics]
  );

  const favoriteWords = useMemo(() => {
    const results: Array<{ hanzi: string; pinyin: string; english: string; topicSlug: string; topicTitle: string; key: string }> = [];
    for (const topic of data.topics) {
      for (const item of topic.items) {
        const key = wordKey(topic, item);
        if (progress.favoriteWords.includes(key)) {
          results.push({ ...item, topicSlug: topic.slug, topicTitle: topic.titleEn, key });
        }
      }
    }
    return results;
  }, [data.topics, progress.favoriteWords]);

  const isEmpty = favoriteTopics.length === 0 && favoriteWords.length === 0;

  if (!loaded) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <p className="text-slate-400">Loading favorites…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">Back to library</Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Favorites</h1>
        <p className="mt-3 text-lg text-slate-300">
          {isEmpty ? "You haven't saved anything yet." : `${favoriteTopics.length} saved list${favoriteTopics.length !== 1 ? "s" : ""} · ${favoriteWords.length} saved word${favoriteWords.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {isEmpty ? (
        <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.045] p-10 text-center">
          <p className="text-2xl font-semibold text-white">Nothing saved yet</p>
          <p className="mt-3 text-slate-400">Save topics and words while studying to see them here.</p>
          <Link href="/" className="mt-6 inline-block rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-300">
            Browse topics
          </Link>
        </div>
      ) : null}

      {favoriteTopics.length > 0 ? (
        <section className="mt-10" aria-label="Saved lists">
          <h2 className="mb-4 text-xl font-semibold text-white">Saved Lists</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favoriteTopics.map((topic) => (
              <div key={topic.slug} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">{topic.category}</p>
                    <Link href={`/topics/${topic.slug}`} className="mt-1 block text-xl font-semibold text-white hover:text-emerald-300">
                      {topic.titleEn}
                    </Link>
                    <p className="mt-1 text-lg text-emerald-300">{topic.titleCn}</p>
                  </div>
                  <button
                    onClick={() => toggleFavoriteTopic(topic.slug)}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-rose-300 hover:text-rose-300"
                    aria-label={`Remove ${topic.titleEn} from saved lists`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {favoriteWords.length > 0 ? (
        <section className="mt-10" aria-label="Saved words">
          <h2 className="mb-4 text-xl font-semibold text-white">Saved Words</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favoriteWords.map((word) => (
              <div key={word.key} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <div>
                      <p className="text-3xl font-semibold text-white">{word.hanzi}</p>
                      <p className="mt-1 text-base text-emerald-300">{word.pinyin}</p>
                      <p className="mt-1 font-semibold text-slate-200">{word.english}</p>
                      <Link href={`/topics/${word.topicSlug}`} className="mt-1 block text-xs text-slate-500 hover:text-emerald-300">
                        {word.topicTitle}
                      </Link>
                    </div>
                    <SpeakButton text={word.hanzi} label={`Pronounce ${word.hanzi}`} />
                  </div>
                  <button
                    onClick={() => toggleFavoriteWord(word.key)}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-rose-300 hover:text-rose-300"
                    aria-label={`Remove ${word.english} from favorites`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
