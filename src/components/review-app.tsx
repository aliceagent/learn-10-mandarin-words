"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MandarinData } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { useProgress } from "./use-progress";
import { SpeakButton } from "./speak-button";

type ReviewCard = {
  topicSlug: string;
  topicTitle: string;
  hanzi: string;
  pinyin: string;
  english: string;
  key: string;
  dueAt: string;
  intervalDays: number;
};

export function ReviewApp({ data }: { data: MandarinData }) {
  const { progress, loaded, gradeWord } = useProgress();
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  const dueCards = useMemo<ReviewCard[]>(() => {
    const now = new Date();
    const cards: ReviewCard[] = [];
    for (const topic of data.topics) {
      for (const item of topic.items) {
        const key = wordKey(topic, item);
        const stat = progress.flashcardStats[key];
        if (stat && new Date(stat.dueAt) <= now) {
          cards.push({
            topicSlug: topic.slug,
            topicTitle: topic.titleEn,
            hanzi: item.hanzi,
            pinyin: item.pinyin,
            english: item.english,
            key,
            dueAt: stat.dueAt,
            intervalDays: stat.intervalDays,
          });
        }
      }
    }
    // Sort by most overdue first
    return cards.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [data.topics, progress.flashcardStats]);

  const totalDue = dueCards.length;
  const current = dueCards[cardIndex];

  function handleGrade(grade: "again" | "hard" | "good" | "easy") {
    if (!current) return;
    gradeWord(current.key, grade);
    setRevealed(false);
    if (cardIndex + 1 >= totalDue) {
      setDone(true);
    } else {
      setCardIndex((v) => v + 1);
    }
  }

  if (!loaded) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <p className="text-slate-400">Loading progress…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">Back to library</Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Daily Review</h1>
        <p className="mt-3 text-lg text-slate-300">
          {totalDue > 0
            ? `${totalDue} card${totalDue !== 1 ? "s" : ""} due for review today.`
            : "No cards are due for review right now."}
        </p>
      </div>

      {totalDue === 0 ? (
        <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.045] p-10 text-center">
          <p className="text-5xl">✓</p>
          <p className="mt-4 text-2xl font-semibold text-white">All caught up!</p>
          <p className="mt-3 text-slate-400">
            Study words in any topic to build your review queue. Cards reappear based on spaced repetition.
          </p>
          <Link href="/" className="mt-6 inline-block rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-300">
            Browse topics
          </Link>
        </div>
      ) : done ? (
        <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.045] p-10 text-center">
          <p className="text-5xl">🎉</p>
          <p className="mt-4 text-2xl font-semibold text-white">Session complete!</p>
          <p className="mt-3 text-slate-400">You reviewed {totalDue} card{totalDue !== 1 ? "s" : ""}. Come back tomorrow for more.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => { setCardIndex(0); setRevealed(false); setDone(false); }}
              className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white hover:border-emerald-300"
            >
              Review again
            </button>
            <Link href="/" className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-300">
              Go home
            </Link>
          </div>
        </div>
      ) : (
        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center" aria-label="Review flashcard">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
            <span>Card {cardIndex + 1} of {totalDue}</span>
            <Link href={`/topics/${current.topicSlug}`} className="text-emerald-300 hover:text-emerald-200">
              {current.topicTitle}
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <h2 className="text-7xl font-semibold text-white">{current.hanzi}</h2>
            <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
          </div>

          {revealed ? (
            <div className="mt-6">
              <p className="text-2xl text-emerald-300">{current.pinyin}</p>
              <p className="mt-2 text-xl text-slate-200">{current.english}</p>
              <p className="mt-4 text-xs text-slate-500">Current interval: {current.intervalDays}d</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950"
                aria-label="Reveal answer"
              >
                Reveal
              </button>
            ) : (
              (["again", "hard", "good", "easy"] as const).map((grade) => (
                <button
                  key={grade}
                  onClick={() => handleGrade(grade)}
                  className="rounded-full border border-white/15 px-5 py-3 font-semibold capitalize text-white hover:border-emerald-300"
                  aria-label={`Grade as ${grade}`}
                >
                  {grade}
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}
