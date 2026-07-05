"use client";

import Link from "next/link";
import { useRef, useMemo, useState } from "react";
import type { HomeData } from "@/lib/types";
import { datasetSummary, nextRecommendedTopic } from "@/lib/data-logic";
import { track } from "@/lib/analytics";
import { useProgress, computeStreak } from "./use-progress";
import { goalProgress, streakAtRisk, todayISO } from "@/lib/progress-logic";
import { OnboardingModal, ContinueLearningCard } from "./onboarding";
import { ProgressRing } from "./progress-ring";
import { TopicCard } from "./topic-card";
import { WordSearchResults } from "./word-search-results";
// Shared diacritic-tolerant normalizer so "nǐ", "ni", "ní" all match — the same
// helper the highlighter uses, keeping search and highlight in lockstep.
import { normalizePinyin } from "@/lib/highlight";
import { searchWords } from "@/lib/search-logic";

export function HomeApp({ data }: { data: HomeData }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { progress, loaded, exportProgress, importProgress, completeOnboarding, skipOnboarding, toggleFavoriteWord } = useProgress();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextTopic = useMemo(
    () => nextRecommendedTopic(data.topics, progress.learnedTopics),
    [data.topics, progress.learnedTopics],
  );
  const showOnboarding = loaded && !progress.onboarding.completed;

  const filtered = useMemo(() => {
    const q = normalizePinyin(query.trim());
    return data.topics.filter((topic) => {
      const matchesCategory = category === "all" || topic.categorySlug === category;
      if (!q) return matchesCategory;
      const haystack = normalizePinyin(
        [topic.titleEn, topic.titleCn, topic.category, ...topic.items.flatMap((item) => [item.hanzi, item.pinyin, item.english])].join(" ")
      );
      return matchesCategory && haystack.includes(q);
    });
  }, [category, data.topics, query]);

  // Flat, ranked word-level matches shown above the topic grid while searching.
  // Same normalizer as `filtered`, so any word here implies its topic is in
  // `filtered` too — the panel never shows beside the "No topics found" state.
  const wordResults = useMemo(
    () => searchWords(data.topics, query, { categorySlug: category === "all" ? undefined : category }),
    [category, data.topics, query],
  );

  const learnedCount = progress.learnedTopics.length;
  const favoriteCount = progress.favoriteWords.length + progress.favoriteTopics.length;
  const streak = computeStreak(progress.studiedDates ?? []);
  const atRisk = streakAtRisk(progress.studiedDates ?? []);

  const studiedWordsCount = Object.values(progress.flashcardStats).filter((s) => s.reviewCount > 0).length;
  const summary = datasetSummary(data.topics);
  const totalWords = summary.wordCount;
  const goal = goalProgress(progress);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importProgress(ev.target?.result as string);
      } catch {
        alert("Could not import: invalid progress file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <main>
      {/* ── Hero ── */}
      <section className="mx-auto grid min-h-[88dvh] max-w-7xl items-center gap-10 px-6 py-12 pb-24 md:grid-cols-[1.05fr_0.95fr] md:px-10 md:pb-12">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
            {summary.formattedListCount} Mandarin vocab lists · {summary.formattedWordCount} words · one clean habit
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
            Learn 10 Mandarin Words
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Watch short vocabulary lessons, practice with matching quizzes, save favorite words, and mark each list as learned.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#library" className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
              Start learning
            </a>
            <Link href="/review" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300/70">
              Daily review
            </Link>
          </div>
          {/* Path & Stats stay one tap away in the mobile bottom nav; on desktop */}
          {/* they drop to quiet text links so the hero leads with two clear CTAs. */}
          <div className="mt-5 hidden gap-6 text-sm md:flex">
            <Link href="/path" className="font-medium text-slate-400 transition hover:text-emerald-300">
              Learning path
            </Link>
            <Link href="/stats" className="font-medium text-slate-400 transition hover:text-emerald-300">
              Your stats
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

          <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
            <button
              onClick={exportProgress}
              className="flex-1 rounded-2xl border border-white/10 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
              aria-label="Export progress as JSON"
            >
              Export progress
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-2xl border border-white/10 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
              aria-label="Import progress from JSON file"
            >
              Import progress
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="sr-only"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

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

      {/* ── Feature row ── */}
      <section id="practice" className="mt-14 border-y border-white/10 bg-slate-950/70 px-6 py-12 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          <Feature title="Video lessons" body="Each topic gets one short drill video with Chinese, pinyin, and English." />
          <Feature title="Matching quizzes" body="Three quiz modes: Hanzi→English, English→Hanzi, and Hanzi→Pinyin." />
          <Feature title="Flashcards" body="Reveal answers, grade difficulty, and build a spaced-repetition review queue." />
          <Feature title="Progress tracking" body="Favorite words, save lists, streak tracking, and export your progress as JSON." />
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
      <section id="library" className="mx-auto max-w-7xl px-6 py-14 pb-24 md:px-10 md:pb-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Vocabulary library</h2>
            <p className="mt-3 max-w-2xl text-slate-400">Filter by category, search any word — results show both matching words and topics.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words, pinyin, English"
              aria-label="Search vocabulary"
              className="min-w-64 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
            >
              <option value="all">All categories</option>
              {data.categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
            </select>
          </div>
        </div>

        {query.trim() ? (
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
        ) : null}

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-surface p-12 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-4 text-xl font-semibold text-white">No topics found</p>
            <p className="mt-2 text-slate-400">
              {query ? `No results for "${query}" — try a different word, pinyin, or English translation.` : "No topics match the selected category."}
            </p>
            <button
              onClick={() => { setQuery(""); setCategory("all"); }}
              className="mt-6 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
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
                flashcardStats={progress.flashcardStats}
                quizStats={progress.quizStats}
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
          firstTopic={nextTopic}
          onComplete={(goal) => { completeOnboarding(goal); track("onboarding_completed", { dailyGoal: goal }); }}
          onSkip={() => { skipOnboarding(); track("onboarding_skipped"); }}
        />
      ) : null}
    </main>
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
        <span className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition group-hover:bg-emerald-300">
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

