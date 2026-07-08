"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MandarinData } from "@/lib/types";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { track } from "@/lib/analytics";
import {
  buildTonePairGroups,
  buildTonePairSession,
  resultMessage,
  type TonePairWord,
} from "@/lib/tone-pairs-logic";
import { streakLabel } from "@/lib/tone-trainer-logic";
import { useProgress } from "./use-progress";
import { useSpeech } from "./use-speech";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";
import { TonePinyin } from "./tone-pinyin";

// The /tone-pairs route ("Tone Twins"): a ≤10-round minimal-pair listening drill.
// The app speaks a real dataset word and the learner picks which of two (or
// three) real words — same tone-stripped base, different tone — they heard. Page
// shell mirrors lightning-app.tsx (idle → running → done, LoadingScreen while
// progress hydrates); round UX mirrors tone-listen-trainer.tsx (play button,
// Replay, no-voice warning, speak-inside-click for mobile autoplay). Answers flow
// through recordQuizAnswer under the word's canonical wordKey — no new storage.

type Phase = "idle" | "running" | "done";

export function TonePairsApp({ data }: { data: MandarinData }): React.JSX.Element {
  const { loaded, recordQuizAnswer } = useProgress();
  const { speak, stop, status } = useSpeech();

  // The full set of tone-pair groups, derived once from the dataset.
  const groups = useMemo(() => buildTonePairGroups(data.topics), [data.topics]);

  const [phase, setPhase] = useState<Phase>("idle");
  // Bumping `seed` reshuffles the session (group order + spoken twin) on replay.
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(
    () => buildTonePairSession(groups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, seed],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [playedKey, setPlayedKey] = useState<string | null>(null);

  // Silence any in-flight audio when the drill unmounts (tab/mode switch, nav).
  useEffect(() => stop, [stop]);

  if (!loaded) {
    return <LoadingScreen message="Loading Tone Twins…" />;
  }

  const round = rounds[index];
  const total = rounds.length;
  const answered = picked !== null;
  const isCorrect = answered && round !== undefined && picked === round.target.key;
  const isLast = index >= total - 1;

  function speakWord(word: TonePairWord) {
    speak(word.hanzi);
    setPlayedKey(word.key);
  }

  function startSession() {
    if (rounds.length === 0) return; // graceful empty state guards this too
    setIndex(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setPlayedKey(null);
    setPhase("running");
    // Speak inside the Start click so mobile autoplay policies are satisfied.
    speakWord(rounds[0].target);
  }

  function pick(word: TonePairWord) {
    if (picked !== null || !round) return; // first tap wins — record exactly once
    const correct = word.key === round.target.key;
    setPicked(word.key);
    recordQuizAnswer(round.target.key, correct);
    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  }

  function next() {
    if (!round) return;
    if (isLast) {
      setPhase("done");
      track("tone_pairs_completed", { total, correct: score, bestStreak });
      return;
    }
    const nextRound = rounds[index + 1];
    setIndex(index + 1);
    setPicked(null);
    // Speak the next target inside this click handler (mobile autoplay policy).
    speakWord(nextRound.target);
  }

  function playAgain() {
    setSeed((s) => s + 1);
    setPhase("idle");
    setIndex(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setPlayedKey(null);
  }

  // ── Graceful empty state (only if the dataset ever loses all pairs) ──
  if (groups.length === 0) {
    return (
      <main className="mobile-bottom-safe mx-auto max-w-3xl px-6 pt-8 md:px-10">
        <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          ← Home
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white md:text-5xl">Tone Twins</h1>
        <div className="mt-10 rounded-3xl border border-white/10 bg-surface p-8 text-center text-slate-300">
          No tone-twin pairs are available in the current word set right now.
        </div>
      </main>
    );
  }

  const streakNote = streakLabel(streak);

  return (
    <main className="mobile-bottom-safe mx-auto max-w-3xl px-6 pt-8 md:px-10">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
        ← Home
      </Link>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Tone Twins</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-300">
          Two real words, same sounds, different tones. Can your ear tell{" "}
          <span lang={HANZI_LANG} className="font-hanzi">书</span>{" "}
          <span lang={PINYIN_LANG} className="font-hanzi">shū</span> from{" "}
          <span lang={HANZI_LANG} className="font-hanzi">树</span>{" "}
          <span lang={PINYIN_LANG} className="font-hanzi">shù</span>?
        </p>
      </div>

      {phase === "idle" ? (
        /* ── Start screen ── */
        <div className="mt-10 rounded-3xl border border-white/10 bg-surface p-8 text-center">
          <p className="text-6xl">🎧</p>
          <p className="mt-4 text-lg font-semibold text-white">Start ear training</p>
          <p className="mt-2 text-sm text-slate-400">
            10 quick rounds · words you already know · results stay on this device.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={startSession}
              className="min-h-[44px] rounded-full bg-emerald-400 px-8 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cta"
            >
              Start ear training
            </button>
          </div>
        </div>
      ) : phase === "running" && round ? (
        /* ── Active round ── */
        <section className="mt-8 rounded-3xl border border-white/10 bg-surface p-6" aria-label="Tone Twins drill">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              Pair {index + 1} of {total}
            </p>
            <div className="flex items-center gap-2">
              {streak > 0 ? (
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  🔥 {streak}
                </span>
              ) : null}
              <span className="text-sm font-semibold text-emerald-300">Ear training</span>
            </div>
          </div>

          {/* Audio zone: before answering, nothing identifies which twin was spoken. */}
          {!answered ? (
            <div className="mt-8 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => speakWord(round.target)}
                aria-label="Play the word"
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-cta"
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <p className="mt-4 text-sm text-slate-400">Listen, then pick the word you heard</p>
              {playedKey === round.target.key ? (
                <button
                  type="button"
                  onClick={() => speak(round.target.hanzi)}
                  className="mt-2 min-h-[44px] text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
                >
                  Replay
                </button>
              ) : null}
              <p className="mt-2 text-xs text-slate-600">
                {status === "no-chinese-voice"
                  ? "Your device has no Chinese voice installed, so listening mode may be silent."
                  : "No sound? Your device may lack a Chinese voice."}
              </p>
            </div>
          ) : (
            /* After answering: reveal both twins so the learner can A/B the contrast. */
            <div className="mt-8" role="status">
              <p className={`text-center text-sm font-semibold ${isCorrect ? "text-emerald-300" : "text-rose-300"}`}>
                {isCorrect
                  ? `Correct — that was ${round.target.hanzi} ${round.target.pinyin} (${round.target.english}).`
                  : `Not quite — you heard ${round.target.hanzi} ${round.target.pinyin} (${round.target.english}), not ${
                      round.options.find((w) => w.key === picked)?.hanzi
                    } ${round.options.find((w) => w.key === picked)?.pinyin}.`}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {round.options.map((word) => {
                  const isTarget = word.key === round.target.key;
                  const isWrongPick = word.key === picked && !isTarget;
                  return (
                  <div
                    key={word.key}
                    className={`rounded-2xl border px-5 py-4 text-center ${
                      isTarget
                        ? "animate-quiz-correct border-emerald-300/60 bg-emerald-400/10"
                        : isWrongPick
                        ? "animate-quiz-wrong border-rose-400/60 bg-rose-400/10"
                        : "border-white/10 bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span lang={HANZI_LANG} className="font-hanzi text-3xl font-semibold text-white">
                        {word.hanzi}
                      </span>
                      <SpeakButton text={word.hanzi} label={`Hear ${word.hanzi}`} />
                    </div>
                    <p lang={PINYIN_LANG} className="font-hanzi mt-1 text-xl text-emerald-300">
                      <TonePinyin pinyin={word.pinyin} />
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{word.english}</p>
                  </div>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-xs text-slate-500">
                Same syllable, different tone:{" "}
                {round.options.map((w) => w.pinyin).join(" vs ")}.
              </p>
            </div>
          )}

          {/* Option cards — the pair. Hidden once answered (the reveal shows them). */}
          {!answered ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2" role="listbox" aria-label="Which word did you hear?">
              {round.options.map((word) => (
                <button
                  key={word.key}
                  type="button"
                  onClick={() => pick(word)}
                  role="option"
                  aria-selected={false}
                  className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-surface-2 px-5 py-4 text-center transition hover:border-emerald-300"
                >
                  <span lang={HANZI_LANG} className="font-hanzi text-3xl font-semibold text-white">
                    {word.hanzi}
                  </span>
                  <span lang={PINYIN_LANG} className="font-hanzi text-lg text-emerald-300">
                    <TonePinyin pinyin={word.pinyin} />
                  </span>
                  <span className="text-sm text-slate-400">{word.english}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Streak flash + advance. */}
          <span aria-live="polite" className="sr-only">
            {streakNote ?? ""}
          </span>
          {answered ? (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={next}
                className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
              >
                {isLast ? "See results" : "Next pair"}
              </button>
              {streakNote ? <p className="text-sm font-semibold text-emerald-300">{streakNote}</p> : null}
            </div>
          ) : null}

          <p className="mt-4 text-xs text-slate-600">
            Every pair is two real words from the topic library. Your results stay on this device.
          </p>
        </section>
      ) : phase === "done" ? (
        /* ── Summary ── */
        <div
          className="animate-celebrate mt-10 rounded-3xl border border-white/10 bg-surface p-8 text-center"
          aria-label="Tone Twins results"
        >
          <p className="text-5xl">🎧</p>
          <p className="mt-4 text-2xl font-semibold text-white">Ear training complete!</p>
          <p className="mt-3 text-5xl font-bold text-emerald-300">
            {score}
            <span className="text-2xl text-slate-400">/{total}</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">Best streak: {bestStreak}</p>
          <p className="mt-3 text-slate-400">{resultMessage(score, total)}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={playAgain}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            >
              Play again
            </button>
            <Link
              href="/stats"
              className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Back to stats
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-600">
            Every pair is two real words from the topic library. Your results stay on this device.
          </p>
        </div>
      ) : null}
    </main>
  );
}
