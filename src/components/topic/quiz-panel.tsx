"use client";

import { useState } from "react";
import type { VocabItem } from "@/lib/types";
import type { QuizCard, QuizMode } from "@/lib/quiz-logic";
import { HANZI_LANG, PINYIN_LANG, quizChoiceLang, quizPromptLang } from "@/lib/lang";
import { SpeakButton } from "../speak-button";
import { useSpeech } from "../use-speech";

type QuizViewState = { index: number; score: number; picked: string | null };

// The "Quiz" tab: either the multiple-choice quiz itself or, once every card is
// answered, the completion screen with the missed-word summary and retry/restart
// actions. All quiz state (mode, index, score, missed keys, active items) lives
// in the parent so it survives switching tabs and so the parent can drive the
// next-step panel off `quizComplete`; this component only renders and reports
// intents. Extracted verbatim from topic-app's `mode === "quiz"` section.
export function QuizPanel({
  quizComplete,
  quiz,
  currentQuiz,
  quizMode,
  quizState,
  missedItemsList,
  speechAvailable,
  onChangeQuizMode,
  onAnswer,
  onNext,
  onRetryMissed,
  onRestart,
  onPracticeFlashcards,
}: {
  quizComplete: boolean;
  quiz: QuizCard[];
  currentQuiz: QuizCard;
  quizMode: QuizMode;
  quizState: QuizViewState;
  missedItemsList: VocabItem[];
  speechAvailable: boolean;
  onChangeQuizMode: (m: QuizMode) => void;
  onAnswer: (choice: string) => void;
  onNext: () => void;
  onRetryMissed: () => void;
  onRestart: () => void;
  onPracticeFlashcards: () => void;
}) {
  // Tracks the card whose audio has played, so the "Replay" affordance appears
  // only after the learner first taps play on the current listening card.
  const [playedKey, setPlayedKey] = useState<string | null>(null);
  // Hardened speech for the listening-mode play/replay buttons (voice selection,
  // stuck-pause recovery, cancel-race workaround). `status` also drives the
  // stronger no-voice microcopy below.
  const { speak, status } = useSpeech();

  if (quizComplete) {
    /* Celebration screen */
    return (
      <div className="animate-celebrate mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-6xl">{missedItemsList.length === 0 ? "🎉" : "💪"}</p>
        <p className="mt-4 text-2xl font-semibold text-white">Quiz complete!</p>
        <p className="mt-3 text-5xl font-bold text-emerald-300">{quizState.score}<span className="text-2xl text-slate-400">/{quiz.length}</span></p>
        <p className="mt-2 text-slate-400">
          {missedItemsList.length === 0
            ? "Perfect score! Every answer correct."
            : quizState.score >= Math.ceil(quiz.length * 0.8)
            ? "Great job! Just a few to nail down."
            : "Keep practicing — retry the ones you missed below."}
        </p>

        {/* Missed-words summary + retry (only when there were mistakes) */}
        {missedItemsList.length > 0 ? (
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-surface-2 p-5 text-left">
            <p className="text-sm font-semibold text-slate-300">
              {missedItemsList.length} to review
            </p>
            <ul className="mt-3 space-y-2">
              {missedItemsList.map((item) => (
                <li key={item.hanzi} className="flex items-baseline gap-3">
                  <span lang={HANZI_LANG} className="font-hanzi text-xl text-white">{item.hanzi}</span>
                  <span lang={PINYIN_LANG} className="font-hanzi text-sm text-emerald-300">{item.pinyin}</span>
                  <span className="text-sm text-slate-400">{item.english}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {missedItemsList.length > 0 ? (
            <button
              type="button"
              onClick={onRetryMissed}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Retry missed ({missedItemsList.length})
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRestart}
            className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onPracticeFlashcards}
            className={`min-h-[44px] rounded-full px-6 py-3 font-semibold transition ${missedItemsList.length === 0 ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "border border-white/15 text-white hover:border-emerald-300"}`}
          >
            Practice flashcards
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-surface p-6" aria-label="Quiz practice">
      {/* Quiz mode selector */}
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Quiz mode">
        {([
          { key: "hanzi-english", label: "Hanzi → English" },
          { key: "english-hanzi", label: "English → Hanzi" },
          { key: "hanzi-pinyin", label: "Hanzi → Pinyin" },
          // Listening mode only appears once speech synthesis is confirmed
          // available (detected post-hydration in topic-app), so there's never a
          // dead mode on devices without a voice.
          ...(speechAvailable ? [{ key: "listening", label: "Listen 🔊" } as const] : []),
        ] as const).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onChangeQuizMode(m.key)}
            // Quieter Level-2 selector (matches the topic mode tabs): the active
            // mode is a subtle emerald wash + accent ink, not a full emerald fill.
            className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold transition ${quizMode === m.key ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"}`}
            aria-pressed={quizMode === m.key}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Question {(quizState.index % quiz.length) + 1} of {quiz.length}</p>
        <p className="text-sm font-semibold text-emerald-300">Score {quizState.score}</p>
      </div>

      {/* Progress bar through quiz */}
      <div className="progress-bar-track mt-2">
        <div className="progress-bar-fill" style={{ width: `${(quizState.index / quiz.length) * 100}%` }} />
      </div>

      {/* Prompt */}
      {quizMode === "listening" ? (
        quizState.picked === null ? (
          // Before answering: no hanzi/pinyin (that would leak the answer). Just
          // a big play button + helper text. No autoplay — the learner taps play.
          <div className="mt-8 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => {
                speak(currentQuiz.prompt);
                setPlayedKey(currentQuiz.key);
              }}
              aria-label="Play the word"
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <p className="mt-4 text-sm text-slate-400">Listen, then pick the meaning</p>
            {playedKey === currentQuiz.key ? (
              <button
                type="button"
                onClick={() => speak(currentQuiz.prompt)}
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
          // After answering: reveal the ground-truth hanzi + pinyin. role="status"
          // so the reveal is announced to screen readers.
          <div className="mt-8 text-center" role="status">
            <div className="flex items-center justify-center gap-3">
              <h2 lang={HANZI_LANG} className="font-hanzi text-5xl font-semibold text-white">{currentQuiz.prompt}</h2>
              <SpeakButton text={currentQuiz.prompt} label={`Pronounce: ${currentQuiz.prompt}`} />
            </div>
            {currentQuiz.promptPinyin ? (
              <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-2xl text-emerald-300">{currentQuiz.promptPinyin}</p>
            ) : null}
          </div>
        )
      ) : (
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <h2 lang={quizPromptLang(quizMode)} className={`font-hanzi text-7xl font-semibold text-white ${quizMode === "english-hanzi" ? "font-sans text-4xl" : ""}`}>
              {currentQuiz.prompt}
            </h2>
            {(quizMode === "hanzi-english" || quizMode === "hanzi-pinyin") ? (
              <SpeakButton text={currentQuiz.prompt} label={`Pronounce: ${currentQuiz.prompt}`} />
            ) : null}
          </div>
          {currentQuiz.promptPinyin ? (
            <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-2xl text-emerald-300">{currentQuiz.promptPinyin}</p>
          ) : null}
        </div>
      )}

      {/* Choices */}
      <div className="mt-8 grid gap-3 md:grid-cols-2" role="listbox" aria-label="Answer choices">
        {currentQuiz.choices.map((choice) => {
          const right = quizState.picked !== null && choice === currentQuiz.answer;
          const wrong = quizState.picked === choice && choice !== currentQuiz.answer;
          return (
            <button
              key={`${quizState.index}:${choice}`}
              type="button"
              onClick={() => onAnswer(choice)}
              role="option"
              aria-selected={quizState.picked === choice}
              aria-disabled={quizState.picked !== null && quizState.picked !== choice}
              className={`min-h-[52px] rounded-2xl border px-5 py-4 text-left font-semibold transition
                ${right ? "animate-quiz-correct border-emerald-300 bg-emerald-300 text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              <span lang={quizChoiceLang(quizMode)} className={quizMode === "english-hanzi" || quizMode === "hanzi-pinyin" ? "font-hanzi" : ""}>
                {choice}
              </span>
            </button>
          );
        })}
      </div>

      {quizState.picked ? (
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={onNext}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            aria-label={quizState.index + 1 >= quiz.length ? "See results" : "Next question"}
          >
            {quizState.index + 1 >= quiz.length ? "See results" : "Next question"}
          </button>
          {quizMode !== "hanzi-english" && quizMode !== "english-hanzi" ? (
            <SpeakButton text={currentQuiz.prompt} label="Hear pronunciation" />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
