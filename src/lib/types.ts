import type { ResumableQuizMode, TopicMode } from "./topic-mode-logic";

export type Sentence = {
  cn: string;
  en: string;
};

export type VocabItem = {
  hanzi: string;
  pinyin: string;
  english: string;
  sentences: Sentence[];
};

// Optional richer video metadata for when real lessons are connected.
// `videoPath` (below) stays the single source of truth for playback; `video`
// carries extra hints (poster frame, captions, human-readable provider) that the
// player uses when present. See scripts/map-videos.mjs and README "Video integration".
export type VideoProvider = "mp4" | "youtube" | "none";

export type Caption = {
  /** BCP-47 language tag, e.g. "zh-CN" or "en". */
  lang: string;
  /** Human label shown in the track picker. */
  label: string;
  /** Path or URL to a .vtt captions file. */
  src: string;
};

export type VideoMeta = {
  provider: VideoProvider;
  /** YouTube id/URL or an .mp4 path/URL. Mirrors `videoPath` when set. */
  source?: string;
  /** Poster/thumbnail image shown before playback. */
  poster?: string;
  captions?: Caption[];
};

export type Topic = {
  slug: string;
  titleCn: string;
  titleEn: string;
  category: string;
  categorySlug: string;
  videoPath: string;
  /** Optional; absent until a real video is mapped in. */
  video?: VideoMeta;
  items: VocabItem[];
};

export type Category = {
  name: string;
  slug: string;
  topics: string[];
};

// Slimmed shapes for the home route. The home page never renders or searches
// example sentences, so serializing them into the RSC payload (and bundling
// topics.json into the client chunk) is pure waste. `TopicSummary` drops
// per-item `sentences` while keeping every topic-level field, so a full `Topic`
// stays structurally assignable to it — shared consumers (category/path cards)
// need no changes. See toTopicSummary / homeData.
export type VocabItemSummary = Pick<VocabItem, "hanzi" | "pinyin" | "english">;
export type TopicSummary = Omit<Topic, "items"> & { items: VocabItemSummary[] };
export type HomeData = { categories: Category[]; topics: TopicSummary[] };

// Split home payload (Sprint 24). `TopicSummary` above still keeps pinyin/english
// for every word, but the home page only needs those *while searching* — the
// hero, category grid, topic cards, and progress UI need just the hanzi. So the
// home route ships a hanzi-only `HomeIndexData`, and the pinyin/english for all
// 1,020 words load lazily as a `WordIndexEntry[]` (the `/search-index.json`
// endpoint) only when the learner focuses the search box. `mergeWordIndex` joins
// them back into `TopicSummary[]` client-side, so every downstream consumer keeps
// its existing shape. `/duel` still uses the full `TopicSummary`/`HomeData`.
export type VocabItemIndex = Pick<VocabItem, "hanzi">;
export type TopicIndexEntry = Omit<Topic, "items"> & { items: VocabItemIndex[] };
export type HomeIndexData = { categories: Category[]; topics: TopicIndexEntry[] };
export type WordIndexEntry = { slug: string; items: VocabItemSummary[] };

export type MandarinData = {
  categories: Category[];
  topics: Topic[];
};

export type FlashcardStat = {
  intervalDays: number;
  ease: number;
  dueAt: string;
  reviewCount: number;
  /**
   * Count of `"again"` grades ever recorded for this word (a lapse counter).
   * Non-negative integer; only incremented at the `scheduleReview` choke point.
   * Powers leech detection (repeatedly-missed words). Added in schema v8;
   * older stats backfill to 0.
   */
  lapses: number;
};

// Per-word quiz accuracy, keyed by the same `wordKey` (`topic.slug:hanzi`) used
// for flashcardStats. `correct` is always ≤ `attempts`; both are non-negative
// integers. Used to surface weak/tricky words on the stats page.
export type QuizStat = {
  correct: number;
  attempts: number;
};

// One official Daily Challenge result for a given ISO day. `score` is always
// ≤ `total`; both are non-negative integers. Keyed by the `YYYY-MM-DD` day the
// run was started on. Added in schema v5.
export type DailyChallengeResult = {
  score: number;
  total: number;
  /** ISO timestamp the challenge was completed. */
  completedAt: string;
};

// Per-topic Boss Round record, keyed by topic slug. `bestScore` is the best
// number of stages passed in one run (0–BOSS_STAGE_COUNT); `attempts` counts
// every completed run; `crownedAt` is the ISO timestamp of the FIRST flawless
// run (all stages passed), or null until the topic is crowned. Added in schema v7.
export type BossStat = {
  bestScore: number;
  attempts: number;
  crownedAt: string | null;
};

// Earned "streak freeze" tokens that automatically cover a single missed study
// day so a long streak survives one lapse. Added in schema v9. `frozenDates` are
// the ISO days a spent freeze covered — they are unioned into streak math ONLY
// (see studiedWithFreezes) and are never added to `studiedDates`, so daysStudied,
// the heatmap, and achievements keep counting only real study days.
export type StreakFreezeState = {
  /** Banked freeze tokens, 0..MAX_STREAK_FREEZES. */
  available: number;
  /** ISO day the last token was earned, or null. Enforces non-overlapping weeks. */
  lastEarnedOn: string | null;
  /** ISO days a consumed freeze covered. Unioned into streak math only. */
  frozenDates: string[];
};

// The single most recent activity the learner touched — the topic, the practice
// mode, and (for quiz) the sub-mode — so the home page can offer a one-tap
// "Resume where you left off" deep-link back into that exact drill. Recorded on
// every mode switch; never affects streaks or the daily goal (a mode switch is
// not practice). Added in schema v12. See topic-mode-logic.ts for the mode ids
// and resume-logic.ts for resolving this into a renderable target.
export type LastActivity = {
  /** Slug of the topic the learner last practiced. */
  topicSlug: string;
  /** The practice mode they were in (canonical id from topic-mode-logic). */
  mode: TopicMode;
  /** Quiz sub-mode; only meaningful (and only persisted) when `mode === "quiz"`. */
  quizMode?: ResumableQuizMode;
  /** ISO timestamp this activity was recorded. */
  updatedAt: string;
};

export type OnboardingState = {
  /** Whether the user has completed or skipped first-run onboarding. */
  completed: boolean;
  /** Words-per-day target captured during onboarding (0 = not set). */
  dailyGoal: number;
  /** ISO date the user finished onboarding, or null if never. */
  completedAt: string | null;
};

export type ProgressState = {
  /**
   * Version of the persisted progress shape. Bumped when the schema changes so
   * `normalizeProgress` can migrate older saves. See
   * CURRENT_PROGRESS_SCHEMA_VERSION in progress-logic.ts.
   */
  schemaVersion: number;
  learnedTopics: string[];
  favoriteTopics: string[];
  favoriteWords: string[];
  flashcardStats: Record<string, FlashcardStat>;
  /** Per-word quiz accuracy, keyed by `wordKey`. Added in schema v3. */
  quizStats: Record<string, QuizStat>;
  /**
   * Distinct wordKeys practiced per ISO day (`YYYY-MM-DD` → wordKeys). Powers the
   * daily-goal ring. Pruned to the most recent DAILY_ACTIVITY_RETENTION_DAYS days
   * on every write so storage stays bounded. Added in schema v4.
   */
  dailyActivity: Record<string, string[]>;
  /**
   * One official Daily Challenge result per ISO day (`YYYY-MM-DD` →
   * DailyChallengeResult). First completion of a day wins; pruned to the most
   * recent DAILY_CHALLENGE_RETENTION_DAYS days on every write. Added in schema v5.
   */
  dailyChallenge: Record<string, DailyChallengeResult>;
  /**
   * Per-day quiz accuracy tally (`YYYY-MM-DD` → QuizStat), summed across every
   * quiz-style answer recorded that day. Unlike the all-time `quizStats` (keyed
   * by word), this is keyed by day so a trailing-week accuracy can be derived for
   * the weekly recap card. Pruned to the most recent DAILY_QUIZ_RETENTION_DAYS
   * days on every write so storage stays bounded. Added in schema v11.
   */
  dailyQuiz: Record<string, QuizStat>;
  /**
   * All-time best consecutive-correct quiz streak (the longest combo ever reached
   * in the Quiz tab). Monotonic — only ever raised. Added in schema v6.
   */
  bestQuizCombo: number;
  /**
   * Per-topic Boss Round records (topic slug → BossStat). A flawless run crowns
   * the topic (👑); best score and attempt count persist for the intro screen.
   * Added in schema v7.
   */
  bossStats: Record<string, BossStat>;
  studiedDates: string[];
  /**
   * Earned streak-freeze tokens (max MAX_STREAK_FREEZES) plus the days a spent
   * freeze covered. Added in schema v9. `frozenDates` are unioned into streak
   * math only (studiedWithFreezes) and never inflate daysStudied/heatmap.
   */
  streakFreezes: StreakFreezeState;
  /**
   * Topic slugs the learner most-recently opened, most-recent first, deduped and
   * capped at RECENT_TOPICS_MAX. Powers the home "Jump back in" shelf. A mere
   * topic visit records here and nowhere else — it never touches studiedDates or
   * dailyActivity. Added in schema v10; older saves migrate to an empty array.
   */
  recentTopics: string[];
  /**
   * The single most recent (topic, mode, quiz sub-mode) the learner touched, so
   * the home page can offer a one-tap "Resume where you left off" card. Recorded
   * on every mode switch and, like `recentTopics`, never touches studiedDates or
   * dailyActivity. null until the learner opens any practice mode. Added in
   * schema v12; older saves migrate to null.
   */
  lastActivity: LastActivity | null;
  onboarding: OnboardingState;
};

// Architecture-ready interface for future cloud sync (not yet implemented)
export interface CloudSyncProvider {
  load(): Promise<ProgressState | null>;
  save(state: ProgressState): Promise<void>;
}
