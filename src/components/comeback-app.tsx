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
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>

      <div className="mt-4 md:mt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Welcome back</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300 md:mt-3 md:text-lg">
          {isEmpty
            ? "Study a topic and grade flashcards first. We will build this warm-up from words you have mastered."
            : `${deckSize}-word warm-up from words you have mastered before.`}
        </p>
      </div>

      {isEmpty ? (
        /* ── Empty state: nothing mastered/studied to warm up from ── */
        <div className="mt-8 rounded-3xl border border-white/10 bg-surface p-6 text-center md:mt-12 md:p-10">
          <p className="text-4xl md:text-5xl">🌱</p>
          <p className="mt-3 text-2xl font-semibold text-white md:mt-4">Nothing to warm up yet</p>
          <p className="mt-3 max-w-sm mx-auto text-slate-400">
            Review flashcards in any topic first, then come back for a quick warm-up.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 hover:bg-cta transition">
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
              <Link href="/review" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta">
                Review {dueCount} due word{dueCount !== 1 ? "s" : ""}
              </Link>
            ) : (
              <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta">
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
          <div className="mt-4 hidden justify-end md:flex">
            <ToneColorsToggle />
          </div>

          {/* ── Active warm-up card ── */}
          <section
            className="mt-4 rounded-3xl border border-white/10 bg-surface p-4 text-center md:p-6"
            aria-label="Warm-up flashcard"
            role="region"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400 md:gap-3 md:text-sm">
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
              <Link href={`/topics/${current.topicSlug}`} className="max-w-24 truncate text-xs text-emerald-300 hover:text-emerald-200 md:max-w-32 md:text-sm">
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
                <div className="mt-6 flex items-center justify-center gap-3 md:mt-10">
                  <h2 lang={HANZI_LANG} className="font-hanzi text-6xl font-semibold text-white md:text-7xl">{current.hanzi}</h2>
                  <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
                </div>
                <div className="mt-6 flex justify-center md:mt-10">
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-cta"
                    aria-label="Reveal answer"
                  >
                    Reveal
                  </button>
                </div>
              </>
            ) : (
              /* Back: hanzi + pinyin + english, then two gentle grades */
              <>
                <div className="mt-5 md:mt-8">
                  <p lang={HANZI_LANG} className="font-hanzi text-4xl font-semibold text-white md:text-5xl">{current.hanzi}</p>
                  <p lang={PINYIN_LANG} className="mt-2 font-hanzi text-xl text-emerald-300 md:mt-3 md:text-2xl"><TonePinyin pinyin={current.pinyin} /></p>
                  <p className="mt-2 text-lg text-slate-200 md:text-xl">{current.english}</p>
                </div>
                <div
                  className="mt-6 mx-auto flex max-w-md gap-3 md:mt-10"
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
                    className="min-h-[44px] flex-1 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
                    aria-label="I still know this word"
                  >
                    Got it
                  </button>
                </div>
              </>
            )}
          </section>
          <details className="mt-4 rounded-2xl border border-white/10 bg-surface-2 p-3 text-sm text-slate-300 md:hidden">
            <summary className="cursor-pointer list-none font-semibold text-white">Practice options</summary>
            <div className="mt-3">
              <ToneColorsToggle />
            </div>
          </details>
        </>
      ) : null}
    </main>
  );
}
