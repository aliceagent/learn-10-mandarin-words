"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MandarinData } from "@/lib/types";
import { dueCards, formatIntervalDays, previewIntervals } from "@/lib/progress-logic";
import type { Grade } from "@/lib/progress-logic";
import {
  gradeCard,
  isSessionComplete,
  startSession,
  toughestCards,
  type ReviewSession,
} from "@/lib/session-logic";
import { dragTransform, FLING_THRESHOLD_PX, type FlingIntent } from "@/lib/gesture-logic";
import { track } from "@/lib/analytics";
import { useProgress } from "./use-progress";
import { useCardDrag } from "./use-card-drag";
import { useReducedMotion } from "./use-reduced-motion";
import { DeckDots } from "./deck-dots";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";
import { Toast } from "./toast";

// Longest queue that still shows deck-position dots; beyond this the progress
// bar alone conveys position (a row of 20+ dots is noise, not signal).
const DECK_DOT_MAX = 12;

// Grade tally chips shown on the completion summary, in scheduling order with a
// color per grade (never color alone — each chip also carries its label text).
const TALLY: { grade: Grade; label: string; className: string }[] = [
  { grade: "again", label: "Again", className: "border-rose-400/40 text-rose-300" },
  { grade: "hard", label: "Hard", className: "border-amber-400/40 text-amber-300" },
  { grade: "good", label: "Good", className: "border-slate-400/40 text-slate-200" },
  { grade: "easy", label: "Easy", className: "border-emerald-400/40 text-emerald-300" },
];

// Segments for the calmer segmented grade bar (Sprint 3): scheduling order with
// a semantic accent shown as a subtle 2px top rule (rose = again, amber = hard,
// slate = good/neutral, emerald = easy) rather than a loud full border on every
// button. Grade actions, labels, intervals, aria labels, and touch targets are
// all unchanged from the old pill buttons — only the container/skin differs.
const GRADE_SEGMENTS: { grade: Grade; rule: string }[] = [
  { grade: "again", rule: "border-rose-400/60" },
  { grade: "hard", rule: "border-amber-400/60" },
  { grade: "good", rule: "border-slate-400/50" },
  { grade: "easy", rule: "border-emerald-400/60" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewApp({ data }: { data: MandarinData }) {
  const { progress, loaded, gradeWord } = useProgress();
  // The session is an explicit, one-time SNAPSHOT of the due queue — never a
  // live memo of `dueCards`. Grading a card mutates `flashcardStats`; a live
  // memo would rebuild the queue mid-run while the position cursor marched on,
  // desyncing the two (the latent bug this sprint replaces). We seed once below
  // and only ever rebuild on an explicit "Review N more".
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [revealed, setRevealed] = useState(false);
  // Transient confirmation shown after grading a card.
  const [toast, setToast] = useState<string | null>(null);

  // Seed the session exactly once, the moment progress finishes loading — using
  // the "adjust state while rendering" pattern so the queue is fixed before
  // paint and never tracks live `flashcardStats`.
  if (loaded && session === null) {
    setSession(startSession(dueCards(data.topics, progress.flashcardStats)));
  }

  const current = session ? session.queue[session.position] : undefined;
  // Projected next interval per grade for the current card, so grade buttons can
  // label what each grade would schedule (via previewIntervals — never re-derived).
  const gradePreviews = previewIntervals(
    current ? progress.flashcardStats[current.key] : undefined,
    new Date(),
  );

  const handleGrade = useCallback(
    (grade: Grade) => {
      if (!session || !current) return;
      // Compute the projected interval BEFORE grading mutates the stat, so the
      // toast reports exactly what this grade scheduled.
      const days = previewIntervals(progress.flashcardStats[current.key], new Date())[grade];
      // Persistence is unchanged: exactly one `gradeWord` per grading event. An
      // "Again" card therefore persists via scheduleReview now (interval 1d) AND
      // is requeued in-session by gradeCard below; when it comes back around its
      // regrade fires gradeWord again — a deliberate second persistence event
      // (SM-2-style relearn: a later Good doubles from the relearned interval).
      gradeWord(current.key, grade);
      setToast(`“${current.hanzi}” scheduled in ${formatIntervalDays(days)}`);
      setRevealed(false);
      const next = gradeCard(session, grade);
      setSession(next);
      if (isSessionComplete(next)) {
        track("review_completed", { count: next.queue.length });
      }
    },
    [session, current, progress.flashcardStats, gradeWord],
  );

  // Start a fresh session from the current (post-grading) due queue. Safe to
  // recompute here because it's an explicit user action, not a mid-run memo.
  function reviewMore() {
    setSession(startSession(dueCards(data.topics, progress.flashcardStats)));
    setRevealed(false);
  }

  // ── Deck flip/fling (Sprint 9) ──────────────────────────────────────────────
  // Same physical-card treatment as the topic Cards tab: tap flips, drag follows
  // the thumb, a fling grades. The flip/fling are purely presentational — the
  // Reveal and grade buttons remain the real keyboard/AT controls.
  const reducedMotion = useReducedMotion();
  const [flingDir, setFlingDir] = useState<"left" | "right" | null>(null);
  const flinging = useRef(false);
  const flingGrade = useRef<Grade | null>(null);
  const flingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settleFling = useCallback(() => {
    if (!flinging.current) return;
    flinging.current = false;
    if (flingTimer.current) {
      clearTimeout(flingTimer.current);
      flingTimer.current = null;
    }
    const grade = flingGrade.current;
    flingGrade.current = null;
    setFlingDir(null);
    if (grade) handleGrade(grade);
  }, [handleGrade]);

  useEffect(() => () => {
    if (flingTimer.current) clearTimeout(flingTimer.current);
  }, []);

  const startFling = useCallback(
    (grade: Grade, dir: "left" | "right") => {
      if (reducedMotion) {
        handleGrade(grade);
        return;
      }
      flinging.current = true;
      flingGrade.current = grade;
      setFlingDir(dir);
      flingTimer.current = setTimeout(settleFling, 350);
    },
    [handleGrade, reducedMotion, settleFling],
  );

  const handleTap = useCallback(() => {
    if (flinging.current) return;
    if (!revealed) setRevealed(true);
  }, [revealed]);

  const handleFling = useCallback(
    (intent: FlingIntent) => {
      if (flinging.current) return;
      if (!revealed) {
        if (intent === "easy") setRevealed(true);
        return;
      }
      if (intent === "again") startFling("again", "left");
      else if (intent === "easy") startFling("easy", "right");
    },
    [revealed, startFling],
  );

  const { dx, dragging, handlers } = useCardDrag({ onTap: handleTap, onFling: handleFling });

  if (!loaded || !session) {
    return <LoadingScreen />;
  }

  const isEmpty = session.queue.length === 0;
  const complete = isSessionComplete(session);
  const total = session.queue.length;
  // Requeued cards still ahead of the cursor — the "to re-check" countdown.
  const remaining = session.queue.slice(session.position);
  const requeueCount = session.againKeys.filter((key) =>
    remaining.some((card) => card.key === key),
  ).length;
  const tough = toughestCards(session);

  // Drag-follow only once revealed, and never under reduced motion.
  const dragStyle =
    dragging && revealed && !reducedMotion
      ? { transform: dragTransform(dx), transition: "none" as const }
      : undefined;
  const hintStrength = Math.min(1, Math.abs(dx) / FLING_THRESHOLD_PX);
  const flingClass =
    flingDir === "left" ? "card-fling-left" : flingDir === "right" ? "card-fling-right" : "";

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Daily Review</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-300">
          {isEmpty
            ? "No cards are due for review right now."
            : session.remainingDue > 0
              ? `${total} card session · ${session.remainingDue} more due later.`
              : `${total} card${total !== 1 ? "s" : ""} due for review today.`}
        </p>
      </div>

      {/* ── Empty state: no cards due ── */}
      {isEmpty ? (
        <div className="mt-12 rounded-3xl border border-white/10 bg-surface p-10 text-center">
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
      ) : complete ? (
        /* ── Session complete summary ── */
        <div className="animate-celebrate mt-12 rounded-3xl border border-white/10 bg-surface p-8 text-center md:p-10">
          <p className="text-6xl">🎉</p>
          <p className="mt-4 text-2xl font-semibold text-white">Session complete!</p>
          <p className="mt-3 text-slate-400">
            You reviewed {total} card{total !== 1 ? "s" : ""}. Here&apos;s how it went.
          </p>

          {/* Grade tally */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TALLY.map(({ grade, label, className }) => (
              <div
                key={grade}
                className={`rounded-2xl border bg-white/[0.03] px-3 py-4 ${className}`}
              >
                <p className="text-2xl font-semibold">{session.counts[grade]}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          {/* Toughest words (anything graded Again this session) */}
          {tough.length > 0 ? (
            <div className="mt-8 text-left">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Toughest this session
              </h2>
              <ul className="mt-3 space-y-2">
                {tough.map((card) => (
                  <li
                    key={card.key}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-hanzi text-lg text-white">
                        {card.hanzi}{" "}
                        <span className="text-sm text-emerald-300">{card.pinyin}</span>
                      </p>
                      <p className="truncate text-sm text-slate-400">{card.english}</p>
                    </div>
                    <Link
                      href={`/topics/${card.topicSlug}`}
                      className="shrink-0 text-sm text-emerald-300 hover:text-emerald-200"
                    >
                      {card.topicTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {session.remainingDue > 0 ? (
              <button
                type="button"
                onClick={reviewMore}
                className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Review {session.remainingDue} more
              </button>
            ) : (
              <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
                Learn more words
              </Link>
            )}
            <Link href="/stats" className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300">
              Back to stats
            </Link>
          </div>
        </div>
      ) : current ? (
        /* ── Active review card ── */
        <section
          className="mt-8 rounded-3xl border border-white/10 bg-surface p-6 text-center"
          aria-label="Review flashcard"
          role="region"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>Card {session.position + 1} of {total}</span>
              {requeueCount > 0 ? (
                <span
                  className="rounded-full border border-amber-400/50 px-2 py-0.5 text-xs text-amber-300"
                  aria-label={`${requeueCount} card${requeueCount !== 1 ? "s" : ""} will repeat this session`}
                >
                  {requeueCount} to re-check
                </span>
              ) : null}
              {/* Swipe hints — taught once, on the first card of the session. */}
              {session.position === 0 ? (
                <div className="flex gap-3">
                  <span className="swipe-hint">← again</span>
                  <span className="swipe-hint">easy →</span>
                </div>
              ) : null}
            </div>
            <Link href={`/topics/${current.topicSlug}`} className="text-sm text-emerald-300 hover:text-emerald-200 truncate max-w-32">
              {current.topicTitle}
            </Link>
          </div>

          {/* Progress bar through session */}
          <div className="progress-bar-track mt-3">
            <div className="progress-bar-fill" style={{ width: `${(session.position / total) * 100}%` }} />
          </div>

          {/* Draggable 3D card. The fling/drag transform rides this wrapper (2D);
              the inner .card-3d handles the rotateY flip so they never fight. */}
          <div
            className={`relative mt-8 select-none touch-pan-y cursor-grab active:cursor-grabbing ${flingClass}`}
            style={dragStyle}
            onAnimationEnd={settleFling}
            {...handlers}
          >
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-rose-300"
              style={{ opacity: dragging && revealed && dx < 0 ? hintStrength : 0 }}
              aria-hidden="true"
            >
              ← again
            </span>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-emerald-300"
              style={{ opacity: dragging && revealed && dx > 0 ? hintStrength : 0 }}
              aria-hidden="true"
            >
              easy →
            </span>

            <div className="card-scene">
              <div className={`card-3d flex min-h-[280px] items-center justify-center ${revealed ? "is-flipped" : ""}`}>
                {/* Front face: hanzi + speak */}
                <div className="card-face flex w-full flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-3">
                    <h2 className="font-hanzi text-7xl font-semibold text-white">{current.hanzi}</h2>
                    <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
                  </div>
                </div>
                {/* Back face: hanzi (smaller) + pinyin + english + interval */}
                <div className="card-face card-face-back flex w-full flex-col items-center justify-center">
                  <p className="font-hanzi text-4xl font-semibold text-white">{current.hanzi}</p>
                  <p className="mt-3 font-hanzi text-2xl text-emerald-300">{current.pinyin}</p>
                  <p className="mt-2 text-xl text-slate-200">{current.english}</p>
                  <p className="mt-4 text-xs text-slate-500">Current interval: {current.intervalDays}d</p>
                </div>
              </div>
            </div>
          </div>

          {/* Deck dots only for short queues; long sessions rely on the bar. */}
          {total <= DECK_DOT_MAX ? <DeckDots count={total} current={session.position} /> : null}

          {!revealed ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                aria-label="Reveal answer"
              >
                Reveal
              </button>
            </div>
          ) : (
            // Calmer segmented grade bar: one quiet surface well holding four
            // equal-width segments, each stacking label + interval, with a subtle
            // semantic top rule instead of a loud pill border.
            <div
              className="mt-8 mx-auto flex max-w-md gap-1 rounded-2xl border border-white/10 bg-surface-2 p-1"
              role="group"
              aria-label="Grade your recall"
            >
              {GRADE_SEGMENTS.map(({ grade, rule }) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => handleGrade(grade)}
                  className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-t-2 ${rule} px-2 py-2 text-center font-semibold text-white transition hover:bg-surface-hover`}
                  aria-label={`Grade as ${grade} — next review in ${gradePreviews[grade]} day${gradePreviews[grade] !== 1 ? "s" : ""}`}
                >
                  <span className="text-sm capitalize">{grade}</span>
                  <span className="text-[11px] font-normal text-slate-500" aria-hidden="true">
                    {formatIntervalDays(gradePreviews[grade])}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
