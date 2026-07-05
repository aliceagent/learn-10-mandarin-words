"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MandarinData } from "@/lib/types";
import {
  applyAnswer,
  buildLightningDeck,
  buildLightningPool,
  emptyRun,
  LIGHTNING_DURATION_MS,
  multiplierFor,
  remainingMs,
  type LightningEntry,
  type LightningRun,
} from "@/lib/lightning-logic";
import { defaultShuffle, type QuizCard } from "@/lib/quiz-logic";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { track } from "@/lib/analytics";
import { useProgress } from "./use-progress";
import { useSpeech } from "./use-speech";
import { useReducedMotion } from "./use-reduced-motion";
import { useLightningBest } from "./use-lightning-best";
import { usePracticeShortcuts } from "./use-practice-shortcuts";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";

// How often the countdown recomputes from the wall-clock deadline. 100ms is
// smooth enough for a draining bar without busy-looping.
const TICK_MS = 100;

// How long the correct/wrong feedback flashes on the picked choice before the
// round auto-advances. Long enough to see the answer, short enough to feel fast.
const FEEDBACK_MS = 350;

// Below this many milliseconds the timer turns rose (danger) and — motion allowing
// — pulses; below AMBER_MS it turns amber (warning). Color is the primary signal
// so it works with reduced motion.
const DANGER_MS = 5_000;
const AMBER_MS = 10_000;

type Phase = "idle" | "running" | "done";

// Wall-clock read, isolated at module scope so the answer/start handlers can read
// the current time without tripping the render-purity lint rule (impure reads are
// legitimate in event handlers; the timer derives everything from these deadlines).
function nowMs(): number {
  return Date.now();
}

// Format remaining milliseconds as `M:SS`, rounding up so a live round never
// shows 0:00 while a sliver of time is left.
function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// The /lightning route: a 60-second timed hanzi → English quiz over the learner's
// due and weakest words. Structure mirrors practice-app.tsx — the deck is
// snapshotted at Start and never rebuilt from live quizStats mid-run (answers
// mutate quizStats every question) — with a wall-clock timer, a combo multiplier,
// and a device-local personal best.
export function LightningApp({ data }: { data: MandarinData }) {
  const { progress, loaded, recordQuizAnswer } = useProgress();
  const { best, loaded: bestLoaded, recordRun } = useLightningBest();
  const { speak } = useSpeech();
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  // The round's word supply, snapshotted at Start. `entries` is stable for the
  // whole round; `deck` is reshuffled (same length) only when a fast player wraps
  // past the end, so the supply never runs dry.
  const [entries, setEntries] = useState<LightningEntry[]>([]);
  const [deck, setDeck] = useState<QuizCard[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [run, setRun] = useState<LightningRun>(emptyRun);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(LIGHTNING_DURATION_MS);
  const [newBest, setNewBest] = useState(false);
  // The stored best score BEFORE this round started, captured at Start so the
  // results screen can show the old best / gap (recordRun overwrites `best`).
  const [prevBest, setPrevBest] = useState(0);

  // The latest run, mirrored into a ref so the timer-expiry handler records the
  // final score even though its effect only re-subscribes when the round starts.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // The pending auto-advance timeout, so it can be cancelled on restart / unmount
  // / time-up and never fires into a finished round.
  const feedbackTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    },
    [],
  );

  // ── Timer: derive the countdown from the `endsAt` wall-clock deadline ──
  // Runs only while a round is live. Ticks every TICK_MS and also on
  // visibilitychange, so a backgrounded tab ends the round honestly instead of
  // freezing. When time hits zero it finishes exactly once: cancels any pending
  // feedback advance, records the run + personal best, and fires analytics.
  useEffect(() => {
    if (phase !== "running" || endsAt === null) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = null;
      }
      const finalRun = runRef.current;
      const isNewBest = recordRun(finalRun);
      setNewBest(isNewBest);
      track("lightning_completed", {
        score: finalRun.score,
        answered: finalRun.answered,
        correct: finalRun.correct,
        bestStreak: finalRun.bestStreak,
        newBest: isNewBest,
      });
      setPicked(null);
      setPhase("done");
    };
    const tick = () => {
      const rem = remainingMs(endsAt, nowMs());
      setRemaining(rem);
      if (rem <= 0) finish();
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    const onVisibility = () => tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, endsAt, recordRun]);

  const current = deck[index];
  const total = deck.length;

  function startRound() {
    const nextEntries = buildLightningPool(data.topics, progress);
    const nextDeck = buildLightningDeck(nextEntries, defaultShuffle);
    if (nextDeck.length === 0) return; // dataset guarantees a pool; guard anyway
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    setPrevBest(best.bestScore);
    setEntries(nextEntries);
    setDeck(nextDeck);
    setIndex(0);
    setPicked(null);
    setRun(emptyRun());
    setNewBest(false);
    const ends = nowMs() + LIGHTNING_DURATION_MS;
    setEndsAt(ends);
    setRemaining(LIGHTNING_DURATION_MS);
    setPhase("running");
  }

  // Advance from the answered index: next card, or wrap to a freshly reshuffled
  // deck so the choices vary on a second pass. `total` is constant (a reshuffle
  // keeps the length), so wrap detection is simple.
  function advanceFrom(fromIndex: number) {
    setPicked(null);
    const next = fromIndex + 1;
    if (next >= total) {
      setDeck(buildLightningDeck(entries, defaultShuffle));
      setIndex(0);
    } else {
      setIndex(next);
    }
  }

  function handleAnswer(choice: string) {
    if (phase !== "running" || picked !== null || !current) return;
    // Lock input the instant the deadline passes, even between ticks, so a
    // rapid click at the buzzer records nothing after time-up.
    if (endsAt === null || remainingMs(endsAt, nowMs()) <= 0) return;
    setPicked(choice);
    const correct = choice === current.answer;
    recordQuizAnswer(current.key, correct);
    setRun((r) => applyAnswer(r, correct));
    const answeredIndex = index;
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      feedbackTimer.current = null;
      advanceFrom(answeredIndex);
    }, FEEDBACK_MS);
  }

  // Keyboard: 1–4 answer (question phase), P pronounce, R go again (done phase).
  // The round auto-advances, so it never enters the "answered" phase.
  usePracticeShortcuts({
    enabled: (phase === "running" || phase === "done") && loaded && bestLoaded,
    phase: phase === "done" ? "done" : "question",
    choiceCount: current?.choices.length ?? 0,
    onChoose: (i) => {
      const c = current?.choices[i];
      if (c) handleAnswer(c);
    },
    onNext: () => {},
    onSpeak: () => {
      if (current) speak(current.prompt);
    },
    onAgain: startRound,
  });

  if (!loaded || !bestLoaded) {
    return <LoadingScreen message="Loading Lightning Round…" />;
  }

  const urgency = remaining <= DANGER_MS ? "danger" : remaining <= AMBER_MS ? "warn" : "accent";
  const timerColor =
    urgency === "danger" ? "text-rose-400" : urgency === "warn" ? "text-amber-300" : "text-emerald-300";
  const barColor =
    urgency === "danger"
      ? "var(--color-danger)"
      : urgency === "warn"
      ? "var(--color-warn)"
      : "var(--color-accent)";

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/stats" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
        ← Stats
      </Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Lightning Round</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-300">
          60 seconds. Your due and trickiest words. Beat your best.
        </p>
      </div>

      {phase === "idle" ? (
        /* ── Start screen ── */
        <div className="mt-10 rounded-3xl border border-white/10 bg-surface p-8 text-center">
          <p className="text-6xl">⚡</p>
          {best.bestScore > 0 ? (
            <>
              <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Personal best</p>
              <p className="mt-1 text-5xl font-bold text-emerald-300">{best.bestScore.toLocaleString()}</p>
            </>
          ) : (
            <p className="mt-4 text-lg font-semibold text-white">No best score yet — set the bar.</p>
          )}
          <div className="mt-8">
            <button
              type="button"
              onClick={startRound}
              className="min-h-[44px] rounded-full bg-emerald-400 px-8 py-3 text-lg font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              ⚡ Start 60-second round
            </button>
          </div>
          <p className="mt-6 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
            1–4 answer · P pronounce
          </p>
        </div>
      ) : phase === "running" && current ? (
        /* ── Active round ── */
        <section className="mt-8 rounded-3xl border border-white/10 bg-surface p-6" aria-label="Lightning round quiz">
          {/* Timer + live score */}
          <div className="flex items-center justify-between gap-4">
            <p
              className={`font-mono text-4xl font-bold tabular-nums ${timerColor} ${
                urgency === "danger" && !reducedMotion ? "animate-lightning-pulse" : ""
              }`}
              role="timer"
              aria-label={`${Math.ceil(remaining / 1000)} seconds left`}
            >
              {formatClock(remaining)}
            </p>
            <div className="text-right">
              <p className="text-2xl font-bold text-white tabular-nums">Score {run.score.toLocaleString()}</p>
              <p className="mt-0.5 text-xs text-slate-500">#{run.answered + 1}</p>
            </div>
          </div>

          {/* Draining timer bar (color mirrors urgency) */}
          <div className="progress-bar-track mt-3">
            <div
              className="progress-bar-fill"
              style={{ width: `${(remaining / LIGHTNING_DURATION_MS) * 100}%`, background: barColor }}
            />
          </div>

          {/* Combo chip — only once the multiplier climbs above ×1 */}
          <div className="mt-4 h-7">
            {run.multiplier > 1 ? (
              <span
                className="inline-flex items-center rounded-full border border-amber-300/50 bg-amber-400/10 px-3 py-1 text-sm font-bold text-amber-300"
                aria-label={`Combo ${run.multiplier} times`}
              >
                ×{run.multiplier} combo
              </span>
            ) : null}
          </div>

          {/* Prompt: hanzi + pinyin (pinyin always accompanies the hanzi) + speak */}
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <h2 lang={HANZI_LANG} className="font-hanzi text-7xl font-semibold text-white">
                {current.prompt}
              </h2>
              <SpeakButton text={current.prompt} label={`Pronounce: ${current.prompt}`} />
            </div>
            {current.promptPinyin ? (
              <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-2xl text-emerald-300">
                {current.promptPinyin}
              </p>
            ) : null}
          </div>

          {/* Choices */}
          <div className="mt-8 grid gap-3 md:grid-cols-2" role="listbox" aria-label="Answer choices">
            {current.choices.map((choice, i) => {
              const right = picked !== null && choice === current.answer;
              const wrong = picked === choice && choice !== current.answer;
              return (
                <button
                  key={`${index}:${choice}`}
                  type="button"
                  onClick={() => handleAnswer(choice)}
                  role="option"
                  aria-selected={picked === choice}
                  aria-disabled={picked !== null && picked !== choice}
                  aria-keyshortcuts={i < 9 ? `${i + 1}` : undefined}
                  className={`flex min-h-[52px] items-center gap-3 rounded-2xl border px-5 py-4 text-left font-semibold transition
                    ${right ? "animate-quiz-correct border-emerald-300 bg-emerald-300 text-slate-950" : ""}
                    ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                    ${!right && !wrong ? "border-white/10 bg-slate-950 text-white hover:border-emerald-300" : ""}
                  `}
                >
                  {i < 9 ? (
                    <kbd className="kbd hidden md:inline-flex" aria-hidden="true">
                      {i + 1}
                    </kbd>
                  ) : null}
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
            1–4 choose · P pronounce
          </p>
        </section>
      ) : phase === "done" ? (
        /* ── Results ── */
        <div className="animate-celebrate mt-10 rounded-3xl border border-white/10 bg-surface p-8 text-center">
          {newBest ? (
            <>
              <p className="text-6xl">⚡</p>
              <p className="mt-4 text-2xl font-semibold text-white">New personal best!</p>
              <p className="mt-4 text-5xl font-bold text-emerald-300">{run.score.toLocaleString()}</p>
              {prevBest > 0 ? (
                <p className="mt-2 text-slate-400">Old best: {prevBest.toLocaleString()}</p>
              ) : (
                <p className="mt-2 text-slate-400">The bar is set — now beat it.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-6xl">🏁</p>
              <p className="mt-4 text-2xl font-semibold text-white">Time&apos;s up!</p>
              <p className="mt-4 text-5xl font-bold text-emerald-300">{run.score.toLocaleString()}</p>
              <p className="mt-2 text-slate-400">
                Best: {best.bestScore.toLocaleString()}
                {best.bestScore > run.score ? ` — ${(best.bestScore - run.score).toLocaleString()} to beat it.` : ""}
              </p>
            </>
          )}

          <p className="mt-4 text-slate-300">
            {run.answered} answered · {run.correct} correct · best combo ×{multiplierFor(run.bestStreak)}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={startRound}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              aria-keyshortcuts="r"
            >
              Go again
            </button>
            <Link
              href="/stats"
              className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Back to stats
            </Link>
          </div>

          <p className="mt-6 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
            Press R to go again
          </p>
        </div>
      ) : null}
    </main>
  );
}
