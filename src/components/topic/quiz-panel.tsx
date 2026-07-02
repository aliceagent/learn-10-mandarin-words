import type { VocabItem } from "@/lib/types";
import type { QuizCard, QuizMode } from "@/lib/quiz-logic";
import { SpeakButton } from "../speak-button";

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
  onChangeQuizMode: (m: QuizMode) => void;
  onAnswer: (choice: string) => void;
  onNext: () => void;
  onRetryMissed: () => void;
  onRestart: () => void;
  onPracticeFlashcards: () => void;
}) {
  if (quizComplete) {
    /* Celebration screen */
    return (
      <div className="animate-celebrate mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center">
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
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left">
            <p className="text-sm font-semibold text-slate-300">
              {missedItemsList.length} to review
            </p>
            <ul className="mt-3 space-y-2">
              {missedItemsList.map((item) => (
                <li key={item.hanzi} className="flex items-baseline gap-3">
                  <span className="font-hanzi text-xl text-white">{item.hanzi}</span>
                  <span className="font-hanzi text-sm text-emerald-300">{item.pinyin}</span>
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
    <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6" aria-label="Quiz practice">
      {/* Quiz mode selector */}
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Quiz mode">
        {([
          { key: "hanzi-english", label: "Hanzi → English" },
          { key: "english-hanzi", label: "English → Hanzi" },
          { key: "hanzi-pinyin", label: "Hanzi → Pinyin" },
        ] as const).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onChangeQuizMode(m.key)}
            className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold transition ${quizMode === m.key ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-white/10 text-slate-400 hover:border-emerald-300 hover:text-white"}`}
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
      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <h2 className={`font-hanzi text-7xl font-semibold text-white ${quizMode === "english-hanzi" ? "font-sans text-4xl" : ""}`}>
            {currentQuiz.prompt}
          </h2>
          {(quizMode === "hanzi-english" || quizMode === "hanzi-pinyin") ? (
            <SpeakButton text={currentQuiz.prompt} label={`Pronounce: ${currentQuiz.prompt}`} />
          ) : null}
        </div>
        {currentQuiz.promptPinyin ? (
          <p className="font-hanzi mt-2 text-2xl text-emerald-300">{currentQuiz.promptPinyin}</p>
        ) : null}
      </div>

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
                ${!right && !wrong ? "border-white/10 bg-slate-950 text-white hover:border-emerald-300" : ""}
              `}
            >
              <span className={quizMode === "english-hanzi" || quizMode === "hanzi-pinyin" ? "font-hanzi" : ""}>
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
