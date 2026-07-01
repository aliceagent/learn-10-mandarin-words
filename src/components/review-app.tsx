"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { MandarinData } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { track } from "@/lib/analytics";
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

// ─── Touch swipe hook ─────────────────────────────────────────────────────────

function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) onLeft();
    else onRight();
  }, [onLeft, onRight]);

  return { onTouchStart, onTouchEnd };
}

// ─── Main component ───────────────────────────────────────────────────────────

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
      track("review_completed", { count: totalDue });
    } else {
      setCardIndex((v) => v + 1);
    }
  }

  // Swipe: right = easy, left = again (when revealed)
  const swipe = useSwipe(
    () => { if (revealed) handleGrade("again"); },
    () => { if (revealed) handleGrade("easy"); else setRevealed(true); }
  );

  if (!loaded) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <p className="text-slate-400">Loading progress…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Daily Review</h1>
        <p className="mt-3 text-lg text-slate-300">
          {totalDue > 0
            ? `${totalDue} card${totalDue !== 1 ? "s" : ""} due for review today.`
            : "No cards are due for review right now."}
        </p>
      </div>

      {/* ── Empty state: no cards due ── */}
      {totalDue === 0 ? (
        <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.045] p-10 text-center">
          <p className="text-5xl">✓</p>
          <p className="mt-4 text-2xl font-semibold text-white">All caught up!</p>
          <p className="mt-3 max-w-sm mx-auto text-slate-400">
            No cards are due right now. Study a topic and grade words with the flashcard trainer to build your review queue.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-300 transition">
              Browse topics
            </Link>
            <Link href="/favorites" className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white hover:border-emerald-300 transition">
              My favorites
            </Link>
          </div>
        </div>
      ) : done ? (
        /* ── Session complete celebration ── */
        <div className="animate-celebrate mt-12 rounded-[2rem] border border-white/10 bg-white/[0.045] p-10 text-center">
          <p className="text-6xl">🎉</p>
          <p className="mt-4 text-2xl font-semibold text-white">Session complete!</p>
          <p className="mt-3 text-slate-400">
            You reviewed {totalDue} card{totalDue !== 1 ? "s" : ""}. Great work — come back tomorrow for more.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => { setCardIndex(0); setRevealed(false); setDone(false); }}
              className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Review again
            </button>
            <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
              Learn more words
            </Link>
          </div>
        </div>
      ) : (
        /* ── Active review card ── */
        <section
          className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center"
          {...swipe}
          aria-label="Review flashcard"
          role="region"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>Card {cardIndex + 1} of {totalDue}</span>
              <div className="flex gap-2">
                <span className="swipe-hint">← again</span>
                <span className="swipe-hint">easy →</span>
              </div>
            </div>
            <Link href={`/topics/${current.topicSlug}`} className="text-sm text-emerald-300 hover:text-emerald-200 truncate max-w-32">
              {current.topicTitle}
            </Link>
          </div>

          {/* Progress bar through session */}
          <div className="progress-bar-track mt-3">
            <div className="progress-bar-fill" style={{ width: `${(cardIndex / totalDue) * 100}%` }} />
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <h2 className="font-hanzi text-7xl font-semibold text-white">{current.hanzi}</h2>
            <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
          </div>

          {revealed ? (
            <div className="mt-6 animate-celebrate">
              <p className="font-hanzi text-2xl text-emerald-300">{current.pinyin}</p>
              <p className="mt-2 text-xl text-slate-200">{current.english}</p>
              <p className="mt-4 text-xs text-slate-500">Current interval: {current.intervalDays}d</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                aria-label="Reveal answer"
              >
                Reveal
              </button>
            ) : (
              (["again", "hard", "good", "easy"] as const).map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => handleGrade(grade)}
                  className="min-h-[44px] rounded-full border border-white/15 px-5 py-3 font-semibold capitalize text-white transition hover:border-emerald-300"
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
