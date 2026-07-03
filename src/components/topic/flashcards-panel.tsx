"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlashcardStat, Topic, VocabItem } from "@/lib/types";
import type { Grade } from "@/lib/progress-logic";
import { formatIntervalDays, previewIntervals } from "@/lib/progress-logic";
import { dragTransform, FLING_THRESHOLD_PX, type FlingIntent } from "@/lib/gesture-logic";
import { SpeakButton } from "../speak-button";
import { useCardDrag } from "../use-card-drag";
import { useReducedMotion } from "../use-reduced-motion";
import { DeckDots } from "../deck-dots";

// The "Cards" tab: a single flashcard rendered as a physical-feeling deck
// (Sprint 9) — a 3D flip on reveal, drag-to-follow, fling-to-grade, and deck
// dots — layered on top of the same reveal/grade intents the parent owns. Card
// index and reveal/grade side effects stay in the parent so quiz/flashcard
// state persists across tab switches. The flip/fling are purely presentational:
// the Reveal and grade buttons remain the real (keyboard/AT) controls.
export function FlashcardsPanel({
  topic,
  cardIndex,
  current,
  stat,
  revealed,
  onReveal,
  onGrade,
}: {
  topic: Topic;
  cardIndex: number;
  current: VocabItem;
  /** The current word's saved stat, so grade buttons can preview the next
   *  interval (undefined for a never-graded word). */
  stat: FlashcardStat | undefined;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
}) {
  // Projected next interval per grade — computed via previewIntervals so the
  // labels always match what a real grade would schedule (never re-derived).
  const previews = previewIntervals(stat, new Date());

  const reducedMotion = useReducedMotion();
  // Fling animation state: the card flies off, then the grade lands on
  // animation end (with a timeout fallback so an interrupted animation never
  // leaves a stuck card). `flinging` blocks all further input until it settles.
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
    if (grade) onGrade(grade);
  }, [onGrade]);

  useEffect(() => () => {
    if (flingTimer.current) clearTimeout(flingTimer.current);
  }, []);

  const startFling = useCallback(
    (grade: Grade, dir: "left" | "right") => {
      // Reduced motion: skip the fly-off, grade immediately (pre-sprint feel).
      if (reducedMotion) {
        onGrade(grade);
        return;
      }
      flinging.current = true;
      flingGrade.current = grade;
      setFlingDir(dir);
      flingTimer.current = setTimeout(settleFling, 350);
    },
    [onGrade, reducedMotion, settleFling],
  );

  const handleTap = useCallback(() => {
    if (flinging.current) return;
    if (!revealed) onReveal();
  }, [onReveal, revealed]);

  const handleFling = useCallback(
    (intent: FlingIntent) => {
      if (flinging.current) return;
      // Before reveal: a rightward fling flips (reveals); left does nothing.
      if (!revealed) {
        if (intent === "easy") onReveal();
        return;
      }
      // After reveal: fling grades; a sub-threshold drag (null) springs back.
      if (intent === "again") startFling("again", "left");
      else if (intent === "easy") startFling("easy", "right");
    },
    [onReveal, revealed, startFling],
  );

  const { dx, dragging, handlers } = useCardDrag({ onTap: handleTap, onFling: handleFling });

  // Drag-follow only once revealed, and never under reduced motion.
  const dragStyle =
    dragging && revealed && !reducedMotion
      ? { transform: dragTransform(dx), transition: "none" as const }
      : undefined;
  const hintStrength = Math.min(1, Math.abs(dx) / FLING_THRESHOLD_PX);
  const flingClass =
    flingDir === "left" ? "card-fling-left" : flingDir === "right" ? "card-fling-right" : "";

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6 text-center"
      aria-label="Flashcard practice"
      role="region"
    >
      <div className="flex items-center justify-between gap-2 text-sm text-slate-400">
        <span>Card {cardIndex + 1} of {topic.items.length}</span>
        {/* Swipe gesture hints */}
        <div className="flex gap-2">
          <span className="swipe-hint">← again</span>
          <span className="swipe-hint">easy →</span>
        </div>
      </div>

      {/* Draggable 3D card. Touch handlers live on this wrapper; the fling
          animation + drag transform ride the wrapper (2D), the inner .card-3d
          does the rotateY flip so the two transforms never fight. */}
      <div
        className={`relative mt-6 select-none touch-pan-y cursor-grab active:cursor-grabbing ${flingClass}`}
        style={dragStyle}
        onAnimationEnd={settleFling}
        {...handlers}
      >
        {/* Directional fling hints, fading in with drag distance. */}
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
            {/* Back face: hanzi (smaller) + pinyin + english */}
            <div className="card-face card-face-back flex w-full flex-col items-center justify-center">
              <p className="font-hanzi text-4xl font-semibold text-white">{current.hanzi}</p>
              <p className="mt-3 font-hanzi text-2xl text-emerald-300">{current.pinyin}</p>
              <p className="mt-2 text-xl text-slate-200">{current.english}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Deck-position dots (decorative; the "Card N of M" text carries it for AT) */}
      <DeckDots count={topic.items.length} current={cardIndex} />

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!revealed ? (
          <button
            type="button"
            onClick={onReveal}
            className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            aria-label="Reveal answer"
          >
            Reveal
          </button>
        ) : (
          <>
            {(["again", "hard", "good", "easy"] as const).map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => onGrade(grade)}
                className="flex min-h-[44px] flex-col items-center justify-center rounded-full border border-white/15 px-5 py-2 font-semibold text-white transition hover:border-emerald-300"
                aria-label={`Grade as ${grade} — next review in ${previews[grade]} day${previews[grade] !== 1 ? "s" : ""}`}
              >
                <span className="capitalize">{grade}</span>
                <span className="text-[11px] font-normal text-slate-500" aria-hidden="true">
                  {formatIntervalDays(previews[grade])}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Tip on first card */}
      {!revealed && cardIndex === 0 ? (
        <p className="mt-6 text-xs text-slate-600">
          Tap the card to flip, then grade your recall · swipe left/right after revealing
        </p>
      ) : null}
    </section>
  );
}
