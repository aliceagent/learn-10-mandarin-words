"use client";

import { useState } from "react";
import type { VocabItem } from "@/lib/types";
import type { QuizCard, QuizMode } from "@/lib/quiz-logic";
import { HANZI_LANG, PINYIN_LANG, quizChoiceLang, quizPromptLang } from "@/lib/lang";
import { HANZI_SIZE_CLASS } from "@/lib/hanzi-size";
import { comboMilestoneLabel, comboTier } from "@/lib/combo-logic";
import { comboChangeAnnouncement, quizVerdictAnnouncement } from "@/lib/announce-logic";
import { SpeakButton } from "../speak-button";
import { useHanziSize } from "../use-hanzi-size";
import { useSpeech } from "../use-speech";

type QuizViewState = {
  index: number;
  score: number;
  picked: string | null;
  /** Current consecutive-correct streak this run. */
  combo: number;
  /** Longest streak reached this run (for the completion summary). */
  runBestCombo: number;
  /** Streak just lost on the most recent wrong answer (0 otherwise). */
  brokenCombo: number;
};

// Chip styling escalates with the combo tier: emerald (≥2), amber (≥5), rose
// (≥10). The ×N label and this color carry the meaning; the pop animation is a
// secondary cue (removed under prefers-reduced-motion).
function comboChipClass(combo: number): string {
  switch (comboTier(combo)) {
    case 3:
      return "border-rose-300/40 bg-rose-400/15 text-rose-200";
    case 2:
      return "border-amber-300/40 bg-amber-400/15 text-amber-200";
    default:
      return "border-emerald-300/40 bg-emerald-400/10 text-emerald-200";
  }
}

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
  bestCombo,
  isNewBest,
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
  /** All-time persisted best combo, shown quietly once it's worth bragging (≥3). */
  bestCombo: number;
  /** Whether this run set a new all-time best combo (drives the completion moment). */
  isNewBest: boolean;
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
  const { size: hanziSize } = useHanziSize();
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
        {quizState.runBestCombo > 0 ? (
          isNewBest ? (
            <p className="mt-3 text-lg font-bold text-amber-300">🏆 New best combo: ×{quizState.runBestCombo}!</p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Longest combo this run: ×{quizState.runBestCombo}</p>
          )
        ) : null}
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
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
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
            className={`min-h-[44px] rounded-full px-6 py-3 font-semibold transition ${missedItemsList.length === 0 ? "bg-emerald-400 text-slate-950 hover:bg-cta" : "border border-white/15 text-white hover:border-emerald-300"}`}
          >
            Practice flashcards
          </button>
        </div>
      </div>
    );
  }

  // Screen-reader verdict for the answered card. Sighted users get the
  // correct/wrong button flash; this speaks the same outcome (and, when wrong,
  // the right answer language-tagged so hanzi/pinyin are voiced correctly) plus
  // any combo milestone / break. Derived from state — advancing clears `picked`,
  // which empties the region so the next card starts silent.
  const answered = quizState.picked !== null;
  const isCorrect = quizState.picked === currentQuiz.answer;
  // Listening mode omits the answer restatement: its role="status" reveal already
  // reads the ground-truth hanzi + pinyin, so repeating it here would double-speak.
  const restateAnswer = answered && !isCorrect && quizMode !== "listening";
  const comboNote = answered
    ? comboChangeAnnouncement({ combo: quizState.combo, brokenCombo: quizState.brokenCombo })
    : null;

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-surface p-6" aria-label="Quiz practice">
      {/* Persistent sr-only verdict/combo announcer (Sprint 21). Empty until an
          answer is picked; the answer word is language-tagged so a screen reader
          voices hanzi/pinyin under the right voice. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {answered ? (
          <>
            {restateAnswer ? (
              <>
                Not quite — the answer is{" "}
                <span lang={quizChoiceLang(quizMode)}>{currentQuiz.answer}</span>.
              </>
            ) : (
              quizVerdictAnnouncement(isCorrect)
            )}
            {comboNote ? ` ${comboNote}` : ""}
          </>
        ) : (
          ""
        )}
      </p>

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

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-slate-400">Question {(quizState.index % quiz.length) + 1} of {quiz.length}</p>
        {/* Combo meter: hidden below ×2, then a tiered chip that pops on each
            increment (re-keyed on the combo value so the animation re-fires). The
            milestone flash is now a purely visual cue — the sr-only verdict
            region above owns all speech (comboChangeAnnouncement), so milestones
            and breaks aren't spoken twice. `Best ×N` is a quiet all-time marker
            shown once it's worth bragging about. */}
        <div className="flex items-center gap-2">
          {quizState.combo >= 2 ? (
            <span
              key={quizState.combo}
              className={`animate-combo-pop rounded-full border px-3 py-1 text-xs font-bold ${comboChipClass(quizState.combo)}`}
            >
              ×{quizState.combo}{comboTier(quizState.combo) >= 1 ? " 🔥" : ""}
            </span>
          ) : null}
          <span className="text-xs font-semibold text-emerald-300">
            {comboMilestoneLabel(quizState.combo) ?? ""}
          </span>
          {bestCombo >= 3 ? <span className="text-xs text-slate-500">Best ×{bestCombo}</span> : null}
        </div>
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
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-cta"
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
              <h2 lang={HANZI_LANG} className={`font-hanzi ${HANZI_SIZE_CLASS.promptSm[hanziSize]} font-semibold text-white`}>{currentQuiz.prompt}</h2>
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
            <h2 lang={quizPromptLang(quizMode)} className={`font-semibold text-white ${quizMode === "english-hanzi" ? "font-sans text-4xl" : `font-hanzi ${HANZI_SIZE_CLASS.hero[hanziSize]}`}`}>
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
                ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
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
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
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
