"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { MandarinData } from "@/lib/types";
import { dueCards } from "@/lib/progress-logic";
import { COMEBACK_DECK_SIZE, comebackDeck } from "@/lib/comeback-logic";
import {
  gradeCard,
  isSessionComplete,
  startSession,
  type ReviewSession,
} from "@/lib/session-logic";
import { track } from "@/lib/analytics";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { useProgress } from "./use-progress";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";
import { ToneColorsToggle } from "./tone-colors-toggle";
import { TonePinyin } from "./tone-pinyin";

// The comeback warm-up: a calm, confidence-first pass over a handful of words the
// learner already mastered, offered when they return after a week+ away. It reuses
// the pure ReviewSession machine (so a "Forgot" word repeats in-session via
// AGAIN_GAP) and the real gradeWord SM-2 path (so completing any card stamps
// today's study date and self-dismisses the home banner). Deliberately simpler
// than /review: no drag/fling, just Reveal → two gentle grades.

export function ComebackApp({ data }: { data: MandarinData }) {
  const { progress, loaded, gradeWord } = useProgress();

  // Snapshot the deck into a session exactly once, the moment progress loads —
  // the same adjust-state-while-rendering pattern as review-app. Grading mutates
  // flashcardStats; a live memo would rebuild the queue mid-run and desync the
  // position cursor. The deck is already capped, and startSession caps again.
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [revealed, setRevealed] = useState(false);
  if (loaded && session === null) {
    setSession(startSession(comebackDeck(data.topics, progress.flashcardStats), COMEBACK_DECK_SIZE));
  }

  const current = session ? session.queue[session.position] : undefined;

  const handleGrade = useCallback(
    (grade: "again" | "good") => {
      if (!session || !current) return;
      // Exactly one gradeWord per grading event (real SM-2 persistence); the
      // in-session requeue is handled separately by gradeCard.
      gradeWord(current.key, grade);
      setRevealed(false);
      const next = gradeCard(session, grade);
      setSession(next);
      if (isSessionComplete(next)) {
        // Report distinct words warmed up, not queue length (which grows with
        // "Forgot" requeues).
        track("comeback_completed", { count: new Set(next.queue.map((c) => c.key)).size });
      }
    },
    [session, current, gradeWord],
  );

  if (!loaded || !session) {
    return <LoadingScreen />;
  }

  const isEmpty = session.queue.length === 0;
  const complete = isSessionComplete(session);
  const total = session.queue.length;
  // Distinct words in this warm-up (stable across requeues) — drives the copy.
  const deckSize = new Set(session.queue.map((c) => c.key)).size;
  // Requeued "Forgot" cards still ahead of the cursor — the "to re-check" count.
  const remaining = session.queue.slice(session.position);
  const requeueCount = session.againKeys.filter((key) =>
    remaining.some((card) => card.key === key),
  ).length;
  // Live due count for the completion CTA (recomputed after grading).
  const dueCount = dueCards(data.topics, progress.flashcardStats).length;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Welcome back</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-300">
          {isEmpty
            ? "Study a topic and grade some flashcards first — we'll build your comeback session from words you've mastered."
            : `A gentle ${deckSize}-word warm-up from words you've mastered before. Then pick up right where you left off.`}
        </p>
      </div>

      {isEmpty ? (
        /* ── Empty state: nothing mastered/studied to warm up from ── */
        <div className="mt-12 rounded-3xl border border-white/10 bg-surface p-10 text-center">
          <p className="text-5xl">🌱</p>
          <p className="mt-4 text-2xl font-semibold text-white">Nothing to warm up yet</p>
          <p className="mt-3 max-w-sm mx-auto text-slate-400">
            Study a topic and grade some flashcards first — we&apos;ll build your comeback session from words you&apos;ve mastered.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-300 transition">
              Browse topics
            </Link>
          </div>
        </div>
      ) : complete ? (
        /* ── Completion celebration ── */
        <div className="animate-celebrate mt-12 rounded-3xl border border-white/10 bg-surface p-8 text-center md:p-10">
          <p className="text-6xl">🎉</p>
          <p className="mt-4 text-2xl font-semibold text-white">Warmed up!</p>
          <p className="mt-3 text-slate-400">
            You refreshed {deckSize} word{deckSize !== 1 ? "s" : ""}. That&apos;s the hard part done.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {dueCount > 0 ? (
              <Link href="/review" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
                Review {dueCount} due word{dueCount !== 1 ? "s" : ""}
              </Link>
            ) : (
              <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
                Browse topics
              </Link>
            )}
            <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300">
              Back to home
            </Link>
          </div>
        </div>
      ) : current ? (
        <>
          {/* Tone-colors preference for the pinyin on the card back. Device-local. */}
          <div className="mt-6 flex justify-end">
            <ToneColorsToggle />
          </div>

          {/* ── Active warm-up card ── */}
          <section
            className="mt-4 rounded-3xl border border-white/10 bg-surface p-6 text-center"
            aria-label="Warm-up flashcard"
            role="region"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span>Card {session.position + 1} of {total}</span>
                {requeueCount > 0 ? (
                  <span
                    className="rounded-full border border-amber-400/50 px-2 py-0.5 text-xs text-amber-300"
                    aria-label={`${requeueCount} word${requeueCount !== 1 ? "s" : ""} will repeat this session`}
                  >
                    {requeueCount} to re-check
                  </span>
                ) : null}
              </div>
              <Link href={`/topics/${current.topicSlug}`} className="text-sm text-emerald-300 hover:text-emerald-200 truncate max-w-32">
                {current.topicTitle}
              </Link>
            </div>

            {/* Progress bar through the warm-up */}
            <div className="progress-bar-track mt-3">
              <div className="progress-bar-fill" style={{ width: `${(session.position / total) * 100}%` }} />
            </div>

            {!revealed ? (
              /* Front: hanzi + speak, then reveal */
              <>
                <div className="mt-10 flex items-center justify-center gap-3">
                  <h2 lang={HANZI_LANG} className="font-hanzi text-7xl font-semibold text-white">{current.hanzi}</h2>
                  <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
                </div>
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                    aria-label="Reveal answer"
                  >
                    Reveal
                  </button>
                </div>
              </>
            ) : (
              /* Back: hanzi + pinyin + english, then two gentle grades */
              <>
                <div className="mt-8">
                  <p lang={HANZI_LANG} className="font-hanzi text-5xl font-semibold text-white">{current.hanzi}</p>
                  <p lang={PINYIN_LANG} className="mt-3 font-hanzi text-2xl text-emerald-300"><TonePinyin pinyin={current.pinyin} /></p>
                  <p className="mt-2 text-xl text-slate-200">{current.english}</p>
                </div>
                <div
                  className="mt-10 mx-auto flex max-w-md gap-3"
                  role="group"
                  aria-label="How well did you remember this word?"
                >
                  <button
                    type="button"
                    onClick={() => handleGrade("again")}
                    className="min-h-[44px] flex-1 rounded-full border border-rose-400/40 px-6 py-3 font-semibold text-rose-200 transition hover:bg-rose-400/10"
                    aria-label="I forgot this word — show it again soon"
                  >
                    Forgot
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrade("good")}
                    className="min-h-[44px] flex-1 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                    aria-label="I still know this word"
                  >
                    Got it
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
