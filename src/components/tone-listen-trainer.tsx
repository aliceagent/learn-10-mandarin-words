"use client";

import { useEffect, useMemo, useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import type { Tone } from "@/lib/pinyin";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { TONE_TEXT_CLASS } from "@/lib/tone-colors";
import { listeningHint } from "@/lib/speech";
import { track } from "@/lib/analytics";
import {
  TONE_GLYPHS,
  buildToneRounds,
  hasThirdTonePair,
  patternAriaLabel,
  patternKey,
  streakLabel,
  type TonePattern,
} from "@/lib/tone-trainer-logic";
import { SpeakButton } from "./speak-button";
import { TonePinyin } from "./tone-pinyin";
import { useSpeech } from "./use-speech";
import { useToneColors } from "./use-tone-colors";

// Audio-first tone drill (Fable Sprint 8): the app speaks a word and the learner
// picks its whole tone pattern in one tap. The inverse of the eyes-first
// `TonePractice` per-syllable drill. Tones are derived from pinyin via the pure
// `tone-trainer-logic` module; answers flow through `onRecord` (recordQuizAnswer)
// so they feed quizStats / the daily-goal ring like every other drill. No new
// storage keys, no schema change.

// Render a tone pattern as spaced diacritic glyphs, tone-colored when the
// device-local "Tone colors" setting is on (additive — the digit hint below
// always carries the meaning too).
function PatternGlyphs({ pattern, colored }: { pattern: TonePattern; colored: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" aria-hidden="true">
      {pattern.map((tone: Tone, i) => (
        <span key={i} className={colored ? TONE_TEXT_CLASS[tone] : undefined}>
          {TONE_GLYPHS[tone]}
        </span>
      ))}
    </span>
  );
}

export function ToneListenTrainer({
  topic,
  keyFor,
  onRecord,
  onPracticeReading,
}: {
  topic: Topic;
  keyFor: (item: VocabItem) => string;
  onRecord: (key: string, correct: boolean) => void;
  onPracticeReading?: () => void;
}): React.JSX.Element | null {
  // Bumping `seed` reshuffles the round order for a fresh "Play again" run.
  const [seed, setSeed] = useState(0);
  // `seed` is listed so "Play again" re-derives a freshly shuffled round order
  // even though it isn't read in the body (hence the exhaustive-deps override).
  const rounds = useMemo(
    () => buildToneRounds(topic, keyFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, keyFor, seed],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [playedKey, setPlayedKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { speak, stop, status, availability } = useSpeech();
  const { enabled: toneColors } = useToneColors();
  // Connectivity dropped mid-run and every Chinese voice on this device is
  // online-only: each round would autoplay silence. Steer to the reading drill
  // instead of offering broken play buttons (Sprint 27).
  const offline = availability === "offline-voices";

  // Silence any in-flight audio when the drill unmounts (tab/mode switch, nav).
  useEffect(() => stop, [stop]);

  if (rounds.length === 0) return null;

  const round = rounds[index];
  const total = rounds.length;
  const isCorrect = picked !== null && picked === patternKey(round.answer);
  const isLast = index >= total - 1;

  function play() {
    speak(round.hanzi);
    setPlayedKey(round.key);
  }

  function pick(option: TonePattern) {
    if (picked !== null) return; // first tap wins — record exactly once
    const correct = patternKey(option) === patternKey(round.answer);
    setPicked(patternKey(option));
    onRecord(round.key, correct);
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
    if (isLast) {
      setDone(true);
      track("tone_listen_completed", {
        topic: topic.slug,
        total,
        correct: score,
        bestStreak,
      });
      return;
    }
    const nextRound = rounds[index + 1];
    setIndex(index + 1);
    setPicked(null);
    // Speak the next word inside this click handler so mobile autoplay policies
    // (which require a user gesture) are satisfied — no extra tap needed.
    speak(nextRound.hanzi);
    setPlayedKey(nextRound.key);
  }

  function playAgain() {
    setSeed((s) => s + 1);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setPlayedKey(null);
    setDone(false);
  }

  // ── Summary ──
  if (done) {
    const pct = total > 0 ? score / total : 0;
    const message =
      pct === 1
        ? "Perfect — you heard every tone."
        : pct >= 0.8
        ? "Sharp ears! A couple more listens and it's yours."
        : "Tones take time — one more round tunes the ear.";
    return (
      <section
        className="animate-celebrate mt-4 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Tone trainer results"
      >
        <p className="text-5xl">🎧</p>
        <p className="mt-4 text-2xl font-semibold text-white">Ear training complete!</p>
        <p className="mt-3 text-5xl font-bold text-emerald-300">
          {score}
          <span className="text-2xl text-slate-400">/{total}</span>
        </p>
        <p className="mt-2 text-sm text-slate-400">Best streak: {bestStreak}</p>
        <p className="mt-3 text-slate-400">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={playAgain}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            Play again
          </button>
          {onPracticeReading ? (
            <button
              type="button"
              onClick={onPracticeReading}
              className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
            >
              Practice reading tones
            </button>
          ) : null}
        </div>
        <p className="mt-6 text-xs text-slate-600">
          Tone patterns come from each word&apos;s pinyin. Your results stay on this device.
        </p>
      </section>
    );
  }

  // ── Active round ──
  const streakNote = streakLabel(streak);
  return (
    <section
      className="mt-4 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Listening tone trainer"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Word {index + 1} of {total}
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

      {offline ? (
        // Connectivity dropped mid-run: every round would autoplay silence on
        // this device, so replace the drill with an honest notice and a one-tap
        // steer to the eyes-first reading drill (which works offline).
        <div className="mt-8 rounded-2xl border border-white/10 bg-surface-2 p-6 text-center">
          <p className="text-3xl" aria-hidden="true">🔇</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
            You&apos;re offline, and this device&apos;s Chinese voice needs the internet. Keep
            practicing with a visual mode — everything else works offline.
          </p>
          {onPracticeReading ? (
            <button
              type="button"
              onClick={onPracticeReading}
              className="mt-4 min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            >
              Practice reading tones
            </button>
          ) : null}
        </div>
      ) : (
        <>
      {/* Audio zone: before answering, nothing identifies the word. */}
      {picked === null ? (
        <div className="mt-8 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={play}
            aria-label="Play the word"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-cta"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <p className="mt-4 text-sm text-slate-400">Listen, then pick the tone pattern</p>
          {playedKey === round.key ? (
            <button
              type="button"
              onClick={() => speak(round.hanzi)}
              className="mt-2 min-h-[44px] text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
            >
              Replay
            </button>
          ) : null}
          <p className="mt-2 text-xs text-slate-600">{listeningHint(status, availability)}</p>
        </div>
      ) : (
        // After answering: reveal the word (hanzi + tone-marked pinyin + English).
        <div className="mt-8 text-center" role="status">
          <div className="flex items-center justify-center gap-3">
            <h3 lang={HANZI_LANG} className="font-hanzi text-5xl font-semibold text-white">
              {round.hanzi}
            </h3>
            <SpeakButton text={round.hanzi} label={`Pronounce: ${round.hanzi}`} />
          </div>
          <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-2xl text-emerald-300">
            <TonePinyin pinyin={round.pinyin} />
          </p>
          <p className="mt-1 text-sm text-slate-400">{round.english}</p>
          <p
            className={`mt-3 text-sm font-semibold ${isCorrect ? "text-emerald-300" : "text-rose-300"}`}
          >
            {isCorrect ? (
              "Correct — golden ear!"
            ) : (
              <>
                Not quite — it was{" "}
                <span className="font-hanzi">{round.answer.map((t) => TONE_GLYPHS[t]).join(" ")}</span>{" "}
                ({round.answer.join("-")}).
              </>
            )}
          </p>
          {hasThirdTonePair(round.answer) ? (
            <p className="mt-2 text-xs text-slate-500">
              Heads up: two 3rd tones in a row are spoken like 2-3 — we show the written tones.
            </p>
          ) : null}
        </div>
      )}

      {/* Tone-pattern choices. */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2" role="listbox" aria-label="Tone pattern choices">
        {round.options.map((option) => {
          const key = patternKey(option);
          const right = picked !== null && key === patternKey(round.answer);
          const wrong = picked === key && key !== patternKey(round.answer);
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(option)}
              role="option"
              aria-selected={picked === key}
              aria-disabled={picked !== null && picked !== key}
              aria-label={patternAriaLabel(option)}
              className={`flex min-h-[56px] items-center justify-center gap-3 rounded-2xl border px-5 py-4 text-2xl font-semibold transition
                ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              <span className="font-hanzi">
                <PatternGlyphs pattern={option} colored={toneColors && !right} />
              </span>
              <span className="text-sm text-slate-400">({option.join("-")})</span>
            </button>
          );
        })}
      </div>

      {/* Streak flash + advance. */}
      <span aria-live="polite" className="sr-only">
        {streakNote ?? ""}
      </span>
      {picked !== null ? (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={next}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            {isLast ? "See results" : "Next word"}
          </button>
          {streakNote ? (
            <p className="text-sm font-semibold text-emerald-300">{streakNote}</p>
          ) : null}
        </div>
      ) : null}

        </>
      )}

      <p className="mt-4 text-xs text-slate-600">
        Tone patterns come from each word&apos;s pinyin. Your results stay on this device.
      </p>
    </section>
  );
}
