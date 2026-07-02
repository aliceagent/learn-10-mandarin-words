"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MandarinData } from "@/lib/types";
import { dueCards, formatIntervalDays, previewIntervals } from "@/lib/progress-logic";
import { track } from "@/lib/analytics";
import { useProgress } from "./use-progress";
import { useSwipe } from "./use-swipe";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";
import { Toast } from "./toast";

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewApp({ data }: { data: MandarinData }) {
  const { progress, loaded, gradeWord } = useProgress();
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  // Transient confirmation shown after grading a card.
  const [toast, setToast] = useState<string | null>(null);

  const cards = useMemo(
    () => dueCards(data.topics, progress.flashcardStats),
    [data.topics, progress.flashcardStats],
  );

  const totalDue = cards.length;
  const current = cards[cardIndex];
  // Projected next interval per grade for the current card, so grade buttons can
  // label what each grade would schedule (via previewIntervals — never re-derived).
  const gradePreviews = previewIntervals(current ? progress.flashcardStats[current.key] : undefined, new Date());

  function handleGrade(grade: "again" | "hard" | "good" | "easy") {
    if (!current) return;
    // Compute the projected interval BEFORE grading mutates the stat, so the
    // toast reports exactly what this grade scheduled.
    const days = previewIntervals(progress.flashcardStats[current.key], new Date())[grade];
    gradeWord(current.key, grade);
    setToast(`“${current.hanzi}” scheduled in ${formatIntervalDays(days)}`);
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
    return <LoadingScreen />;
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
                  className="flex min-h-[44px] flex-col items-center justify-center rounded-full border border-white/15 px-5 py-2 font-semibold text-white transition hover:border-emerald-300"
                  aria-label={`Grade as ${grade} — next review in ${gradePreviews[grade]} day${gradePreviews[grade] !== 1 ? "s" : ""}`}
                >
                  <span className="capitalize">{grade}</span>
                  <span className="text-[11px] font-normal text-slate-500" aria-hidden="true">
                    {formatIntervalDays(gradePreviews[grade])}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
