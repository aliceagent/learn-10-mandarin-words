"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { isUsefulPhraseTopic, nextTopicAfter, wordKey } from "@/lib/data";
import { buildQuiz, itemsForKeys, type QuizMode } from "@/lib/quiz-logic";
import { computeStats } from "@/lib/progress-logic";
import { downloadableMp4Url, hasPlayableVideo } from "@/lib/video";
import { track } from "@/lib/analytics";
import { useProgress } from "./use-progress";
import { SpeakButton } from "./speak-button";
import { VideoPlayer } from "./video-player";
import { TonePractice } from "./tone-practice";
import { PhrasebookPanel } from "./phrasebook-panel";
import { NextStepPanel } from "./next-step-panel";

// ─── Touch swipe hook ─────────────────────────────────────────────────────────

function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) onLeft();
    else onRight();
  }, [onLeft, onRight]);

  return { onTouchStart, onTouchEnd };
}

// ─── Topic progress helpers ───────────────────────────────────────────────────

function topicStats(topic: Topic, flashcardStats: Record<string, { reviewCount: number; intervalDays: number }>) {
  let studied = 0;
  let mastered = 0;
  for (const item of topic.items) {
    const key = wordKey(topic, item);
    const stat = flashcardStats[key];
    if (stat && stat.reviewCount > 0) studied++;
    if (stat && stat.intervalDays >= 7) mastered++;
  }
  return { studied, mastered, total: topic.items.length };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicApp({ topic }: { topic: Topic }) {
  const { progress, toggleFavoriteTopic, toggleFavoriteWord, toggleLearnedTopic, gradeWord } = useProgress();
  // Useful Phrases topics get an extra "Phrasebook" mode, shown first and
  // selected by default so they read like a practical phrasebook rather than a
  // vocabulary list. Words/Cards/Quiz stay available for every topic.
  const isPhrasebook = isUsefulPhraseTopic(topic);
  const [mode, setMode] = useState<"phrasebook" | "words" | "flashcards" | "quiz">(
    isPhrasebook ? "phrasebook" : "words",
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [quizMode, setQuizMode] = useState<QuizMode>("hanzi-english");
  const [quizState, setQuizState] = useState({ index: 0, score: 0, picked: null as string | null });
  const [quizComplete, setQuizComplete] = useState(false);
  // The words currently being quizzed. Starts as the whole topic; a "Retry
  // missed" run narrows it to just the missed words. Distractors still come from
  // the full topic (see the buildQuiz pool argument) so choices stay plausible.
  const [activeItems, setActiveItems] = useState<VocabItem[]>(topic.items);
  // Keys of words answered incorrectly during the current quiz run.
  const [missedKeys, setMissedKeys] = useState<string[]>([]);

  const isLearned = progress.learnedTopics.includes(topic.slug);
  const isFavoriteTopic = progress.favoriteTopics.includes(topic.slug);
  const current = topic.items[cardIndex % topic.items.length];
  const currentKey = wordKey(topic, current);
  const { studied, mastered, total } = topicStats(topic, progress.flashcardStats);
  const studiedPct = total > 0 ? (studied / total) * 100 : 0;
  const videoReady = hasPlayableVideo(topic);
  const mp4Url = downloadableMp4Url(topic);

  // Once the learner finishes this topic — marked it learned, or completed its
  // quiz — surface a single onward-steps panel. Both triggers share one panel so
  // there's never a duplicate/conflicting completion prompt; the quiz keeps its
  // own score + retry UI, and this panel handles "where to next".
  const showNextStep = isLearned || (mode === "quiz" && quizComplete);
  const nextTopic = nextTopicAfter(progress.learnedTopics, topic.slug);
  const dueReviews = computeStats(progress).dueReviews;

  const keyFor = useCallback((item: VocabItem) => wordKey(topic, item), [topic]);
  const quiz = useMemo(
    () => buildQuiz(activeItems, topic.items, quizMode, keyFor),
    [activeItems, topic.items, quizMode, keyFor],
  );
  const currentQuiz = quiz[quizState.index % quiz.length];
  // Words missed in the just-finished run, in topic order, for the summary.
  const missedItemsList = useMemo(
    () => itemsForKeys(topic.items, keyFor, missedKeys),
    [topic.items, keyFor, missedKeys],
  );

  // Record a topic start once per mounted topic (anonymous, local/dev only).
  useEffect(() => {
    track("topic_start", { topic: topic.slug });
  }, [topic.slug]);

  // Switching to a different topic resets the quiz back to that topic's full
  // word set and clears any missed state carried over from the previous topic.
  // This uses React's "adjust state while rendering on prop change" pattern
  // rather than an effect, so it applies before paint without a cascading render.
  const [quizTopicSlug, setQuizTopicSlug] = useState(topic.slug);
  if (quizTopicSlug !== topic.slug) {
    setQuizTopicSlug(topic.slug);
    setActiveItems(topic.items);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null });
    setQuizComplete(false);
    // Land on the mode that fits the newly shown topic (phrasebook vs. words),
    // so a mode that no longer has a tab is never left selected.
    setMode(isPhrasebook ? "phrasebook" : "words");
  }

  function changeQuizMode(m: QuizMode) {
    setQuizMode(m);
    setActiveItems(topic.items);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null });
    setQuizComplete(false);
  }

  function answerQuiz(choice: string) {
    if (quizState.picked) return;
    const correct = choice === currentQuiz.answer;
    setQuizState((s) => ({ ...s, picked: choice, score: correct ? s.score + 1 : s.score }));
    if (!correct) {
      setMissedKeys((keys) => (keys.includes(currentQuiz.key) ? keys : [...keys, currentQuiz.key]));
    }
  }

  function nextQuiz() {
    const nextIndex = quizState.index + 1;
    if (nextIndex >= quiz.length) {
      setQuizComplete(true);
      track("quiz_completed", { topic: topic.slug, mode: quizMode, score: quizState.score, total: quiz.length });
    } else {
      setQuizState((s) => ({ ...s, picked: null, index: nextIndex }));
    }
  }

  // "Try again": replay the full topic quiz from the start.
  function restartQuiz() {
    setActiveItems(topic.items);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null });
    setQuizComplete(false);
  }

  // "Retry missed": replay a quiz over only the words missed this run.
  function retryMissed() {
    const missed = itemsForKeys(topic.items, keyFor, missedKeys);
    if (missed.length === 0) return;
    setActiveItems(missed);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null });
    setQuizComplete(false);
  }

  // Swipe: right = easy, left = again (when revealed)
  const swipe = useSwipe(
    () => { if (revealed) { gradeWord(currentKey, "again"); setRevealed(false); setCardIndex((v) => (v + 1) % topic.items.length); } },
    () => { if (revealed) { gradeWord(currentKey, "easy"); setRevealed(false); setCardIndex((v) => (v + 1) % topic.items.length); } else setRevealed(true); }
  );

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-0 md:px-10 md:pb-12">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-white/10 bg-slate-950/92 px-6 py-3 backdrop-blur md:-mx-10 md:px-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="shrink-0 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            aria-label="Back to library"
          >
            ← Library
          </Link>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-300">
            {topic.titleEn}
            <span className="font-hanzi ml-2 text-emerald-300/70">{topic.titleCn}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => toggleFavoriteTopic(topic.slug)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-amber-300 hover:text-white"
              aria-pressed={isFavoriteTopic}
              aria-label={isFavoriteTopic ? "Remove from saved lists" : "Save this list"}
            >
              {isFavoriteTopic ? "Saved ★" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => toggleLearnedTopic(topic.slug)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${isLearned ? "bg-emerald-400 text-slate-950" : "border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/15"}`}
              aria-pressed={isLearned}
              aria-label={isLearned ? "Unmark as learned" : "Mark as learned"}
            >
              {isLearned ? "Learned ✓" : "Mark learned"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero section ── */}
      <section className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm text-slate-400">{topic.category}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white md:text-6xl">{topic.titleEn}</h1>
          <p className="font-hanzi mt-2 text-3xl font-semibold text-emerald-300">{topic.titleCn}</p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Watch the lesson, practice the ten words, then mark the list learned when it feels easy.
          </p>

          {/* Progress */}
          <div className="mt-4" aria-label="Topic progress">
            <div className="flex gap-4 text-sm text-slate-400">
              <span>{studied}/{total} studied</span>
              <span>{mastered}/{total} mastered</span>
            </div>
            {studied > 0 ? (
              <div className="progress-bar-track mt-2">
                <div className="progress-bar-fill" style={{ width: `${studiedPct}%` }} />
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => toggleFavoriteTopic(topic.slug)}
              className="min-h-[44px] rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-amber-300"
              aria-pressed={isFavoriteTopic}
              aria-label={isFavoriteTopic ? "Remove from saved lists" : "Save this list"}
            >
              {isFavoriteTopic ? "Saved list ★" : "Save list"}
            </button>
            <button
              type="button"
              onClick={() => toggleLearnedTopic(topic.slug)}
              className="min-h-[44px] rounded-full bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              aria-pressed={isLearned}
              aria-label={isLearned ? "Unmark as learned" : "Mark as learned"}
            >
              {isLearned ? "Marked learned ✓" : "Mark learned"}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-4">
          <VideoPlayer src={topic.videoPath} title={`${topic.titleEn} video lesson`} video={topic.video} />

          {/* Availability badge + direct link + hosting note */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {videoReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-300/90 px-3 py-1 text-xs font-bold text-slate-950">
                ▶ Video available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-400">
                Video coming soon
              </span>
            )}

            {mp4Url ? (
              <a
                href={mp4Url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-emerald-200"
                aria-label={`Open the ${topic.titleEn} video in a new tab`}
              >
                Open video ↗
              </a>
            ) : null}
          </div>

          {mp4Url ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Video lessons stream from GitHub Releases, so they need a connection — the words and
              your progress on this page still work offline.
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Mode tabs ── */}
      <nav
        className={`mt-10 grid gap-2 rounded-3xl border border-white/10 bg-slate-950/80 p-2 ${isPhrasebook ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
        aria-label="Practice modes"
      >
        {isPhrasebook ? (
          <Tab active={mode === "phrasebook"} onClick={() => setMode("phrasebook")}>Phrasebook</Tab>
        ) : null}
        <Tab active={mode === "words"} onClick={() => setMode("words")}>Words</Tab>
        <Tab active={mode === "flashcards"} onClick={() => setMode("flashcards")}>Cards</Tab>
        <Tab active={mode === "quiz"} onClick={() => setMode("quiz")}>Quiz</Tab>
      </nav>

      {/* ── Phrasebook (Useful Phrases only) ── */}
      {mode === "phrasebook" ? (
        <PhrasebookPanel
          topic={topic}
          favoriteWords={progress.favoriteWords}
          onToggleFavorite={(key) => {
            if (!progress.favoriteWords.includes(key)) track("favorite_saved", { topic: topic.slug, kind: "word" });
            toggleFavoriteWord(key);
          }}
        />
      ) : null}

      {/* ── Words ── */}
      {mode === "words" ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Vocabulary words">
          {topic.items.map((item) => {
            const key = wordKey(topic, item);
            const favorite = progress.favoriteWords.includes(key);
            const stat = progress.flashcardStats[key];
            return (
              <article key={item.hanzi} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="font-hanzi text-4xl font-semibold text-white">{item.hanzi}</h2>
                      <p className="font-hanzi mt-2 text-xl text-emerald-300">{item.pinyin}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-200">{item.english}</p>
                      {stat && stat.reviewCount > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {stat.reviewCount} review{stat.reviewCount !== 1 ? "s" : ""} · interval {stat.intervalDays}d
                        </p>
                      ) : null}
                    </div>
                    <SpeakButton text={item.hanzi} label={`Pronounce ${item.hanzi} (${item.pinyin})`} />
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (!favorite) track("favorite_saved", { topic: topic.slug, kind: "word" }); toggleFavoriteWord(key); }}
                    className="min-h-[44px] shrink-0 rounded-full border border-white/10 px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-300"
                    aria-pressed={favorite}
                    aria-label={favorite ? `Remove ${item.english} from favorites` : `Save ${item.english} to favorites`}
                  >
                    {favorite ? "Saved" : "Save"}
                  </button>
                </div>
                <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                  {item.sentences.map((sentence) => (
                    <div key={sentence.cn} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-slate-300">
                          <span className="font-hanzi text-white">{sentence.cn}</span>
                          <br />{sentence.en}
                        </p>
                      </div>
                      <SpeakButton text={sentence.cn} label={`Pronounce: ${sentence.cn}`} />
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {/* ── Flashcards ── */}
      {mode === "flashcards" ? (
        <section
          className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center"
          {...swipe}
          aria-label="Flashcard practice"
          role="region"
        >
          <div className="flex items-center justify-between gap-2 text-sm text-slate-400">
            <span>Card {cardIndex + 1} of {topic.items.length}</span>
            {/* Swipe gesture hints */}
            <div className="flex gap-2">
              <span className="swipe-hint">← again</span>
              <span className="swipe-hint">easy →</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <h2 className="font-hanzi text-7xl font-semibold text-white">{current.hanzi}</h2>
            <SpeakButton text={current.hanzi} label={`Pronounce ${current.hanzi}`} />
          </div>

          {revealed ? (
            <div className="mt-5 animate-celebrate">
              <p className="font-hanzi text-2xl text-emerald-300">{current.pinyin}</p>
              <p className="mt-2 text-xl text-slate-200">{current.english}</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="min-h-[44px] rounded-full bg-emerald-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                aria-label="Reveal answer"
              >
                Reveal
              </button>
            ) : (
              <>
                {(["again", "hard", "good", "easy"] as const).map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => { gradeWord(currentKey, grade); setRevealed(false); setCardIndex((v) => (v + 1) % topic.items.length); }}
                    className="min-h-[44px] rounded-full border border-white/15 px-5 py-3 font-semibold capitalize text-white transition hover:border-emerald-300"
                    aria-label={`Grade as ${grade}`}
                  >
                    {grade}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Tip on first card */}
          {!revealed && cardIndex === 0 ? (
            <p className="mt-6 text-xs text-slate-600">
              Tap Reveal, then grade your recall · swipe left/right after revealing
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ── Quiz ── */}
      {mode === "quiz" ? (
        quizComplete ? (
          /* Celebration screen */
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
                  onClick={retryMissed}
                  className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Retry missed ({missedItemsList.length})
                </button>
              ) : null}
              <button
                type="button"
                onClick={restartQuiz}
                className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => { setMode("flashcards"); setCardIndex(0); setRevealed(false); }}
                className={`min-h-[44px] rounded-full px-6 py-3 font-semibold transition ${missedItemsList.length === 0 ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "border border-white/15 text-white hover:border-emerald-300"}`}
              >
                Practice flashcards
              </button>
            </div>
          </div>
        ) : (
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
                  onClick={() => changeQuizMode(m.key)}
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
                    onClick={() => answerQuiz(choice)}
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
                  onClick={nextQuiz}
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
        )
      ) : null}

      {/* ── Next-step panel (shown once the topic is learned or the quiz is done) ── */}
      {showNextStep ? (
        <NextStepPanel
          nextTopic={nextTopic}
          dueReviews={dueReviews}
          isFavoriteTopic={isFavoriteTopic}
          onToggleFavorite={() => toggleFavoriteTopic(topic.slug)}
        />
      ) : null}

      {/* ── Tone practice (additive; independent of the mode tabs above) ── */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white">Tone practice</h2>
        <p className="mt-1 text-sm text-slate-400">
          Train your ear for tones — derived from each word&apos;s pinyin.
        </p>
        <TonePractice topic={topic} />
      </div>
    </main>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`min-h-[44px] min-w-0 rounded-2xl px-2 py-3 text-sm font-semibold transition sm:px-5 sm:text-base ${active ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}
    >
      {children}
    </button>
  );
}
