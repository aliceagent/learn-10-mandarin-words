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

export type Topic = {
  slug: string;
  titleCn: string;
  titleEn: string;
  category: string;
  categorySlug: string;
  videoPath: string;
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

export type ProgressState = {
  learnedTopics: string[];
  favoriteTopics: string[];
  favoriteWords: string[];
  flashcardStats: Record<string, FlashcardStat>;
  studiedDates: string[];
};

// Architecture-ready interface for future cloud sync (not yet implemented)
export interface CloudSyncProvider {
  load(): Promise<ProgressState | null>;
  save(state: ProgressState): Promise<void>;
}
