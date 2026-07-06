"use client";

import { useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { wordKey } from "@/lib/data-logic";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { defaultShuffle } from "@/lib/quiz-logic";
import {
  SLOW_SPEECH_RATE,
  buildSentenceListenDeck,
  type SentenceListenCard,
} from "@/lib/sentence-listen-logic";
import { SpeakButton } from "../speak-button";
import { useSpeech } from "../use-speech";

// The "Listening" tab: sentence listening comprehension. On each card the learner
// taps play, hears one of the topic's real example sentences via the browser's
// Chinese TTS voice, and picks the correct English translation from four choices.
// No Chinese text is shown before answering (that would leak the answer); after
// answering the sentence hanzi, the drilled word (hanzi/pinyin/meaning), and
// replay + slow-replay controls are revealed. All card/distractor logic lives in
// src/lib/sentence-listen-logic.ts — this panel only holds drill state, drives
// speech, and renders. Answers persist through the same recordQuizAnswer path as
// the quiz, so misses feed Trickiest words and /practice. No schema change.
//
// Rendered only when speech is confirmed available (topic-app double-gates the
// tab and this render), so the panel never appears on voiceless devices.
export function SentenceListenPanel({
  topic,
  onRecord,
}: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
}) {
  const keyFor = (item: VocabItem) => wordKey(topic, item);
  const { status, speak } = useSpeech();

  // Built once per mount/restart so answering never reshuffles the live deck.
  const [deck, setDeck] = useState<SentenceListenCard[]>(() =>
    buildSentenceListenDeck(topic.items, topic.items, keyFor, defaultShuffle),
  );
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  // The card whose sentence has been played at least once, so the "Replay" link
  // only appears after the first tap (mirrors the quiz's listening card).
  const [playedKey, setPlayedKey] = useState<string | null>(null);

  // No cards at all (defensive; the dataset guarantees 10 per topic).
  if (deck.length === 0) return null;

  const total = deck.length;
  const current = deck[index];
  const answered = picked !== null;

  function restart() {
    setDeck(buildSentenceListenDeck(topic.items, topic.items, keyFor, defaultShuffle));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDone(false);
    setPlayedKey(null);
  }

  // ── Completion summary ──
  if (done) {
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Sentence listening practice"
      >
        <p className="text-6xl">{score === total ? "🎉" : "💪"}</p>
        <p className="mt-4 text-2xl font-semibold text-white">Listening complete!</p>
        <p className="mt-3 text-5xl font-bold text-emerald-300">
          {score}
          <span className="text-2xl text-slate-400">/{total}</span>
        </p>
        <p className="mt-2 text-slate-400">
          {score === total
            ? "Perfect — you understood every sentence."
            : "Training your ear takes reps — try another round."}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={restart}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  function answer(choice: string) {
    if (picked !== null) return; // already answered this card
    const correct = choice === current.answer;
    // The guard above means this fires exactly once per card, so per-word quiz
    // accuracy is recorded once per attempt — same semantics as the quiz.
    onRecord(current.key, correct);
    setPicked(choice);
    if (correct) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Sentence listening practice"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Sentence {index + 1} of {total}
        </p>
        <p className="text-sm font-semibold text-emerald-300">Score {score}</p>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-track mt-2">
        <div className="progress-bar-fill" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      {/* Prompt: a big play button before answering — no hanzi/pinyin/English
          sentence (that would leak the answer). No autoplay; the learner taps. */}
      <div className="mt-8 flex flex-col items-center text-center">
        <button
          type="button"
          onClick={() => {
            speak(current.sentenceCn);
            setPlayedKey(current.key);
          }}
          aria-label="Play the sentence"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <p className="mt-4 text-sm text-slate-400">Listen to the sentence, then pick its meaning</p>
        {playedKey === current.key ? (
          <button
            type="button"
            onClick={() => speak(current.sentenceCn)}
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

      {/* Choices — English translations, same feedback styling as the quiz.
          English inherits the root lang, so no lang attribute here. */}
      <div className="mt-8 grid gap-3 md:grid-cols-2" role="listbox" aria-label="Answer choices">
        {current.choices.map((choice) => {
          const right = answered && choice === current.answer;
          const wrong = picked === choice && choice !== current.answer;
          return (
            <button
              key={`${index}:${choice}`}
              type="button"
              onClick={() => answer(choice)}
              role="option"
              aria-selected={picked === choice}
              aria-disabled={answered && picked !== choice}
              className={`min-h-[52px] rounded-2xl border px-5 py-4 text-center transition
                ${right ? "animate-quiz-correct border-emerald-300 bg-emerald-300 text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {/* After answering: reveal the sentence hanzi (with replay controls) and the
          drilled word (hanzi/pinyin/meaning). role="status" so it's announced. */}
      {answered ? (
        <div role="status" className="mt-6 rounded-2xl border border-white/10 bg-surface-2 p-5">
          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            <p lang={HANZI_LANG} className="font-hanzi text-base text-slate-300">
              {current.sentenceCn}
            </p>
            <SpeakButton text={current.sentenceCn} label="Hear the sentence again" />
            <button
              type="button"
              onClick={() => speak(current.sentenceCn, { rate: SLOW_SPEECH_RATE })}
              aria-label="Replay the sentence slowly"
              className="min-h-[36px] rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-emerald-300"
            >
              Play slower 🐢
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline justify-center gap-3 text-center">
            <span lang={HANZI_LANG} className="font-hanzi text-2xl text-white">
              {current.hanzi}
            </span>
            <span lang={PINYIN_LANG} className="font-hanzi text-lg text-emerald-300">
              {current.pinyin}
            </span>
            <span className="text-sm text-slate-400">{current.english}</span>
          </div>
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={next}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              {index + 1 >= total ? "See results" : "Next sentence"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
