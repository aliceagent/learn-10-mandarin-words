import type { FlashcardStat, Topic, VocabItem } from "./types";
import type { Grade } from "./progress-logic";
import { wordKey } from "./data-logic.ts";
import { flashcardConfidence } from "./flashcard-confidence.ts";

export type FlashcardSessionResult = Grade | "known";

export type FlashcardSessionRecord = {
  key: string;
  result: FlashcardSessionResult;
  beforeStat?: FlashcardStat;
};

export type FlashcardSessionState = {
  topicSlug: string;
  totalCount: number;
  records: FlashcardSessionRecord[];
};

export type FlashcardSessionSummary = {
  complete: boolean;
  reviewedCount: number;
  totalCount: number;
  gradeCounts: Record<FlashcardSessionResult, number>;
  improvedCount: number;
  needsWorkCount: number;
  knownCount: number;
  needsWorkKeys: string[];
};

export function emptyFlashcardSession(topic: Pick<Topic, "slug" | "items">): FlashcardSessionState {
  return { topicSlug: topic.slug, totalCount: topic.items.length, records: [] };
}

export function recordFlashcardSessionResult(
  session: FlashcardSessionState,
  key: string,
  result: FlashcardSessionResult,
  beforeStat?: FlashcardStat,
): FlashcardSessionState {
  const withoutExisting = session.records.filter((record) => record.key !== key);
  return {
    ...session,
    records: [...withoutExisting, { key, result, beforeStat }],
  };
}

export function flashcardSessionSummary(
  session: FlashcardSessionState,
  topic: Pick<Topic, "slug" | "items">,
  afterStats: Record<string, FlashcardStat>,
): FlashcardSessionSummary {
  const topicKeys = new Set(topic.items.map((item) => wordKey(topic, item)));
  const records = session.records.filter((record) => topicKeys.has(record.key));
  const gradeCounts: Record<FlashcardSessionResult, number> = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    known: 0,
  };
  const needsWorkKeys: string[] = [];
  let improvedCount = 0;

  for (const record of records) {
    gradeCounts[record.result] += 1;
    if (record.result === "again" || record.result === "hard") {
      needsWorkKeys.push(record.key);
    }
    const beforeScore = flashcardConfidence(record.beforeStat).score;
    const afterScore = flashcardConfidence(afterStats[record.key]).score;
    if (afterScore > beforeScore) improvedCount += 1;
  }

  return {
    complete: records.length >= topic.items.length && topic.items.length > 0,
    reviewedCount: records.length,
    totalCount: topic.items.length,
    gradeCounts,
    improvedCount,
    needsWorkCount: needsWorkKeys.length,
    knownCount: gradeCounts.known,
    needsWorkKeys,
  };
}

export function itemsForFlashcardSessionKeys(
  topic: Pick<Topic, "slug" | "items">,
  keys: string[],
): VocabItem[] {
  const wanted = new Set(keys);
  return topic.items.filter((item) => wanted.has(wordKey(topic, item)));
}
