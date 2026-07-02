import type { QuizStat, Topic, VocabItem } from "./types";
// Explicit `.ts` extensions so these runtime imports resolve under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept them via `allowImportingTsExtensions`. Mirrors quiz-logic.ts /
// progress-logic.ts.
import { computeWeakWords } from "./progress-logic.ts";
import { buildQuizCard, defaultShuffle, type QuizCard, type QuizMode } from "./quiz-logic.ts";
import { wordKey } from "./data-logic.ts";

// Pure helpers for the /practice deck: take the learner's weakest quizzed words
// (from computeWeakWords) and resolve them back to real dataset items, then turn
// those into quiz cards. Everything here is dataset-parameterized and DOM-free so
// the resolution + deck-building can be unit-tested without React; the
// practice-app component layers session state on top.

// A weak word resolved to its real dataset item plus the metadata the practice
// UI needs (topic link + a same-topic distractor pool).
export type PracticeEntry = {
  key: string; // wordKey (`topic.slug:hanzi`)
  item: VocabItem;
  topicSlug: string;
  topicTitle: string;
  poolItems: VocabItem[]; // the entry's full topic item list (distractor pool)
  accuracy: number; // from computeWeakWords
  attempts: number;
};

// Weakest words resolved to real dataset items, weakest-first. Runs
// computeWeakWords over `quizStats`, then maps each weak key through a wordKey
// index of `topics`. Keys that no longer resolve (e.g. after a dataset edit) are
// silently dropped — the same policy stats-app uses — while the weak order is
// preserved. Each entry carries the owning topic's full item list as its
// distractor pool, so practice choices are always same-topic.
export function resolveWeakItems(
  topics: Topic[],
  quizStats: Record<string, QuizStat> | undefined,
  opts: { minAttempts?: number; limit?: number } = {},
): PracticeEntry[] {
  const byKey = new Map<string, { item: VocabItem; topic: Topic }>();
  for (const topic of topics) {
    for (const item of topic.items) {
      byKey.set(wordKey(topic, item), { item, topic });
    }
  }
  const entries: PracticeEntry[] = [];
  for (const weak of computeWeakWords(quizStats, opts)) {
    const found = byKey.get(weak.key);
    if (!found) continue; // unresolvable key — drop it
    entries.push({
      key: weak.key,
      item: found.item,
      topicSlug: found.topic.slug,
      topicTitle: found.topic.titleEn,
      poolItems: found.topic.items,
      accuracy: weak.accuracy,
      attempts: weak.attempts,
    });
  }
  return entries;
}

// One QuizCard per entry, drawing distractors from that entry's own topic items
// so choices are same-topic and unique. The card's key is the entry's wordKey,
// so answers persist against the exact word the learner is practicing.
export function buildPracticeQuiz(
  entries: PracticeEntry[],
  mode: QuizMode,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): QuizCard[] {
  return entries.map((e) => buildQuizCard(e.item, e.poolItems, mode, () => e.key, shuffle));
}
