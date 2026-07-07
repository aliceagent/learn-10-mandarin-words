"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { HomeIndexData, WordIndexEntry } from "@/lib/types";
import { datasetSummary, mergeWordIndex, nextRecommendedTopic, resolveRecentTopics } from "@/lib/data-logic";
import { track } from "@/lib/analytics";
import { useProgress, computeStreak } from "./use-progress";
import { goalProgress, streakAtRisk, studiedWithFreezes, todayISO } from "@/lib/progress-logic";
import { comebackDeck, daysSinceLastStudy, isLapsed } from "@/lib/comeback-logic";
import { primaryCta } from "@/lib/home-cta-logic";
import { categoryChips, starterLessons } from "@/lib/lesson-finder-logic";
import { onboardingNext } from "@/lib/onboarding-next-logic";
import { lessonCardStatus } from "@/lib/lesson-card-logic";
import { OnboardingModal, ContinueLearningCard } from "./onboarding";
import { RecentTopicsShelf } from "./recent-topics-shelf";
import { ProgressRing } from "./progress-ring";
import { TopicCard } from "./topic-card";
import { useSavedLessons } from "./use-saved-lessons";
import { downloadableMp4Url } from "@/lib/video";
import { WordSearchResults } from "./word-search-results";
import { ThemeToggle } from "./theme-toggle";
// Shared diacritic-tolerant normalizer so "nǐ", "ni", "ní" all match — the same
// helper the highlighter uses, keeping search and highlight in lockstep.
import { normalizePinyin } from "@/lib/highlight";
import { searchWords } from "@/lib/search-logic";

export function HomeApp({ data }: { data: HomeIndexData }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { progress, loaded, completeOnboarding, skipOnboarding, toggleFavoriteWord } = useProgress();
  // Which lesson videos are already in the offline cache — drives the "✓ Offline"
  // card chip. Empty until mount, so it never causes a hydration mismatch.
  const savedOffline = useSavedLessons();

  // The home page ships a hanzi-only topic index (Sprint 24); the pinyin/english
  // for all 1,020 words load lazily from /search-index.json the first time the
  // learner touches the search box. Until then `words` is null and `mergeWordIndex`
  // pads pinyin/english with "" — so titles/hanzi search works immediately and
  // offline, and full word search lights up once the index lands.
  const [words, setWords] = useState<WordIndexEntry[] | null>(null);
  const [wordsState, setWordsState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const ensureWordIndex = useCallback(() => {
    // Idempotent: only fetch when we haven't already (or after an error retry).
    setWordsState((state) => {
      if (state === "loading" || state === "ready") return state;
      fetch("/search-index.json")
        .then((res) => {
          if (!res.ok) throw new Error(`search index ${res.status}`);
          return res.json();
        })
        .then((data: WordIndexEntry[]) => {
          setWords(data);
          setWordsState("ready");
        })
        .catch(() => setWordsState("error"));
      return "loading";
    });
  }, []);

  // Rejoin the index with the lazily-loaded word data so everything downstream
  // (haystack, searchWords, matched-word rows, cards) keeps its TopicSummary shape.
  const topics = useMemo(() => mergeWordIndex(data.topics, words), [data.topics, words]);

  const nextTopic = useMemo(
    () => nextRecommendedTopic(topics, progress.learnedTopics),
    [topics, progress.learnedTopics],
  );
  // The single "smart" hero action — Resume (mid-activity) > Continue (has learned
  // lists) > Start (brand-new) — computed from the live dataset and persisted
  // progress. The hero now owns the resume surface, so the standalone resume card
  // is suppressed below whenever this already shows Resume. Before `loaded`,
  // progress is the empty default → "Start", which is a safe SSR/first-paint copy
  // that never mismatches on hydration.
  const cta = useMemo(
    () => primaryCta(topics, { learnedTopics: progress.learnedTopics, lastActivity: progress.lastActivity }),
    [topics, progress.learnedTopics, progress.lastActivity],
  );
  const showOnboarding = loaded && !progress.onboarding.completed;
  // What the onboarding modal offers after the goal step: a first-lesson picker
  // for new visitors, or a one-tap Resume for returning ones (Sprint 6). Reuses
  // the same starter ordering as the finder, so the two never disagree.
  const onboardingChoice = useMemo(
    () => onboardingNext(topics, { learnedTopics: progress.learnedTopics, lastActivity: progress.lastActivity }),
    [topics, progress.learnedTopics, progress.lastActivity],
  );

  // Finder building blocks (Sprint 4). Chips are static browse-by-theme links;
  // starter lessons hide topics already marked learned so a returning learner
  // sees fresh suggestions (the pure helpers own the ordering/dedup).
  const chips = useMemo(() => categoryChips(data.categories), [data.categories]);
  const starters = useMemo(
    () => starterLessons(topics, progress.learnedTopics),
    [topics, progress.learnedTopics],
  );

  const filtered = useMemo(() => {
    const q = normalizePinyin(query.trim());
    return topics.filter((topic) => {
      const matchesCategory = category === "all" || topic.categorySlug === category;
      if (!q) return matchesCategory;
      const haystack = normalizePinyin(
        [topic.titleEn, topic.titleCn, topic.category, ...topic.items.flatMap((item) => [item.hanzi, item.pinyin, item.english])].join(" ")
      );
      return matchesCategory && haystack.includes(q);
    });
  }, [category, topics, query]);

  // Flat, ranked word-level matches shown above the topic grid while searching.
  // Same normalizer as `filtered`, so any word here implies its topic is in
  // `filtered` too — the panel never shows beside the "No topics found" state.
  const wordResults = useMemo(
    () => searchWords(topics, query, { categorySlug: category === "all" ? undefined : category }),
    [category, topics, query],
  );

  const learnedCount = progress.learnedTopics.length;
  const favoriteCount = progress.favoriteWords.length + progress.favoriteTopics.length;
  // Streak reads the studied ∪ frozen union so a spent freeze bridges its day.
  const studiedUnion = studiedWithFreezes(progress);
  const streak = computeStreak(studiedUnion);
  const atRisk = streakAtRisk(studiedUnion);

  // Welcome-back path: a learner returning after 7+ days away, who has at least
  // one mastered/studied word to warm up from, sees a gentle comeback banner.
  // The deck length gates the banner so a lapsed-but-empty profile never sees it.
  const comebackCount = useMemo(
    () => comebackDeck(topics, progress.flashcardStats).length,
    [topics, progress.flashcardStats],
  );
  const lapsed = isLapsed(progress.studiedDates);
  const daysAway = daysSinceLastStudy(progress.studiedDates);

  const studiedWordsCount = Object.values(progress.flashcardStats).filter((s) => s.reviewCount > 0).length;
  const summary = datasetSummary(topics);
  const totalWords = summary.wordCount;
  const goal = goalProgress(progress);

  return (
    <main>
      {/* ── Hero ── */}
      <section className="mx-auto grid min-h-[88dvh] max-w-7xl items-center gap-10 px-6 py-12 pb-24 md:grid-cols-[1.05fr_0.95fr] md:px-10 md:pb-12">
        <div>
          {/* Device-local light/dark toggle (Sprint 16), right-aligned at the top */}
          {/* of the hero — the same quiet chip register as the tone-colors toggle. */}
          <div className="mb-4">
            <ThemeToggle />
          </div>
          <p className="mb-5 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
            {summary.formattedListCount} Mandarin vocab lists · {summary.formattedWordCount} words · one clean habit
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
            Learn 10 Mandarin Words
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Free Mandarin vocabulary lessons — watch a short video, practice with quizzes and flashcards, and track what sticks. Everything stays on your device.
          </p>
          {/* One adaptive primary action (Resume / Continue / Start) + a plain */}
          {/* "Browse all lessons" escape. The primary is the first interactive */}
          {/* element in the hero, so keyboard focus lands on the single most useful */}
          {/* next step. When it shows Resume it fires the same analytics event the */}
          {/* old standalone resume card did, keyed off the recorded last-activity slug. */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={cta.href}
              onClick={
                cta.kind === "resume"
                  ? () => track("last_activity_resumed", { topic: progress.lastActivity!.topicSlug })
                  : undefined
              }
              className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            >
              {cta.label}
            </Link>
            <a href="#find" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300/70">
              Browse all lessons
            </a>
          </div>
          <p className="mt-3 text-sm text-slate-400">{cta.sub}</p>
          {/* Path & Stats stay one tap away in the mobile bottom nav; on desktop */}
          {/* they drop to quiet text links so the hero leads with two clear CTAs. */}
          <div className="mt-5 hidden gap-6 text-sm md:flex">
            <Link href="/path" className="font-medium text-slate-400 transition hover:text-emerald-300">
              Learning path
            </Link>
            <Link href="/stats" className="font-medium text-slate-400 transition hover:text-emerald-300">
              Your stats
            </Link>
            <Link href="/settings" className="font-medium text-slate-400 transition hover:text-emerald-300">
              Settings
            </Link>
          </div>
        </div>

        {/* ── Today snapshot ── */}
        {/* One flat Level-1 card (post flat-background sprint: no shadow/backdrop */}
        {/* blur). Quiet Level-2 stat tiles sit inset on it; the amber streak chip */}
        {/* stays as the single semantic warm element. */}
        <div className="rounded-3xl border border-white/10 bg-surface p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
            <span className="text-sm font-semibold text-slate-300">Today&apos;s snapshot</span>
            {atRisk ? (
              <Link
                href="/review"
                className="rounded-full border border-amber-400/60 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:border-amber-300 hover:text-amber-200"
              >
                🔥 {streak}-day streak — practice today to keep it
              </Link>
            ) : streak > 0 ? (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5" aria-label={`${streak} day streak`}>
                <span className="text-sm font-black text-slate-950">{streak}</span>
                <span className="text-xs font-bold text-slate-950">day streak 🔥</span>
              </div>
            ) : (
              <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">Local first</span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              value={`${data.categories.length}`}
              label="categories"
              sublabel="topic sections"
            />
            <Metric
              value={`${data.topics.length}`}
              label="lessons"
              sublabel="ten-word topics"
            />
            <Metric
              value={`${studiedWordsCount}`}
              label={`of ${totalWords} words`}
              sublabel="flashcard studied"
              progress={{ current: studiedWordsCount, max: totalWords }}
            />
            <Metric
              value={`${learnedCount}`}
              label={`of ${data.topics.length} learned`}
              sublabel={`${favoriteCount} favorite${favoriteCount !== 1 ? "s" : ""}`}
              progress={{ current: learnedCount, max: data.topics.length }}
            />
          </div>
          {/* ── Today's goal ── */}
          {loaded && goal.goal > 0 ? (
            <div className="mt-4 flex items-center gap-4 border-t border-white/10 pt-4">
              <ProgressRing
                value={goal.practiced}
                max={goal.goal}
                size={64}
                label={`Daily goal: ${goal.practiced} of ${goal.goal} words practiced today`}
              >
                {goal.practiced}/{goal.goal}
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {goal.met ? "Goal met 🎉" : "words practiced today"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {goal.met
                    ? `${goal.practiced} distinct word${goal.practiced !== 1 ? "s" : ""} today`
                    : `${goal.practiced} of ${goal.goal} distinct words today`}
                </p>
              </div>
            </div>
          ) : loaded ? (
            <div className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-400">
              <Link href="/stats" className="font-semibold text-emerald-300 transition hover:text-emerald-200">
                Set a daily goal
              </Link>{" "}
              on the stats page to track today&apos;s practice.
            </div>
          ) : null}

          {/* Data actions (export/import) and every device-local preference now */}
          {/* live on one /settings page — this card just links there. */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <Link
              href="/settings"
              className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
              aria-label="Open settings to export or import progress and adjust preferences"
            >
              <span>Settings · export &amp; import progress</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Find your lesson (Sprint 4) ── */}
      {/* Lifted directly under the hero so a learner/teacher can locate a lesson */}
      {/* fast: one search box (the single source of search state, shared with the */}
      {/* library grid below), one-tap category chips → dedicated pages, and a short */}
      {/* starter row for newcomers. The hero's "Browse all lessons" scrolls here. */}
      <section id="find" className="mx-auto max-w-7xl px-6 pt-14 md:px-10">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Find your lesson</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Search {summary.formattedWordCount} words or browse by theme
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex flex-1 flex-col gap-1.5">
            <input
              value={query}
              onChange={(event) => {
                // Defensive: kick off the lazy word index on the first keystroke
                // too, in case focus fired without it (autofill, programmatic).
                ensureWordIndex();
                setQuery(event.target.value);
              }}
              onFocus={ensureWordIndex}
              placeholder="Search words, pinyin, English"
              aria-label="Search vocabulary"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
            />
            {/* Honest status while the pinyin/english index loads or fails; only
                when a query is active, so an idle focus stays quiet. */}
            {query.trim() && wordsState === "loading" ? (
              <p className="px-1 text-xs text-slate-500">Loading full word search…</p>
            ) : query.trim() && wordsState === "error" ? (
              <p className="px-1 text-xs text-slate-500">
                Full word search couldn&apos;t load — searching titles and characters only.
              </p>
            ) : null}
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            className="rounded-2xl border border-white/10 bg-surface-2 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
          >
            <option value="all">All categories</option>
            {data.categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
          </select>
        </div>

        {/* Browse-by-theme chips → dedicated category pages. */}
        <nav aria-label="Browse by category" className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.slug}
              href={chip.href}
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface px-4 py-2 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-emerald-300/70 hover:text-white"
            >
              <span>{chip.name}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-xs font-medium text-slate-400">
                {chip.count}
              </span>
            </Link>
          ))}
        </nav>

        {query.trim() ? (
          <div className="mt-6">
            <WordSearchResults
              results={wordResults}
              query={query}
              favoriteWords={progress.favoriteWords}
              onToggleFavorite={(key) => {
                // Mirror topic-app: only count a genuine save (not an un-save).
                if (!progress.favoriteWords.includes(key)) track("favorite_saved", { topic: key.split(":")[0], kind: "word" });
                toggleFavoriteWord(key);
              }}
              onOpenResult={(result) => track("search_result_opened", { topic: result.topicSlug, rank: result.rank })}
            />
          </div>
        ) : (
          <>
            {/* Newcomer on-ramp: a short, stable set of starters (learned ones
                hidden). Hidden once the learner is searching — results take over. */}
            {starters.length > 0 ? (
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-300">New here? Start with one of these</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {starters.map((topic) => (
                    <Link
                      key={topic.slug}
                      href={`/topics/${topic.slug}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface px-5 py-4 transition hover:-translate-y-0.5 hover:bg-surface-hover"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-white transition group-hover:text-emerald-50">{topic.titleEn}</span>
                        <span lang="zh" className="mt-0.5 block truncate text-sm text-slate-400">{topic.titleCn}</span>
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-slate-500 transition group-hover:text-emerald-300">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="mt-4 text-sm text-slate-500">Try “fruit”, “gǒu”, or tap a category.</p>
          </>
        )}
      </section>

      {/* ── Welcome-back banner (lapsed learner, warm-up available) ── */}
      {loaded && lapsed && daysAway !== null && comebackCount > 0 ? (
        <WelcomeBackBanner daysAway={daysAway} />
      ) : null}

      {/* ── Daily Challenge banner ── */}
      {loaded ? <DailyChallengeBanner result={progress.dailyChallenge[todayISO()]} /> : null}

      {/* ── Continue learning / Start here CTA ── */}
      {loaded ? (
        <ContinueLearningCard
          nextTopic={nextTopic}
          learnedCount={learnedCount}
          dailyGoal={progress.onboarding.dailyGoal}
        />
      ) : null}

      {/* Resume now lives in the adaptive hero primary action (Sprint 3), so the */}
      {/* standalone resume card is retired here — the recent-topics shelf below */}
      {/* still covers browsing *other* recently opened lessons. */}

      {/* ── Recently studied shelf (resume where you left off) ── */}
      {loaded ? (
        <RecentTopicsShelf
          topics={resolveRecentTopics(topics, progress.recentTopics)}
          flashcardStats={progress.flashcardStats}
          onResume={(slug, rank) => track("recent_topic_resumed", { topic: slug, rank })}
        />
      ) : null}

      {/* ── How it works ── */}
      {/* A plain, three-step "how to use this" loop (Watch → Practice → Review)
          so a first-time learner or an evaluating teacher understands the
          product before committing — distinct from the capability grid below. */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pt-14 md:px-10">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Watch, practice, review
          </h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          <HowItWorksStep
            step="1 · Watch"
            body="A short video introduces 10 words with Chinese, pinyin, and English."
          />
          <HowItWorksStep
            step="2 · Practice"
            body="Quizzes, flashcards, matching, and typing lock them in."
          />
          <HowItWorksStep
            step="3 · Review"
            body="Spaced repetition brings words back right before you forget."
          />
        </ol>
      </section>

      {/* ── Feature row ── */}
      <section id="practice" className="mt-14 border-y border-white/10 bg-background/70 px-6 py-12 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          <Feature title="Video lessons" body="Each topic gets one short drill video with Chinese, pinyin, and English." />
          <Feature title="Matching quizzes" body="Three quiz modes: Hanzi→English, English→Hanzi, and Hanzi→Pinyin." />
          <Feature title="Flashcards" body="Reveal answers, grade difficulty, and build a spaced-repetition review queue." />
          <Feature title="Progress tracking" body="Favorite words, save lists, streak tracking, and export your progress as JSON." />
        </div>

        {/* Pass-and-play duel entry (Sprint 10). */}
        <div className="mx-auto mt-4 max-w-7xl">
          <Link
            href="/duel"
            className="group flex items-center justify-between gap-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 transition hover:border-emerald-300/50 hover:bg-emerald-500/15 md:px-6"
            aria-label="Start a pass-and-play duel"
          >
            <div className="min-w-0">
              <p className="font-semibold text-white">⚔️ Pass &amp; Play Duel</p>
              <p className="mt-0.5 text-sm text-slate-300">
                Two learners, one device — take turns and see who wins. No account needed.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition group-hover:bg-cta">
              Play
            </span>
          </Link>
        </div>
      </section>

      {/* ── Browse by category ── */}
      <section id="categories" className="mx-auto max-w-7xl px-6 pt-14 md:px-10">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Browse by category</h2>
          <p className="mt-3 max-w-2xl text-slate-400">Open a dedicated page for any category to browse its topics on their own.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((cat) => {
            const topicCount = data.topics.filter((t) => t.categorySlug === cat.slug).length;
            return (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface px-5 py-4 transition hover:-translate-y-0.5 hover:bg-surface-hover"
                aria-label={`${cat.name} — ${topicCount} topic${topicCount !== 1 ? "s" : ""}`}
              >
                <span className="font-semibold text-white transition group-hover:text-emerald-50">{cat.name}</span>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-400">
                  {topicCount} topic{topicCount !== 1 ? "s" : ""}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Library ── */}
      {/* Search + category controls now live in the #find block above (one shared */}
      {/* search state, no duplicate input); this section is the full topic grid, */}
      {/* which narrows live as the finder's query/category change. */}
      <section id="library" className="mx-auto max-w-7xl px-6 py-14 pb-24 md:px-10 md:pb-14">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Vocabulary library</h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            Every ten-word lesson. Search or filter from{" "}
            <a href="#find" className="font-semibold text-emerald-300 transition hover:text-emerald-200">Find your lesson</a>{" "}
            above — the grid below updates as you go.
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-surface p-12 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-4 text-xl font-semibold text-white">No topics found</p>
            <p className="mt-2 text-slate-400">
              {query ? `No results for "${query}" — try a different word, pinyin, or English translation.` : "No topics match the selected category."}
            </p>
            <button
              onClick={() => { setQuery(""); setCategory("all"); }}
              className="mt-6 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((topic) => (
              <TopicCard
                key={topic.slug}
                topic={topic}
                learned={progress.learnedTopics.includes(topic.slug)}
                favorite={progress.favoriteTopics.includes(topic.slug)}
                crowned={Boolean(progress.bossStats[topic.slug]?.crownedAt)}
                savedOffline={savedOffline.has(downloadableMp4Url(topic) ?? "")}
                flashcardStats={progress.flashcardStats}
                quizStats={progress.quizStats}
                status={lessonCardStatus(topic, progress)}
                query={query}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="mx-auto max-w-7xl px-6 pb-28 md:px-10 md:pb-12">
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-slate-500 sm:flex-row">
          <p>Local-first · your progress never leaves your device.</p>
          <div className="flex gap-4">
            <Link href="/daily" className="transition hover:text-slate-300">Daily</Link>
            <Link href="/duel" className="transition hover:text-slate-300">Duel</Link>
            <Link href="/tone-pairs" className="transition hover:text-slate-300">Tone Twins</Link>
            <Link href="/path" className="transition hover:text-slate-300">Path</Link>
            <Link href="/review" className="transition hover:text-slate-300">Review</Link>
            <Link href="/favorites" className="transition hover:text-slate-300">Favorites</Link>
            <Link href="/stats" className="transition hover:text-slate-300">Stats</Link>
            <Link href="/privacy" className="transition hover:text-slate-300">Privacy</Link>
          </div>
        </div>
      </footer>

      {/* ── First-run onboarding ── */}
      {showOnboarding ? (
        <OnboardingModal
          next={onboardingChoice}
          onComplete={(goal) => { completeOnboarding(goal); track("onboarding_completed", { dailyGoal: goal }); }}
          onSkip={() => { skipOnboarding(); track("onboarding_skipped"); }}
        />
      ) : null}
    </main>
  );
}

// ── Welcome-back banner ───────────────────────────────────────────────────────

// Shown above the Daily Challenge banner when a learner returns after 7+ days
// away and has words to warm up from. A confidence-first invitation to /comeback
// (which stamps today's study date and dismisses this banner on the first grade)
// rather than confronting the returning learner with a dead streak and a backlog.
function WelcomeBackBanner({ daysAway }: { daysAway: number }) {
  return (
    <section className="mx-auto max-w-7xl px-6 md:px-10">
      <Link
        href="/comeback"
        className="group flex items-center justify-between gap-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 transition hover:border-emerald-300/50 hover:bg-emerald-500/15 md:px-6"
        aria-label="Start your welcome-back warm-up"
      >
        <div className="min-w-0">
          <p className="font-semibold text-white">👋 Welcome back — it&apos;s been {daysAway} days</p>
          <p className="mt-0.5 text-sm text-slate-300">
            Ease back in with a quick warm-up of words you already know. No pressure, no pile.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition group-hover:bg-cta">
          Warm up
        </span>
      </Link>
    </section>
  );
}

// ── Daily Challenge banner ────────────────────────────────────────────────────

// A one-tap entry point to /daily, sitting just above the continue-learning CTA.
// Shows the done state (with today's score) once the official challenge is
// complete, otherwise an undone "Play" prompt. `result` is today's stored
// DailyChallengeResult, or undefined when it hasn't been played yet.
function DailyChallengeBanner({ result }: { result?: { score: number; total: number } }) {
  const done = Boolean(result);
  return (
    <section className="mx-auto max-w-7xl px-6 md:px-10">
      <Link
        href="/daily"
        className="group flex items-center justify-between gap-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 transition hover:border-emerald-300/50 hover:bg-emerald-500/15 md:px-6"
        aria-label="Open today's Daily Challenge"
      >
        <div className="min-w-0">
          {done ? (
            <>
              <p className="font-semibold text-white">✅ Today&apos;s Challenge — {result!.score}/{result!.total}</p>
              <p className="mt-0.5 text-sm text-slate-300">New one tomorrow — keep the streak alive.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-white">🀄 Today&apos;s Challenge · 10 questions from your topics</p>
              <p className="mt-0.5 text-sm text-slate-300">A fresh mixed quiz, same for everyone. Keep the streak alive.</p>
            </>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition group-hover:bg-cta">
          {done ? "Review" : "Play"}
        </span>
      </Link>
    </section>
  );
}

// ── Metric card with optional progress bar ────────────────────────────────────

function Metric({
  value,
  label,
  sublabel,
  progress,
}: {
  value: string;
  label: string;
  sublabel?: string;
  progress?: { current: number; max: number };
}) {
  const pct = progress ? Math.min(100, progress.max > 0 ? (progress.current / progress.max) * 100 : 0) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-2 p-4">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-300">{label}</div>
      {sublabel ? <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div> : null}
      {progress && progress.max > 0 ? (
        <div className="progress-bar-track mt-3">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-surface p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

// ── How-it-works step ─────────────────────────────────────────────────────────

// One numbered step in the Watch → Practice → Review strip. `step` carries the
// order as text ("1 · Watch") so the loop is legible without relying on the
// visual list-item numbering alone.
function HowItWorksStep({ step, body }: { step: string; body: string }) {
  return (
    <li className="list-none rounded-3xl border border-white/10 bg-surface p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">{step}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </li>
  );
}

