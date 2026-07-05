"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { MandarinData } from "@/lib/types";
import {
  buildPracticeQuiz,
  resolveWeakItems,
  type PracticeEntry,
} from "@/lib/practice-logic";
import { defaultShuffle, type QuizCard } from "@/lib/quiz-logic";
import { track } from "@/lib/analytics";
import { useProgress } from "./use-progress";
import { useSpeech } from "./use-speech";
import { usePracticeShortcuts } from "./use-practice-shortcuts";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";

// A snapshot of one practice run: the resolved weak-word entries and the quiz
// cards built from them, kept in lockstep (entries[i] ↔ deck[i]).
type Session = { entries: PracticeEntry[]; deck: QuizCard[] };

// Fewer than this many resolvable weak words shows the empty state instead of a
// deck — a 1–2 question "deck" isn't worth a dedicated session.
const MIN_DECK = 3;

// The /practice deck: the learner's trickiest words from every topic, weakest
// first, quizzed hanzi → English. Structure mirrors review-app.tsx.
export function PracticeApp({ data }: { data: MandarinData }) {
  const { progress, loaded, recordQuizAnswer } = useProgress();

  // Session-snapshot the deck. Building it reads quizStats, but every answer we
  // record mutates quizStats — so recomputing live (e.g. via useMemo) would
  // reshuffle the deck mid-run. Instead we snapshot once when progress first
  // loads and only rebuild on "Practice again", reading the latest stats then.
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [missedKeys, setMissedKeys] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  // Build a fresh session from the CURRENT quizStats. minAttempts:2 so a couple
  // of quiz mistakes is enough to surface a word; limit:10 caps the deck size.
  const buildSession = useCallback((): Session => {
    const entries = resolveWeakItems(data.topics, progress.quizStats, { minAttempts: 2, limit: 10 });
    return { entries, deck: buildPracticeQuiz(entries, "hanzi-english", defaultShuffle) };
  }, [data.topics, progress.quizStats]);

  // Seed the session exactly once, the first render after progress loads. This
  // is the "adjust state during render" pattern (not a memo, not an effect): a
  // memo would re-run when quizStats changes on every answer and reshuffle the
  // deck, which is exactly what we must avoid. The `session === null` guard makes
  // this fire a single time; "Practice again" rebuilds explicitly.
  if (loaded && session === null) {
    setSession(buildSession());
  }

  function resetRun() {
    setIndex(0);
    setScore(0);
    setPicked(null);
    setMissedKeys([]);
    setDone(false);
  }

  function practiceAgain() {
    setSession(buildSession());
    resetRun();
  }

  // Hardened Web Speech entry point for the "P" shortcut (Sprint 5). The visible
  // SpeakButton owns its own instance; this drives the keyboard path.
  const { speak } = useSpeech();

  // ── Deck derivations, hoisted ABOVE the early returns ──
  // usePracticeShortcuts is a hook, so it must be called unconditionally before
  // any return. Its inputs (current card, choice count, handlers) are derived
  // here with null-safe defaults; session may still be null while loading. The
  // real card UI only renders after the two early returns below confirm a full,
  // playable session, so these defaults are never user-visible.
  const entries = session?.entries ?? [];
  const deck = session?.deck ?? [];
  const total = deck.length;
  const current = deck[index];
  const currentEntry = entries[index];

  function handleAnswer(choice: string) {
    if (!current || picked !== null) return;
    setPicked(choice);
    const correct = choice === current.answer;
    recordQuizAnswer(current.key, correct);
    if (correct) {
      setScore((v) => v + 1);
    } else {
      setMissedKeys((keys) => (keys.includes(current.key) ? keys : [...keys, current.key]));
    }
  }

  function handleNext() {
    if (index + 1 >= total) {
      setDone(true);
      track("practice_session_completed", { count: total, score });
    } else {
      setIndex((v) => v + 1);
      setPicked(null);
    }
  }

  // Keyboard shortcuts: 1–4 answer, Enter/→ advance, P pronounce, R restart.
  // Enabled only for a real, playable session — the listener is a no-op during
  // loading and the not-enough-history empty state.
  usePracticeShortcuts({
    enabled: loaded && !!session && entries.length >= MIN_DECK,
    phase: done ? "done" : picked !== null ? "answered" : "question",
    choiceCount: current?.choices.length ?? 0,
    onChoose: (i) => {
      const c = current?.choices[i];
      if (c) handleAnswer(c);
    },
    onNext: handleNext,
    onSpeak: () => {
      if (current) speak(current.prompt);
    },
    onAgain: practiceAgain,
  });

  if (!loaded || !session) {
    return <LoadingScreen message="Building your practice deck…" />;
  }

  // ── Empty state: not enough quiz history to build a worthwhile deck ──
  if (entries.length < MIN_DECK) {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
        <Link href="/stats" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Stats</Link>
        <div className="mt-8">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Practice</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-300">Your trickiest words from every topic, weakest first.</p>
        </div>
        <div className="mt-12 rounded-3xl border border-white/10 bg-surface p-10 text-center">
          <p className="text-5xl">🎯</p>
          <p className="mt-4 text-2xl font-semibold text-white">Not enough quiz history yet</p>
          <p className="mt-3 mx-auto max-w-sm text-slate-400">
            Take a few topic quizzes and your trickiest words will collect here.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
              Browse topics
            </Link>
            <Link href="/review" className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300">
              Daily review
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Missed entries, resolved for the completion summary (hanzi/pinyin/english + topic).
  const missedEntries = entries.filter((e) => missedKeys.includes(e.key));

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <Link href="/stats" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Stats</Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Practice</h1>
        <p className="mt-3 text-lg text-slate-300">Your trickiest words from every topic, weakest first.</p>
      </div>

      {done ? (
        /* ── Completion summary ── */
        <div className="animate-celebrate mt-12 rounded-3xl border border-white/10 bg-surface p-8 text-center">
          <p className="text-6xl">{missedEntries.length === 0 ? "🎉" : "💪"}</p>
          <p className="mt-4 text-2xl font-semibold text-white">Practice complete!</p>
          <p className="mt-3 text-5xl font-bold text-emerald-300">
            {score}
            <span className="text-2xl text-slate-400">/{total}</span>
          </p>
          <p className="mt-2 text-slate-400">
            {missedEntries.length === 0
              ? "Perfect score! Every tricky word nailed."
              : score >= Math.ceil(total * 0.8)
              ? "Great job! Just a few to keep working on."
              : "Keep at it — the words below still need reps."}
          </p>

          {missedEntries.length > 0 ? (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left">
              <p className="text-sm font-semibold text-slate-300">{missedEntries.length} to keep practicing</p>
              <ul className="mt-3 space-y-2">
                {missedEntries.map((e) => (
                  <li key={e.key} className="flex items-baseline gap-3">
                    <span className="font-hanzi text-xl text-white">{e.item.hanzi}</span>
                    <span className="font-hanzi text-sm text-emerald-300">{e.item.pinyin}</span>
                    <span className="text-sm text-slate-400">{e.item.english}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={practiceAgain}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              aria-keyshortcuts="r"
            >
              Practice again
            </button>
            <Link
              href="/lightning"
              className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Try a Lightning Round ⚡
            </Link>
            <Link
              href="/stats"
              className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Back to stats
            </Link>
          </div>

          {/* Desktop-only shortcut hint; screen readers use aria-keyshortcuts above. */}
          <p className="mt-6 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
            Press R to practice again
          </p>
        </div>
      ) : (
        /* ── Active practice card ── */
        <section className="mt-8 rounded-3xl border border-white/10 bg-surface p-6" aria-label="Practice quiz">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">Word {index + 1} of {total}</p>
            <Link
              href={`/topics/${currentEntry.topicSlug}`}
              className="max-w-40 truncate text-sm text-emerald-300 hover:text-emerald-200"
            >
              {currentEntry.topicTitle}
            </Link>
          </div>

          {/* Progress bar through the deck */}
          <div className="progress-bar-track mt-2">
            <div className="progress-bar-fill" style={{ width: `${(index / total) * 100}%` }} />
          </div>

          <p className="mt-4 text-right text-sm font-semibold text-emerald-300">Score {score}</p>

          {/* Prompt: hanzi + pronounce */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <h2 className="font-hanzi text-7xl font-semibold text-white">{current.prompt}</h2>
              <SpeakButton text={current.prompt} label={`Pronounce: ${current.prompt}`} />
            </div>
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
                    <kbd className="kbd hidden md:inline-flex" aria-hidden="true">{i + 1}</kbd>
                  ) : null}
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop-only shortcut hint; screen readers use aria-keyshortcuts above. */}
          <p className="mt-4 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
            {picked ? "Enter next · P pronounce" : "1–4 choose · P pronounce"}
          </p>

          {picked ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                aria-label={index + 1 >= total ? "See results" : "Next word"}
                aria-keyshortcuts="Enter"
              >
                {index + 1 >= total ? "See results" : "Next word"}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
