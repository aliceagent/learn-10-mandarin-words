"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlashcardStat, DirectionalFlashcardStat, Topic, VocabItem } from "@/lib/types";
import type { Grade } from "@/lib/progress-logic";
import { formatIntervalDays, previewIntervals } from "@/lib/progress-logic";
import { confidenceAriaLabel, flashcardConfidence } from "@/lib/flashcard-confidence";
import {
  FLASHCARD_RECALL_PROMPT,
  flashcardGradeAriaLabel,
  flashcardGradeMicrocopy,
  flashcardGradePreviewLabel,
  flashcardGradeSegments,
} from "@/lib/flashcard-grading-copy";
import { dragTransform, FLING_THRESHOLD_PX, type FlingIntent } from "@/lib/gesture-logic";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { HANZI_SIZE_CLASS } from "@/lib/hanzi-size";
import { buildFlashcardFace, directionForCard, FLASHCARD_DIRECTION_OPTIONS } from "@/lib/flashcard-direction";
import type { ConcreteFlashcardDirection } from "@/lib/flashcard-direction";
import { FLASHCARD_VISIBILITY_OPTIONS } from "@/lib/flashcard-visibility";
import type { FlashcardSessionSummary } from "@/lib/flashcard-session-summary";
import { FLASHCARD_DECK_ORDER_OPTIONS, type FlashcardDeckOrder } from "@/lib/flashcard-deck-order";
import { flashcardRescuePrompt } from "@/lib/flashcard-rescue";
import { SpeakButton } from "../speak-button";
import { TonePinyin } from "../tone-pinyin";
import { useCardDrag } from "../use-card-drag";
import { useFlashcardDirection } from "../use-flashcard-direction";
import { useFlashcardVisibility } from "../use-flashcard-visibility";
import { useHanziSize } from "../use-hanzi-size";
import { useReducedMotion } from "../use-reduced-motion";
import { DeckDots } from "../deck-dots";

const CONFIDENCE_TONE_CLASS = {
  slate: "border-white/10 bg-white/5 text-slate-300",
  amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  sky: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  rose: "border-rose-300/30 bg-rose-400/10 text-rose-100",
} as const;

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
  directionalStats,
  revealed,
  onReveal,
  onGrade,
  onKnown,
  deckOrder,
  onDeckOrderChange,
  sessionSummary,
  onReviewMissed,
  onRestartSession,
}: {
  topic: Topic;
  cardIndex: number;
  current: VocabItem;
  /** The current word's saved stat, so grade buttons can preview the next
   *  interval (undefined for a never-graded word). */
  stat: FlashcardStat | undefined;
  /** Direction-specific recall history for this word, keyed by prompt direction. */
  directionalStats: Partial<Record<ConcreteFlashcardDirection, DirectionalFlashcardStat>> | undefined;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade, direction: ConcreteFlashcardDirection) => void;
  onKnown: (direction: ConcreteFlashcardDirection) => void;
  deckOrder: FlashcardDeckOrder;
  onDeckOrderChange: (order: FlashcardDeckOrder) => void;
  sessionSummary: FlashcardSessionSummary;
  onReviewMissed: () => void;
  onRestartSession: () => void;
}) {
  // Projected next interval per grade — computed via previewIntervals so the
  // labels always match what a real grade would schedule (never re-derived).
  const previews = previewIntervals(stat, new Date());

  const reducedMotion = useReducedMotion();
  const { size: hanziSize } = useHanziSize();
  const { direction, setDirection } = useFlashcardDirection();
  const { visibility, toggle } = useFlashcardVisibility();
  const activeDirection = directionForCard(direction, cardIndex);
  const directionalStat = directionalStats?.[activeDirection];
  const face = buildFlashcardFace(current, activeDirection);
  const confidence = flashcardConfidence(stat);
  const [dismissedRescueKeys, setDismissedRescueKeys] = useState<Set<string>>(() => new Set());
  const rescuePrompt = flashcardRescuePrompt(current, stat, {
    dismissed: dismissedRescueKeys.has(`${topic.slug}:${current.hanzi}`),
  });
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
    if (grade) onGrade(grade, activeDirection);
  }, [activeDirection, onGrade]);

  useEffect(() => () => {
    if (flingTimer.current) clearTimeout(flingTimer.current);
  }, []);

  const startFling = useCallback(
    (grade: Grade, dir: "left" | "right") => {
      // Reduced motion: skip the fly-off, grade immediately (pre-sprint feel).
      if (reducedMotion) {
        onGrade(grade, activeDirection);
        return;
      }
      flinging.current = true;
      flingGrade.current = grade;
      setFlingDir(dir);
      flingTimer.current = setTimeout(settleFling, 350);
    },
    [activeDirection, onGrade, reducedMotion, settleFling],
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>Card {cardIndex + 1} of {topic.items.length}</span>
        <div
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${CONFIDENCE_TONE_CLASS[confidence.tone]}`}
          aria-label={confidenceAriaLabel(confidence)}
          title={confidence.explanation}
        >
          {confidence.label} · {confidence.score}%
        </div>
        {directionalStat ? (
          <div className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100" title="Confidence for this prompt direction only">
            This direction · {directionalStat.confidence}% · {directionalStat.reviewCount}x
          </div>
        ) : (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400">
            New in this direction
          </div>
        )}
        {/* Swipe gesture hints — taught once, on the first card of the deck. */}
        {cardIndex === 0 ? (
          <div className="flex gap-3">
            <span className="swipe-hint">← again</span>
            <span className="swipe-hint">easy →</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-surface-2 p-2 text-left">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Direction
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {FLASHCARD_DIRECTION_OPTIONS.map((option) => {
            const active = direction === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setDirection(option.key)}
                aria-pressed={active}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs transition ${
                  active
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-surface-2 p-2 text-left">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Deck order
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          {FLASHCARD_DECK_ORDER_OPTIONS.map((option) => {
            const active = deckOrder === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onDeckOrderChange(option.key)}
                aria-pressed={active}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs transition ${
                  active
                    ? "border-sky-300/40 bg-sky-400/10 text-sky-100"
                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.description}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-2 text-[11px] text-slate-500">
          The order is snapshotted for this pass, so grading won&apos;t move cards under you.
        </p>
      </div>

      {rescuePrompt ? (
        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-100">{rescuePrompt.title}</p>
              <p className="mt-1 text-sm text-slate-300">
                “{rescuePrompt.word}” has slipped {rescuePrompt.lapses} times. {rescuePrompt.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissedRescueKeys((keys) => new Set(keys).add(`${topic.slug}:${current.hanzi}`))}
              className="min-h-[36px] rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-amber-200/50 hover:text-white"
            >
              Skip note
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {rescuePrompt.examples.map((example) => (
              <figure key={`${example.cn}:${example.en}`} className="rounded-xl border border-white/10 bg-surface/60 p-3">
                <blockquote lang={HANZI_LANG} className="font-hanzi text-lg text-white">{example.cn}</blockquote>
                <figcaption className="mt-1 text-xs text-slate-400">{example.en}</figcaption>
              </figure>
            ))}
          </div>
          <p lang={PINYIN_LANG} className="mt-3 font-hanzi text-sm text-emerald-300">
            <TonePinyin pinyin={rescuePrompt.pinyin} /> · {rescuePrompt.english}
          </p>
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-white/10 bg-surface-2 p-2 text-left">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Card hints
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {FLASHCARD_VISIBILITY_OPTIONS.map((option) => {
            const active = visibility[option.key];
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggle(option.key)}
                aria-pressed={active}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs transition ${
                  active
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.description}</span>
              </button>
            );
          })}
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
                {face.promptKind === "hanzi" ? (
                  <h2 lang={HANZI_LANG} className={`font-hanzi ${HANZI_SIZE_CLASS.hero[hanziSize]} font-semibold text-white`}>{face.promptPrimary}</h2>
                ) : face.promptKind === "pinyin" ? (
                  <h2 lang={PINYIN_LANG} className="font-hanzi text-4xl font-semibold text-emerald-300 md:text-6xl">
                    <TonePinyin pinyin={face.promptPrimary} />
                  </h2>
                ) : (
                  <h2 className="text-3xl font-semibold text-white md:text-5xl">{face.promptPrimary}</h2>
                )}
                <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
              </div>
              {visibility.showPinyinBeforeReveal && face.promptKind !== "pinyin" ? (
                <p lang={PINYIN_LANG} className="mt-3 font-hanzi text-2xl text-emerald-300">
                  <TonePinyin pinyin={current.pinyin} />
                </p>
              ) : null}
              {visibility.showEnglishBeforeReveal && face.promptKind !== "english" ? (
                <p className="mt-2 text-lg text-slate-300">{current.english}</p>
              ) : null}
            </div>
            {/* Back face: answer + pinyin + optional english */}
            <div className="card-face card-face-back flex w-full flex-col items-center justify-center">
              <p lang={HANZI_LANG} className={`font-hanzi ${HANZI_SIZE_CLASS.word[hanziSize]} font-semibold text-white`}>{face.answerPrimary}</p>
              <p lang={PINYIN_LANG} className="mt-3 font-hanzi text-2xl text-emerald-300"><TonePinyin pinyin={face.answerPinyin} /></p>
              {visibility.showEnglishAfterReveal ? (
                <p className="mt-2 text-xl text-slate-200">{face.answerEnglish}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">English hidden for recall practice</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deck-position dots (decorative; the "Card N of M" text carries it for AT) */}
      <DeckDots count={topic.items.length} current={cardIndex} />

      {sessionSummary.complete ? (
        <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-100">Session complete</p>
              <p className="mt-1 text-sm text-slate-300">
                Reviewed {sessionSummary.reviewedCount}/{sessionSummary.totalCount} cards · {sessionSummary.improvedCount} improved · {sessionSummary.knownCount} known
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Again {sessionSummary.gradeCounts.again} · Hard {sessionSummary.gradeCounts.hard} · Good {sessionSummary.gradeCounts.good} · Easy {sessionSummary.gradeCounts.easy}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onReviewMissed}
                disabled={sessionSummary.needsWorkCount === 0}
                className="min-h-[40px] rounded-full border border-amber-300/30 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200/50 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-600 disabled:hover:bg-transparent"
              >
                Review missed again ({sessionSummary.needsWorkCount})
              </button>
              <button
                type="button"
                onClick={onRestartSession}
                className="min-h-[40px] rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/40 hover:bg-white/5"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!revealed ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onReveal}
            className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            aria-label="Reveal answer"
          >
            Reveal
          </button>
          <button
            type="button"
            onClick={() => onKnown(activeDirection)}
            className="min-h-[44px] rounded-full border border-emerald-300/30 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-400/10"
            aria-label={`Mark ${current.hanzi} as known and review it less often`}
          >
            I know this word
          </button>
        </div>
      ) : (
        // Calmer segmented grade bar: one quiet surface well holding four
        // equal-width segments, each stacking label + interval, with a subtle
        // semantic top rule instead of a loud pill border.
        <div className="mt-8">
          <p className="mx-auto max-w-md text-sm font-semibold text-slate-200">{FLASHCARD_RECALL_PROMPT}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Choose the recall quality; the tiny text still previews the next review interval.
          </p>
          <div
            className="mx-auto mt-3 grid max-w-2xl gap-2 rounded-2xl border border-white/10 bg-surface-2 p-1 sm:grid-cols-4"
            role="group"
            aria-label={FLASHCARD_RECALL_PROMPT}
          >
            {flashcardGradeSegments.map(({ grade, label, rule }) => {
              const preview = flashcardGradePreviewLabel(grade, previews[grade]);
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => onGrade(grade, activeDirection)}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border-t-2 ${rule} px-2 py-2 text-center font-semibold text-white transition hover:bg-surface-hover`}
                  aria-label={flashcardGradeAriaLabel(grade, previews[grade])}
                  title={`Internal grade: ${grade}`}
                >
                  <span className="text-sm">{label}</span>
                  <span className="text-[11px] font-normal text-slate-400">{flashcardGradeMicrocopy(grade)}</span>
                  <span className="text-[11px] font-normal text-slate-500" aria-hidden="true">
                    {formatIntervalDays(previews[grade])}
                  </span>
                  <span className="sr-only">{preview}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tip on first card */}
      {!revealed && cardIndex === 0 ? (
        <p className="mt-6 text-xs text-slate-600">
          Tap the card to flip, then grade your recall · swipe left/right after revealing
        </p>
      ) : null}
    </section>
  );
}
