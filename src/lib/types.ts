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

export type MandarinData = {
  categories: Category[];
  topics: Topic[];
};

export type FlashcardStat = {
  intervalDays: number;
  ease: number;
  dueAt: string;
  reviewCount: number;
};

// Per-word quiz accuracy, keyed by the same `wordKey` (`topic.slug:hanzi`) used
// for flashcardStats. `correct` is always ≤ `attempts`; both are non-negative
// integers. Used to surface weak/tricky words on the stats page.
export type QuizStat = {
  correct: number;
  attempts: number;
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
  studiedDates: string[];
  onboarding: OnboardingState;
};

// Architecture-ready interface for future cloud sync (not yet implemented)
export interface CloudSyncProvider {
  load(): Promise<ProgressState | null>;
  save(state: ProgressState): Promise<void>;
}
