"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Topic, VocabItem } from "@/lib/types";
import type { CharConnectionGroup } from "@/lib/connections-logic";
import { isUsefulPhraseTopic, nextTopicAfter, wordKey } from "@/lib/data";
import { buildQuiz, itemsForKeys, type QuizMode } from "@/lib/quiz-logic";
import { isNewBestCombo, nextCombo } from "@/lib/combo-logic";
import { computeStats, formatIntervalDays, isCrowned, previewIntervals, topicProgress, topicWordStatuses } from "@/lib/progress-logic";
import { downloadableMp4Url, hasPlayableVideo } from "@/lib/video";
import { canAttemptSpeech } from "@/lib/speech";
import { track } from "@/lib/analytics";
import { useProgress } from "./use-progress";
import { useSpeech } from "./use-speech";
import { VideoPlayer } from "./video-player";
import { TonePractice } from "./tone-practice";
import { ToneListenTrainer } from "./tone-listen-trainer";
import { PhrasebookPanel } from "./phrasebook-panel";
import { NextStepPanel } from "./next-step-panel";
import { SaveOfflineButton } from "./save-offline-button";
import { MasteryDots, masteryCountsLabel } from "./mastery-dots";
import { ToneColorsToggle } from "./tone-colors-toggle";
import { HapticsToggle } from "./haptics-toggle";
import { ShortcutsHelp } from "./shortcuts-help";
import type { HelpPanelKind } from "@/lib/shortcut-help-logic";
import { vibrateFeedback } from "./use-haptics";
import { WordsPanel } from "./topic/words-panel";
import { FlashcardsPanel } from "./topic/flashcards-panel";
import { QuizPanel } from "./topic/quiz-panel";
import { TypingPanel } from "./topic/typing-panel";
import { MatchPanel } from "./topic/match-panel";
import { MemoryPanel } from "./topic/memory-panel";
import { ClozePanel } from "./topic/cloze-panel";
import { ScramblePanel } from "./topic/scramble-panel";
import { SentenceListenPanel } from "./topic/sentence-listen-panel";
import { BossPanel } from "./topic/boss-panel";
import { BOSS_STAGE_COUNT } from "@/lib/boss-logic";
import { PrintButton } from "./print-button";
import { Toast } from "./toast";

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicApp({
  topic,
  connections,
}: {
  topic: Topic;
  // Precomputed shared-character connections (Sprint 3), keyed by wordKey. Built
  // server-side from the full dataset so topics.json never enters this client
  // chunk; optional so the component still renders without it.
  connections?: Record<string, CharConnectionGroup[]>;
}) {
  const { progress, loaded, toggleFavoriteTopic, toggleFavoriteWord, toggleLearnedTopic, gradeWord, recordQuizAnswer, recordBestCombo, recordBossResult, recordTopicVisit } = useProgress();
  // Useful Phrases topics get an extra "Phrasebook" mode, shown first and
  // selected by default so they read like a practical phrasebook rather than a
  // vocabulary list. Words/Cards/Quiz stay available for every topic.
  const isPhrasebook = isUsefulPhraseTopic(topic);
  const [mode, setMode] = useState<"phrasebook" | "words" | "flashcards" | "quiz" | "typed" | "match" | "memory" | "cloze" | "scramble" | "sentence-listen" | "boss">(
    isPhrasebook ? "phrasebook" : "words",
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [quizMode, setQuizMode] = useState<QuizMode>("hanzi-english");
  // Tone-practice section sub-mode: the eyes-first per-syllable drill ("read")
  // or the ears-first listening trainer ("listen", speech-gated).
  const [toneMode, setToneMode] = useState<"read" | "listen">("read");
  // `combo` is the current consecutive-correct streak in this run; `runBestCombo`
  // the longest streak reached this run; `brokenCombo` the streak just lost on the
  // most recent wrong answer (0 otherwise, so the "combo broken" note can show the
  // right ×N); `newBest` flags that this run set a new all-time best combo.
  const [quizState, setQuizState] = useState({
    index: 0,
    score: 0,
    picked: null as string | null,
    combo: 0,
    runBestCombo: 0,
    brokenCombo: 0,
    newBest: false,
  });
  const [quizComplete, setQuizComplete] = useState(false);
  // The words currently being quizzed. Starts as the whole topic; a "Retry
  // missed" run narrows it to just the missed words. Distractors still come from
  // the full topic (see the buildQuiz pool argument) so choices stay plausible.
  const [activeItems, setActiveItems] = useState<VocabItem[]>(topic.items);
  // Keys of words answered incorrectly during the current quiz run.
  const [missedKeys, setMissedKeys] = useState<string[]>([]);
  // Transient confirmation shown after grading a flashcard.
  const [toast, setToast] = useState<string | null>(null);
  // Whether the keyboard-shortcuts help overlay is open (Sprint 20). While open,
  // the game panels' shortcuts are disabled so digits don't fire under the modal.
  const [helpOpen, setHelpOpen] = useState(false);
  // Whether the browser can plausibly speak Mandarin, driven by the shared
  // useSpeech() hook. Its status starts as "loading" (canAttemptSpeech → true),
  // so SSR and first client render agree and the listening-mode chip shows
  // optimistically; post-hydration it hides only once a populated voice list
  // confirms no Chinese voice — or the API is absent — never in the ambiguous
  // empty-list case (some engines report `[]` yet speak).
  const { status: speechStatus } = useSpeech();
  const speechAvailable = canAttemptSpeech(speechStatus);

  const isLearned = progress.learnedTopics.includes(topic.slug);
  const isFavoriteTopic = progress.favoriteTopics.includes(topic.slug);
  const topicCrowned = isCrowned(progress.bossStats, topic.slug);
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

  // Which shortcut set the help overlay shows — only the keyboard-enabled game
  // panels have a dedicated group; every other tab shows just the universal keys.
  const helpKind: HelpPanelKind =
    mode === "scramble" || mode === "match" || mode === "boss" ? mode : "other";

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

  // Persist this topic into the "Recently studied" shelf (schema v10). Gated on
  // `loaded` so we never write before stored progress is hydrated. Loop-free: on
  // the first write recordRecentTopic returns a new array; every re-render after
  // it returns the same reference, recordTopicVisit bails to the same state, and
  // React stops re-rendering. A visit records here only — never studiedDates or
  // dailyActivity — so it can't create a streak day or count toward the goal.
  useEffect(() => {
    if (!loaded) return;
    recordTopicVisit(topic.slug);
  }, [loaded, topic.slug, recordTopicVisit]);

  // Switching to a different topic resets the quiz back to that topic's full
  // word set and clears any missed state carried over from the previous topic.
  // This uses React's "adjust state while rendering on prop change" pattern
  // rather than an effect, so it applies before paint without a cascading render.
  const [quizTopicSlug, setQuizTopicSlug] = useState(topic.slug);
  if (quizTopicSlug !== topic.slug) {
    setQuizTopicSlug(topic.slug);
    setActiveItems(topic.items);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null, combo: 0, runBestCombo: 0, brokenCombo: 0, newBest: false });
    setQuizComplete(false);
    // Land on the mode that fits the newly shown topic (phrasebook vs. words),
    // so a mode that no longer has a tab is never left selected.
    setMode(isPhrasebook ? "phrasebook" : "words");
  }

  function changeQuizMode(m: QuizMode) {
    setQuizMode(m);
    setActiveItems(topic.items);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null, combo: 0, runBestCombo: 0, brokenCombo: 0, newBest: false });
    setQuizComplete(false);
  }

  function answerQuiz(choice: string) {
    if (quizState.picked) return;
    const correct = choice === currentQuiz.answer;
    vibrateFeedback(correct ? "correct" : "incorrect");
    // The `picked` guard above means this runs exactly once per card — the first
    // answer — so per-word quiz accuracy is recorded once per attempt.
    recordQuizAnswer(currentQuiz.key, correct);
    // Combo: +1 on a correct answer, reset to 0 on a miss. When the new streak
    // beats the persisted all-time best, raise it (monotonic max in the hook) and
    // flag the run as a record so the completion screen can celebrate it. This is
    // an event handler, not render, so calling recordBestCombo here is safe.
    const combo = nextCombo(quizState.combo, correct);
    const beatsBest = isNewBestCombo(combo, progress.bestQuizCombo);
    if (beatsBest) recordBestCombo(combo);
    setQuizState((s) => ({
      ...s,
      picked: choice,
      score: correct ? s.score + 1 : s.score,
      combo,
      runBestCombo: Math.max(s.runBestCombo, combo),
      // Remember the streak just lost, so the "combo broken" note can name it.
      brokenCombo: correct ? 0 : s.combo,
      newBest: s.newBest || beatsBest,
    }));
    if (!correct) {
      setMissedKeys((keys) => (keys.includes(currentQuiz.key) ? keys : [...keys, currentQuiz.key]));
    }
  }

  function nextQuiz() {
    const nextIndex = quizState.index + 1;
    if (nextIndex >= quiz.length) {
      setQuizComplete(true);
      track("quiz_completed", { topic: topic.slug, mode: quizMode, score: quizState.score, total: quiz.length, bestCombo: quizState.runBestCombo });
    } else {
      setQuizState((s) => ({ ...s, picked: null, index: nextIndex }));
    }
  }

  // "Try again": replay the full topic quiz from the start.
  function restartQuiz() {
    setActiveItems(topic.items);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null, combo: 0, runBestCombo: 0, brokenCombo: 0, newBest: false });
    setQuizComplete(false);
  }

  // "Retry missed": replay a quiz over only the words missed this run.
  function retryMissed() {
    const missed = itemsForKeys(topic.items, keyFor, missedKeys);
    if (missed.length === 0) return;
    setActiveItems(missed);
    setMissedKeys([]);
    setQuizState({ index: 0, score: 0, picked: null, combo: 0, runBestCombo: 0, brokenCombo: 0, newBest: false });
    setQuizComplete(false);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-0 md:px-10 md:pb-12 print:hidden">
      {/* ── Sticky header ── */}
      {/* Chrome only: a back affordance + the current topic title. The Save /
          Mark-learned actions live in the hero below (see the lesson-actions row)
          — duplicating them here made the sticky bar loud, so it stays quiet. */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-white/10 bg-background/92 px-6 py-3 backdrop-blur md:-mx-10 md:px-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="shrink-0 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            aria-label="Back to library"
          >
            {/* Compact on mobile (just the chevron); full label from sm up. Same
                route/target — purely a visual narrowing of the nav. */}
            <span aria-hidden="true">←</span>
            <span className="ml-1 hidden sm:inline">Library</span>
          </Link>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-300">
            {topic.titleEn}
            <span className="font-hanzi ml-2 text-emerald-300/70">{topic.titleCn}</span>
          </p>
        </div>
      </div>

      {/* ── Hero section ── */}
      <section className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-xs text-slate-500 md:text-sm md:text-slate-400">{topic.category}</p>
          {/* Dialed back a step on mobile (3xl title / 2xl hanzi) so the hero reads
              as a calm heading on a phone; the desktop scale is unchanged. */}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-6xl">{topic.titleEn}</h1>
          <p className="font-hanzi mt-2 text-2xl font-semibold text-emerald-300 md:text-3xl">{topic.titleCn}</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            Watch the lesson, practice the ten words, then mark the list learned when it feels easy.
          </p>

          {/* Progress */}
          <div className="mt-4" aria-label="Topic progress">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
              <span>{studied}/{total} studied</span>
              <span>{mastered}/{total} mastered</span>
              {topicCrowned ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-0.5 text-xs font-semibold text-amber-200">
                  👑 Crowned
                </span>
              ) : null}
            </div>
            {studied > 0 ? (
              <div className="progress-bar-track mt-2">
                <div className="progress-bar-fill" style={{ width: `${studiedPct}%` }} />
              </div>
            ) : null}
            {/* Per-word mastery dots stay visible; the color legend (color is never
                the only channel — the dots carry a count aria-label) is tucked
                behind a small "Legend" disclosure so the hero isn't crowded by a
                four-item key. Native <details>, so it needs no extra state. */}
            <div className="mt-3">
              <MasteryDots statuses={wordStatuses} size="md" label={masteryCountsLabel(wordStatuses)} />
              <details className="group mt-2">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-slate-500 transition hover:text-slate-400 [&::-webkit-details-marker]:hidden">
                  Legend
                  <span aria-hidden="true" className="text-[0.65rem] transition group-open:rotate-180">▾</span>
                </summary>
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
              </details>
            </div>
          </div>

          {/* Lesson-actions row: the single home for Save / Mark-learned (the
              sticky header no longer duplicates these). */}
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
              className="min-h-[44px] rounded-full bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cta"
              aria-pressed={isLearned}
              aria-label={isLearned ? "Unmark as learned" : "Mark as learned"}
            >
              {isLearned ? "Marked learned ✓" : "Mark learned"}
            </button>
            <PrintButton topic={topic.slug} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface p-4">
          <VideoPlayer src={topic.videoPath} title={`${topic.titleEn} video lesson`} video={topic.video} />

          {/* Availability badge + direct link + hosting note */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {videoReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
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
      {/* Level-2 segmented control: a quiet surface strip, not a loud pill bar.
          Still a scrollable flex row (not a fixed grid) so 4–5 tabs fit and scroll
          on a 360px screen; the scrollbar is hidden. The `tab-scroll` wrapper
          lays a gentle right-edge fade over the strip to hint at more tabs. */}
      <div className="tab-scroll relative mt-10">
        <nav
          className="flex gap-1 overflow-x-auto snap-x rounded-2xl border border-white/10 bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
          <Tab active={mode === "memory"} onClick={() => setMode("memory")}>Memory</Tab>
          <Tab active={mode === "cloze"} onClick={() => setMode("cloze")}>Sentences</Tab>
          <Tab active={mode === "scramble"} onClick={() => setMode("scramble")}>Scramble</Tab>
          {/* Listening only appears once speech is confirmed available (same gate
              as the quiz's listening chip), so there's never a dead tab on
              voiceless devices. */}
          {speechAvailable ? (
            <Tab active={mode === "sentence-listen"} onClick={() => setMode("sentence-listen")}>Listening</Tab>
          ) : null}
          <Tab active={mode === "boss"} onClick={() => setMode("boss")}>{topicCrowned ? "Boss 👑" : "Boss"}</Tab>
        </nav>
      </div>

      {/* Utility row: the keyboard-shortcuts help trigger on the left, the
          tone-colors + haptics preferences (quiet, right-aligned) on the right. */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <ShortcutsHelp
          open={helpOpen}
          onOpen={() => setHelpOpen(true)}
          onClose={() => setHelpOpen(false)}
          kind={helpKind}
        />
        <div className="flex flex-col items-end gap-3">
          <ToneColorsToggle />
          <HapticsToggle />
        </div>
      </div>

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
          speechAvailable={speechAvailable}
          connections={connections}
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
          bestCombo={progress.bestQuizCombo}
          isNewBest={quizState.newBest}
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
        <MatchPanel topic={topic} onRecord={recordQuizAnswer} onTakeQuiz={() => setMode("quiz")} shortcutsEnabled={!helpOpen} />
      ) : null}

      {/* ── Memory (concentration-style face-down pair matching) ── */}
      {mode === "memory" ? (
        <MemoryPanel topic={topic} onRecord={recordQuizAnswer} onTakeQuiz={() => setMode("quiz")} />
      ) : null}

      {/* ── Sentence cloze (fill-in-the-blank from real example sentences) ── */}
      {mode === "cloze" ? (
        <ClozePanel topic={topic} onRecord={recordQuizAnswer} />
      ) : null}

      {/* ── Sentence scramble (rebuild the sentence from shuffled hanzi tiles) ── */}
      {mode === "scramble" ? (
        <ScramblePanel topic={topic} onRecord={recordQuizAnswer} shortcutsEnabled={!helpOpen} />
      ) : null}

      {/* ── Sentence listening comprehension (hear a real example sentence, pick
          the English). Double-gated on speechAvailable so it renders nothing
          rather than a dead panel if speech flips unavailable mid-session. ── */}
      {mode === "sentence-listen" && speechAvailable ? (
        <SentenceListenPanel topic={topic} onRecord={recordQuizAnswer} />
      ) : null}

      {/* ── Topic Boss Round (mixed-skill capstone; crowns the topic on 4/4) ── */}
      {mode === "boss" ? (
        <BossPanel
          topic={topic}
          bossStat={progress.bossStats[topic.slug]}
          speechAvailable={speechAvailable}
          shortcutsEnabled={!helpOpen}
          onRecord={recordQuizAnswer}
          onComplete={(score) => recordBossResult(topic.slug, score, BOSS_STAGE_COUNT)}
        />
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
          Train your ear for tones — read the word, or just listen.
        </p>
        {/* Read/Listen sub-mode switch. Listen only appears once speech is
            confirmed available (same gate as the quiz's listening chip), so
            there is never a dead control on voiceless devices. */}
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tone practice mode">
          {([
            { key: "read", label: "Read" },
            ...(speechAvailable ? [{ key: "listen", label: "Listen 🔊" } as const] : []),
          ] as const).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setToneMode(m.key)}
              aria-pressed={toneMode === m.key}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold transition ${toneMode === m.key ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {toneMode === "listen" && speechAvailable ? (
          <ToneListenTrainer
            topic={topic}
            keyFor={keyFor}
            onRecord={recordQuizAnswer}
            onPracticeReading={() => setToneMode("read")}
          />
        ) : (
          <TonePractice topic={topic} />
        )}
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  // Quieter Level-2 look: the active tab is a subtle emerald wash + accent text
  // with a hairline inset ring, not a full emerald fill. Inactive tabs are muted
  // ink that lift slightly on hover. Tap target stays ≥44px.
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`min-h-[44px] shrink-0 snap-start rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:px-5 sm:text-base ${active ? "bg-emerald-400/12 text-emerald-200 ring-1 ring-inset ring-emerald-400/25" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
    >
      {children}
    </button>
  );
}
