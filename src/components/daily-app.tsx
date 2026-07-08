"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { MandarinData } from "@/lib/types";
import type { QuizMode } from "@/lib/quiz-logic";
import {
  buildDailyChallenge,
  shareText,
  usesStarterFallback,
  type DailyQuestion,
} from "@/lib/daily-logic";
import { challengeStreak, todayISO } from "@/lib/progress-logic";
import { redrillEntries, type RedrillEntry } from "@/lib/redrill-logic";
import { HANZI_LANG, PINYIN_LANG, quizChoiceLang, quizPromptLang } from "@/lib/lang";
import { track } from "@/lib/analytics";
import { vibrateFeedback } from "./use-haptics";
import { useProgress } from "./use-progress";
import { useSpeech } from "./use-speech";
import { usePracticeShortcuts } from "./use-practice-shortcuts";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";
import { RedrillPanel } from "./redrill-panel";
import { ChallengeArchive } from "./challenge-archive";

// A snapshot of today's challenge: the day it was built for (snapshotted at
// session start so a run straddling midnight UTC records against its start day),
// the deterministic questions, and whether the deck fell back to the starter
// path (drives the new-user subline).
type Session = { day: string; questions: DailyQuestion[]; isFallback: boolean };

// Human labels for each mode's chip — matching quiz-panel.tsx's selector labels.
const MODE_LABELS: Record<QuizMode, string> = {
  "hanzi-english": "Hanzi → English",
  "english-hanzi": "English → Hanzi",
  "hanzi-pinyin": "Hanzi → Pinyin",
  listening: "Listen 🔊",
};

// The /daily route: a deterministic, date-seeded 10-question mixed quiz drawn
// from the topics the learner has studied. Structure mirrors practice-app.tsx —
// a once-snapshotted session, per-answer recording through recordQuizAnswer, and
// a completion screen — with a Wordle-style share block and a challenge streak.
export function DailyApp({ data }: { data: MandarinData }) {
  const { progress, loaded, recordQuizAnswer, recordDailyChallengeResult } = useProgress();
  const { speak } = useSpeech();

  // Session-snapshot the challenge. Building it reads progress, but every answer
  // mutates quizStats — so recomputing live would reshuffle the deck mid-run.
  // Snapshot once when progress first loads (the "adjust state during render"
  // pattern, not a memo/effect); there is no replay, so it's never rebuilt.
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [outcomes, setOutcomes] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  // wordKeys missed during the LIVE run (index-aligned mirror of `outcomes`).
  // Only the live run can populate this — the stored prior-day result persists
  // score/total only, not per-word outcomes, so re-drill is live-run-scoped.
  const [missedKeys, setMissedKeys] = useState<string[]>([]);
  // When set, the completion recap is swapped for a one-tap re-drill over the
  // missed words. Answers persist via recordQuizAnswer only — the official daily
  // result and share strip are untouched.
  const [drillEntries, setDrillEntries] = useState<RedrillEntry[] | null>(null);

  if (loaded && session === null) {
    const day = todayISO();
    setSession({
      day,
      questions: buildDailyChallenge(data.topics, progress, day),
      isFallback: usesStarterFallback(data.topics, progress),
    });
  }

  // ── Deck derivations, hoisted ABOVE the early returns (hooks run first) ──
  const questions = session?.questions ?? [];
  const total = questions.length;
  const current = questions[index];
  const day = session?.day ?? todayISO();

  // The stored official result for today, if any. When present from a PRIOR
  // session (not the run we just finished), we show the completed state instead
  // of a replay — one official challenge per day.
  const storedResult = session ? progress.dailyChallenge[session.day] : undefined;
  const completed = done || Boolean(storedResult);

  const handleAnswer = useCallback(
    (choice: string) => {
      if (!current || picked !== null) return;
      setPicked(choice);
      const correct = choice === current.card.answer;
      vibrateFeedback(correct ? "correct" : "incorrect");
      recordQuizAnswer(current.card.key, correct);
      setOutcomes((prev) => [...prev, correct]);
      if (correct) {
        setScore((v) => v + 1);
      } else {
        setMissedKeys((keys) => (keys.includes(current.card.key) ? keys : [...keys, current.card.key]));
      }
    },
    [current, picked, recordQuizAnswer],
  );

  const handleNext = useCallback(() => {
    if (index + 1 >= total) {
      setDone(true);
      recordDailyChallengeResult(day, score, total);
      track("daily_challenge_completed", { score, total });
    } else {
      setIndex((v) => v + 1);
      setPicked(null);
    }
  }, [index, total, day, score, recordDailyChallengeResult]);

  // Keyboard: 1–4 answer, Enter next, P pronounce. No R — there is no replay.
  usePracticeShortcuts({
    enabled: loaded && !!session && !completed,
    phase: picked !== null ? "answered" : "question",
    choiceCount: current?.card.choices.length ?? 0,
    onChoose: (i) => {
      const c = current?.card.choices[i];
      if (c) handleAnswer(c);
    },
    onNext: handleNext,
    onSpeak: () => {
      // Only the hanzi-prompt modes have something Chinese to pronounce.
      if (current && current.mode !== "english-hanzi") speak(current.item.hanzi);
    },
    onAgain: () => {},
  });

  if (!loaded || !session) {
    return <LoadingScreen message="Building today's challenge…" />;
  }

  const streak = challengeStreak(progress.dailyChallenge, session.day);

  // Outcomes for the completed screen: the live run when we just finished,
  // otherwise a representative strip reconstructed from the stored score (order
  // is not persisted, only the count of greens).
  const displayOutcomes = done
    ? outcomes
    : storedResult
    ? [
        ...Array(storedResult.score).fill(true),
        ...Array(Math.max(0, storedResult.total - storedResult.score)).fill(false),
      ]
    : [];
  const displayScore = done ? score : storedResult?.score ?? 0;
  const displayTotal = done ? total : storedResult?.total ?? total;

  // Missed words, resolved for the live-run recap's list + re-drill. Only the
  // live run has per-word data (the stored replay persists score/total only), so
  // this is empty in the "already done today" state.
  const missedEntries = done ? redrillEntries(data.topics, missedKeys) : [];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:px-10 md:pb-12 md:pt-8">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
        ← Home
      </Link>

      <div className="mt-5 md:mt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Daily Challenge</h1>
        <p className="mt-2 max-w-2xl text-base text-slate-300 md:mt-3 md:text-lg">
          {session.isFallback
            ? "You're new here — today's challenge uses the starter topics."
            : "Ten questions, fresh every day, drawn from the topics you've studied."}
        </p>
      </div>

      {completed ? (
        drillEntries ? (
          /* ── One-tap re-drill over the words missed this run ── */
          <RedrillPanel
            entries={drillEntries}
            onRecordAnswer={recordQuizAnswer}
            onClose={() => setDrillEntries(null)}
          />
        ) : (
        /* ── Completed state ── */
        <div className="animate-celebrate mt-12 rounded-3xl border border-white/10 bg-surface p-8 text-center">
          {done ? (
            <>
              <p className="text-6xl">{displayScore === displayTotal ? "🏆" : displayScore >= 8 ? "🎉" : "💪"}</p>
              <p className="mt-4 text-2xl font-semibold text-white">
                {displayScore === displayTotal
                  ? "Perfect ten!"
                  : displayScore >= 8
                  ? "Challenge complete!"
                  : "Challenge complete — tomorrow's a fresh ten."}
              </p>
            </>
          ) : (
            <>
              <p className="text-6xl">✅</p>
              <p className="mt-4 text-2xl font-semibold text-white">
                You&apos;ve done today&apos;s challenge. A new one lands at midnight UTC.
              </p>
            </>
          )}

          <p className="mt-3 text-5xl font-bold text-emerald-300">
            {displayScore}
            <span className="text-2xl text-slate-400">/{displayTotal}</span>
          </p>

          {streak > 0 ? <p className="mt-3 text-lg font-semibold text-amber-300">🔥 {streak}-day challenge streak</p> : null}

          <DailyShare day={session.day} outcomes={displayOutcomes} />

          {/* Missed-word list + one-tap re-drill (live run only — the stored
              replay has no per-word data). The drill records quiz accuracy but
              never changes today's official score or the share strip above. */}
          {missedEntries.length > 0 ? (
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-surface-2 p-5 text-left">
              <p className="text-sm font-semibold text-slate-300">{missedEntries.length} to review</p>
              <ul className="mt-3 space-y-2">
                {missedEntries.map((e) => (
                  <li key={e.key} className="flex items-baseline gap-3">
                    <span lang={HANZI_LANG} className="font-hanzi text-xl text-white">{e.item.hanzi}</span>
                    <span lang={PINYIN_LANG} className="font-hanzi text-sm text-emerald-300">{e.item.pinyin}</span>
                    <span className="text-sm text-slate-400">{e.item.english}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setDrillEntries(missedEntries)}
                className="mt-4 min-h-[44px] w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
              >
                Re-drill the {missedEntries.length} you missed
              </button>
              <p className="mt-2 text-xs text-slate-500">A quick extra pass — today&apos;s score stays as is.</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/review"
              className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            >
              Daily review
            </Link>
            <Link
              href="/practice"
              className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Practice weak words
            </Link>
          </div>
        </div>
        )
      ) : (
        /* ── Active run ── */
        <section className="mt-5 rounded-3xl border border-white/10 bg-surface p-4 md:mt-8 md:p-6" aria-label="Daily challenge quiz">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              Question {index + 1} of {total}
            </p>
            <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              {MODE_LABELS[current.mode]}
            </span>
          </div>

          {/* Progress bar through the deck */}
          <div className="progress-bar-track mt-2">
            <div className="progress-bar-fill" style={{ width: `${(index / total) * 100}%` }} />
          </div>

          <p className="mt-3 text-right text-sm font-semibold text-emerald-300 md:mt-4">Score {score}</p>

          {/* Prompt */}
          <div className="mt-4 text-center md:mt-6">
            <div className="flex items-center justify-center gap-3">
              <h2
                lang={quizPromptLang(current.mode)}
                className={`font-hanzi text-6xl font-semibold text-white md:text-7xl ${current.mode === "english-hanzi" ? "font-sans text-3xl md:text-4xl" : ""}`}
              >
                {current.card.prompt}
              </h2>
              {current.mode !== "english-hanzi" ? (
                <SpeakButton text={current.item.hanzi} label={`Pronounce: ${current.item.hanzi}`} />
              ) : null}
            </div>
            {current.card.promptPinyin ? (
              <p lang={PINYIN_LANG} className="font-hanzi mt-1 text-xl text-emerald-300 md:mt-2 md:text-2xl">
                {current.card.promptPinyin}
              </p>
            ) : null}
          </div>

          {/* Choices */}
          <div className="mt-5 grid gap-2 md:mt-8 md:grid-cols-2 md:gap-3" role="listbox" aria-label="Answer choices">
            {current.card.choices.map((choice, i) => {
              const right = picked !== null && choice === current.card.answer;
              const wrong = picked === choice && choice !== current.card.answer;
              return (
                <button
                  key={`${index}:${choice}`}
                  type="button"
                  onClick={() => handleAnswer(choice)}
                  role="option"
                  aria-selected={picked === choice}
                  aria-disabled={picked !== null && picked !== choice}
                  aria-keyshortcuts={i < 9 ? `${i + 1}` : undefined}
                  className={`flex min-h-[48px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition md:min-h-[52px] md:px-5 md:py-4 md:text-base
                    ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
                    ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                    ${!right && !wrong ? "border-white/10 bg-background text-white hover:border-emerald-300" : ""}
                  `}
                >
                  {i < 9 ? (
                    <kbd className="kbd hidden md:inline-flex" aria-hidden="true">
                      {i + 1}
                    </kbd>
                  ) : null}
                  <span
                    lang={quizChoiceLang(current.mode)}
                    className={current.mode === "english-hanzi" || current.mode === "hanzi-pinyin" ? "font-hanzi" : ""}
                  >
                    {choice}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Reveal line — pinyin ALWAYS accompanies the hanzi (project rule). */}
          {picked !== null ? (
            <div className="mt-6 text-center" role="status">
              <p className="inline-flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                <span lang={HANZI_LANG} className="font-hanzi text-2xl text-white">
                  {current.item.hanzi}
                </span>
                <span lang={PINYIN_LANG} className="font-hanzi text-lg text-emerald-300">
                  {current.item.pinyin}
                </span>
                <span className="text-lg text-slate-400">· {current.item.english}</span>
              </p>
            </div>
          ) : null}

          {/* Desktop-only shortcut hint; screen readers use aria-keyshortcuts above. */}
          <p className="mt-4 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
            {picked ? "Enter next · P pronounce" : "1–4 choose · P pronounce"}
          </p>

          {picked ? (
            <div className="mt-5 md:mt-6">
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta sm:w-auto"
                aria-label={index + 1 >= total ? "See results" : "Next question"}
                aria-keyshortcuts="Enter"
              >
                {index + 1 >= total ? "See results" : "Next question"}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {/* Wordle-style history of past daily challenges. Visible in both the
          active and completed states so learners can browse before playing. */}
      <ChallengeArchive dailyChallenge={progress.dailyChallenge} today={session.day} />
    </main>
  );
}

// The Wordle-style emoji strip plus a "Share score" button that copies the
// plain-text block to the clipboard, flashing "Copied!" on success. Mirrors
// copy-button.tsx: renders nothing where the Clipboard API is unavailable.
function DailyShare({ day, outcomes }: { day: string; outcomes: boolean[] }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(shareText(day, outcomes)).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }, [day, outcomes]);

  const clipboardAvailable = typeof navigator === "undefined" || Boolean(navigator.clipboard);

  return (
    <div className="mt-6">
      <p className="text-2xl tracking-wide" aria-hidden="true">
        {outcomes.map((ok) => (ok ? "🟩" : "🟥")).join("")}
      </p>
      {clipboardAvailable ? (
        <button
          type="button"
          onClick={copy}
          className="mt-4 min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
          aria-label="Copy your score to share"
        >
          {copied ? "Copied!" : "Share score"}
        </button>
      ) : null}
    </div>
  );
}
