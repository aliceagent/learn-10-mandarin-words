"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import { isUsefulPhraseTopic, nextTopicAfter, wordKey } from "@/lib/data";
import { buildQuiz, itemsForKeys, type QuizMode } from "@/lib/quiz-logic";
import { computeStats, formatIntervalDays, previewIntervals, topicProgress, topicWordStatuses } from "@/lib/progress-logic";
import { downloadableMp4Url, hasPlayableVideo } from "@/lib/video";
import { track } from "@/lib/analytics";
import { useProgress } from "./use-progress";
import { VideoPlayer } from "./video-player";
import { TonePractice } from "./tone-practice";
import { PhrasebookPanel } from "./phrasebook-panel";
import { NextStepPanel } from "./next-step-panel";
import { SaveOfflineButton } from "./save-offline-button";
import { MasteryDots, masteryCountsLabel } from "./mastery-dots";
import { WordsPanel } from "./topic/words-panel";
import { FlashcardsPanel } from "./topic/flashcards-panel";
import { QuizPanel } from "./topic/quiz-panel";
import { TypingPanel } from "./topic/typing-panel";
import { MatchPanel } from "./topic/match-panel";
import { ClozePanel } from "./topic/cloze-panel";
import { Toast } from "./toast";

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicApp({ topic }: { topic: Topic }) {
  const { progress, toggleFavoriteTopic, toggleFavoriteWord, toggleLearnedTopic, gradeWord, recordQuizAnswer } = useProgress();
  // Useful Phrases topics get an extra "Phrasebook" mode, shown first and
  // selected by default so they read like a practical phrasebook rather than a
  // vocabulary list. Words/Cards/Quiz stay available for every topic.
  const isPhrasebook = isUsefulPhraseTopic(topic);
  const [mode, setMode] = useState<"phrasebook" | "words" | "flashcards" | "quiz" | "typed" | "match" | "cloze">(
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
  // Transient confirmation shown after grading a flashcard.
  const [toast, setToast] = useState<string | null>(null);
  // Whether the browser can speak (Web Speech synthesis). Detected in an effect
  // — never during SSR render — so the server and first client render agree
  // (default false) and the listening-mode chip appears only after hydration
  // confirms support, avoiding a hydration mismatch.
  const [speechAvailable, setSpeechAvailable] = useState(false);
  useEffect(() => {
    // Detect on mount only (browser-only API). The update runs in a microtask so
    // the effect body never triggers a synchronous cascading render — matching
    // the feature-detection pattern in save-offline-button.tsx.
    let active = true;
    queueMicrotask(() => {
      if (active) setSpeechAvailable("speechSynthesis" in window);
    });
    return () => {
      active = false;
    };
  }, []);

  const isLearned = progress.learnedTopics.includes(topic.slug);
  const isFavoriteTopic = progress.favoriteTopics.includes(topic.slug);
  const current = topic.items[cardIndex % topic.items.length];
  const currentKey = wordKey(topic, current);
  const { studied, mastered, total } = topicProgress(topic, progress.flashcardStats);
  const studiedPct = total > 0 ? (studied / total) * 100 : 0;
  const wordStatuses = topicWordStatuses(topic, progress.flashcardStats, progress.quizStats);
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
    // The `picked` guard above means this runs exactly once per card — the first
    // answer — so per-word quiz accuracy is recorded once per attempt.
    recordQuizAnswer(currentQuiz.key, correct);
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
            {/* Per-word mastery dots + a legend naming each color (color is never
                the only channel). Legend renders only here, on the topic page. */}
            <div className="mt-3">
              <MasteryDots statuses={wordStatuses} size="md" label={masteryCountsLabel(wordStatuses)} />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  mastered
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/40" aria-hidden="true" />
                  learning
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
                  tricky
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full border border-white/15" aria-hidden="true" />
                  new
                </span>
              </div>
            </div>
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
            <div className="mt-3 border-t border-white/10 pt-3">
              <SaveOfflineButton source={mp4Url} slug={topic.slug} pageUrl={`/topics/${topic.slug}`} />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Video lessons stream from GitHub Releases, so they need a connection — save this
                lesson to watch it offline. The words and your progress on this page always work offline.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Mode tabs ── */}
      {/* Scrollable flex bar (not a fixed grid) so 4–5 tabs fit and scroll on a
          360px screen; the scrollbar is hidden. */}
      <nav
        className="mt-10 flex gap-2 overflow-x-auto snap-x rounded-3xl border border-white/10 bg-slate-950/80 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Practice modes"
      >
        {isPhrasebook ? (
          <Tab active={mode === "phrasebook"} onClick={() => setMode("phrasebook")}>Phrasebook</Tab>
        ) : null}
        <Tab active={mode === "words"} onClick={() => setMode("words")}>Words</Tab>
        <Tab active={mode === "flashcards"} onClick={() => setMode("flashcards")}>Cards</Tab>
        <Tab active={mode === "quiz"} onClick={() => setMode("quiz")}>Quiz</Tab>
        <Tab active={mode === "typed"} onClick={() => setMode("typed")}>Type</Tab>
        <Tab active={mode === "match"} onClick={() => setMode("match")}>Match</Tab>
        <Tab active={mode === "cloze"} onClick={() => setMode("cloze")}>Sentences</Tab>
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
        <WordsPanel
          topic={topic}
          favoriteWords={progress.favoriteWords}
          flashcardStats={progress.flashcardStats}
          onToggleFavorite={(key) => {
            if (!progress.favoriteWords.includes(key)) track("favorite_saved", { topic: topic.slug, kind: "word" });
            toggleFavoriteWord(key);
          }}
        />
      ) : null}

      {/* ── Flashcards ── */}
      {mode === "flashcards" ? (
        <FlashcardsPanel
          topic={topic}
          cardIndex={cardIndex}
          current={current}
          stat={progress.flashcardStats[currentKey]}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onGrade={(grade) => {
            // Compute the projected interval BEFORE grading mutates the stat, so
            // the toast reports exactly what this grade scheduled.
            const days = previewIntervals(progress.flashcardStats[currentKey], new Date())[grade];
            gradeWord(currentKey, grade);
            setToast(`“${current.hanzi}” scheduled in ${formatIntervalDays(days)}`);
            setRevealed(false);
            setCardIndex((v) => (v + 1) % topic.items.length);
          }}
        />
      ) : null}

      {/* ── Quiz ── */}
      {mode === "quiz" ? (
        <QuizPanel
          quizComplete={quizComplete}
          quiz={quiz}
          currentQuiz={currentQuiz}
          quizMode={quizMode}
          quizState={quizState}
          missedItemsList={missedItemsList}
          speechAvailable={speechAvailable}
          onChangeQuizMode={changeQuizMode}
          onAnswer={answerQuiz}
          onNext={nextQuiz}
          onRetryMissed={retryMissed}
          onRestart={restartQuiz}
          onPracticeFlashcards={() => { setMode("flashcards"); setCardIndex(0); setRevealed(false); }}
        />
      ) : null}

      {/* ── Typed recall ── */}
      {mode === "typed" ? (
        <TypingPanel topic={topic} onRecord={recordQuizAnswer} />
      ) : null}

      {/* ── Matching pairs game ── */}
      {mode === "match" ? (
        <MatchPanel topic={topic} onRecord={recordQuizAnswer} onTakeQuiz={() => setMode("quiz")} />
      ) : null}

      {/* ── Sentence cloze (fill-in-the-blank from real example sentences) ── */}
      {mode === "cloze" ? (
        <ClozePanel topic={topic} onRecord={recordQuizAnswer} />
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

      <Toast message={toast} onDone={() => setToast(null)} />
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
      className={`min-h-[44px] shrink-0 snap-start rounded-2xl px-4 py-3 text-sm font-semibold transition sm:px-5 sm:text-base ${active ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}
    >
      {children}
    </button>
  );
}
