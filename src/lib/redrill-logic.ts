import type { Topic, VocabItem } from "./types";
// Explicit `.ts` extensions so these runtime imports resolve under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept them via `allowImportingTsExtensions`. Mirrors practice-logic.ts /
// quiz-logic.ts.
import { buildQuizCard, defaultShuffle, type QuizCard } from "./quiz-logic.ts";
import { wordKey } from "./data-logic.ts";

// Pure helpers for the end-of-session re-drill: take the words a learner just
// missed (by wordKey) and resolve them back to real dataset items, then turn
// those into quiz cards. Everything here is dataset-parameterized and DOM-free so
// the resolution + deck-building can be unit-tested without React; the
// redrill-panel component layers the mini-quiz state on top.
//
// Deliberately scheduling-neutral: the drill records quiz accuracy (feeding the
// weak-words signal) but never touches SM-2 flashcard scheduling. This module
// only builds the deck — the panel routes answers through `recordQuizAnswer`,
// never `gradeWord`.

// A missed word resolved to its real dataset item plus the metadata the drill
// UI needs (topic label + a same-topic distractor pool).
export type RedrillEntry = {
  key: string; // wordKey (`topic.slug:hanzi`)
  item: VocabItem;
  topicSlug: string;
  topicTitle: string;
  poolItems: VocabItem[]; // the entry's full topic item list (distractor pool)
};

// Resolve `keys` (wordKeys) back to real dataset entries via a wordKey index of
// `topics`. Input key order is preserved; keys that no longer resolve (e.g. after
// a dataset edit) are silently dropped — the same policy resolveWeakItems uses.
// Each entry carries the owning topic's full item list as its distractor pool, so
// drill choices are always same-topic.
export function redrillEntries(topics: Topic[], keys: Iterable<string>): RedrillEntry[] {
  const byKey = new Map<string, { item: VocabItem; topic: Topic }>();
  for (const topic of topics) {
    for (const item of topic.items) {
      byKey.set(wordKey(topic, item), { item, topic });
    }
  }
  const entries: RedrillEntry[] = [];
  for (const key of keys) {
    const found = byKey.get(key);
    if (!found) continue; // unresolvable key — drop it
    entries.push({
      key,
      item: found.item,
      topicSlug: found.topic.slug,
      topicTitle: found.topic.titleEn,
      poolItems: found.topic.items,
    });
  }
  return entries;
}

// One QuizCard per entry in "hanzi-english" mode, drawing distractors from that
// entry's own topic items so choices are same-topic and unique. The card's key is
// the entry's wordKey, so answers persist against the exact word being drilled.
// Identical shape to buildPracticeQuiz.
export function buildRedrillDeck(
  entries: RedrillEntry[],
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): QuizCard[] {
  return entries.map((e) => buildQuizCard(e.item, e.poolItems, "hanzi-english", () => e.key, shuffle));
}
