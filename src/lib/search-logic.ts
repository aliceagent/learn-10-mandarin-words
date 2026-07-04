import type { TopicSummary } from "./types";
import { normalizePinyin } from "./highlight.ts";

// Pure, dataset-parameterized word search, extracted so it can be unit-tested
// against topics.json without the "@/" path alias — mirrors data-logic.ts.
//
// Matching reuses `normalizePinyin` from highlight.ts, the SAME normalizer the
// home topic filter and the highlighter use, so search results and highlighted
// spans stay in lockstep (the historical drift risk called out in home-app.tsx).
// Because the home topic haystack includes every item's hanzi/pinyin/english,
// any word this returns implies its topic also matches the home filter — the
// word section can never appear beside the "No topics found" empty state.

export type WordSearchResult = {
  hanzi: string;
  pinyin: string;
  english: string;
  /** Canonical wordKey: `${topicSlug}:${hanzi}` — matches wordKey in data-logic. */
  key: string;
  topicSlug: string;
  topicTitle: string;
  category: string;
  categorySlug: string;
  /** Lower = better. 0 exact hanzi, 1 hanzi contains, 2 pinyin prefix, 3 pinyin contains, 4 english contains. */
  rank: number;
};

// The best (lowest) rank a normalized query earns against one word, or null when
// nothing matches. Fields are checked in priority order so each word gets its
// strongest match; hanzi beats pinyin beats English.
function rankMatch(
  nHanzi: string,
  nPinyin: string,
  nEnglish: string,
  q: string,
): number | null {
  if (nHanzi === q) return 0;
  if (nHanzi.includes(q)) return 1;
  if (nPinyin.startsWith(q)) return 2;
  if (nPinyin.includes(q)) return 3;
  if (nEnglish.includes(q)) return 4;
  return null;
}

/**
 * Diacritic-tolerant word search across all topics. Empty/whitespace query → [].
 * Results are sorted by rank, then stable dataset order within a rank, and
 * deduped by `key`. When `opts.categorySlug` is supplied, only words from topics
 * in that category are considered.
 */
export function searchWords(
  topics: TopicSummary[],
  query: string,
  opts?: { categorySlug?: string },
): WordSearchResult[] {
  const q = normalizePinyin(query.trim());
  if (!q) return [];

  const categorySlug = opts?.categorySlug;
  const seen = new Set<string>();
  const results: WordSearchResult[] = [];

  for (const topic of topics) {
    if (categorySlug && topic.categorySlug !== categorySlug) continue;
    for (const item of topic.items) {
      const rank = rankMatch(
        normalizePinyin(item.hanzi),
        normalizePinyin(item.pinyin),
        normalizePinyin(item.english),
        q,
      );
      if (rank === null) continue;
      const key = `${topic.slug}:${item.hanzi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        hanzi: item.hanzi,
        pinyin: item.pinyin,
        english: item.english,
        key,
        topicSlug: topic.slug,
        topicTitle: topic.titleEn,
        category: topic.category,
        categorySlug: topic.categorySlug,
        rank,
      });
    }
  }

  // Array.prototype.sort is stable, so equal-rank results keep their dataset
  // insertion order — no secondary sort key needed.
  return results.sort((a, b) => a.rank - b.rank);
}
