import type { Topic, TopicSummary, VocabItemSummary } from "./types";

// Pure, dataset-parameterized "shared-character connections" logic, extracted so
// it can be unit-tested against topics.json without the "@/" path alias — mirrors
// search-logic.ts / data-logic.ts. data.ts binds it to the real dataset.
//
// Given the topic a learner is viewing, it finds — for each CJK character of each
// of that topic's words — the OTHER dataset words that also contain that
// character (茶 in 奶茶 links out to 绿茶, 茶几, 茶馆, …). This turns ten isolated
// words into a character network and doubles as an organic cross-topic discovery
// surface. Everything shown is drawn from the dataset; no content is invented.

/** Words shown per shared character are capped here; the uncapped count still
 *  powers the "+N more" note. Keeps a busy character (子 is in 67 words) from
 *  ballooning a single card. */
export const MAX_CONNECTIONS_PER_CHAR = 4;

export type ConnectedWord = {
  hanzi: string;
  pinyin: string;
  english: string;
  topicSlug: string;
  /** The connected word's home topic title (titleEn), for the "in {title}" link. */
  topicTitle: string;
  /** True when the connection lives in the same topic the learner is viewing. */
  sameTopic: boolean;
};

export type CharConnectionGroup = {
  /** The shared hanzi character. */
  char: string;
  /** Deduped by hanzi, cross-topic first, capped at MAX_CONNECTIONS_PER_CHAR. */
  words: ConnectedWord[];
  /** Uncapped, deduped connection count — powers the "+N more" overflow note. */
  totalCount: number;
};

// Every CJK ideograph, matched one code point at a time. Deliberately excludes
// CJK punctuation (，！？…) that appears in useful-phrases items, so punctuation
// never produces a bogus connection group.
const HANZI_CHAR = /[㐀-䶿一-鿿]/;

/** Distinct CJK ideographs in `text`, in order of first appearance. Drops
 *  punctuation, latin, and whitespace. */
export function hanziChars(text: string): string[] {
  const seen = new Set<string>();
  const chars: string[] = [];
  for (const ch of text) {
    if (!HANZI_CHAR.test(ch) || seen.has(ch)) continue;
    seen.add(ch);
    chars.push(ch);
  }
  return chars;
}

/**
 * For every item in `topic`, the character-connection groups to render on its
 * word card. For each of the item's CJK characters, collects every OTHER dataset
 * word containing that character — excluding words whose hanzi string is
 * identical (self, and true cross-topic duplicates like 奶茶 in both
 * ten-types-of-drinks and ten-types-of-tea, which are the same word, not a
 * connection). Candidates are gathered in dataset order, deduped by hanzi (first
 * occurrence wins), then stably ordered cross-topic before same-topic and capped
 * at MAX_CONNECTIONS_PER_CHAR while `totalCount` keeps the uncapped total.
 *
 * Characters with no other occurrences are omitted; words with no groups at all
 * are absent from the record. Keys are canonical `wordKey`s (`${slug}:${hanzi}`).
 *
 * `topics` accepts a TopicSummary-compatible shape (no `sentences` needed) so the
 * server page can build connections from either the full or slimmed dataset.
 */
export function topicCharConnections(
  topics: Pick<TopicSummary, "slug" | "titleEn" | "items">[],
  topic: Pick<Topic, "slug"> & { items: VocabItemSummary[] },
): Record<string, CharConnectionGroup[]> {
  // Index every dataset word under each of its characters, in dataset order.
  // `sameTopic` is resolved relative to the topic being viewed, which is fixed
  // for the lifetime of this call.
  const byChar = new Map<string, ConnectedWord[]>();
  for (const t of topics) {
    const sameTopic = t.slug === topic.slug;
    for (const it of t.items) {
      const entry: ConnectedWord = {
        hanzi: it.hanzi,
        pinyin: it.pinyin,
        english: it.english,
        topicSlug: t.slug,
        topicTitle: t.titleEn,
        sameTopic,
      };
      for (const char of hanziChars(it.hanzi)) {
        const bucket = byChar.get(char);
        if (bucket) bucket.push(entry);
        else byChar.set(char, [entry]);
      }
    }
  }

  const result: Record<string, CharConnectionGroup[]> = {};
  for (const item of topic.items) {
    const groups: CharConnectionGroup[] = [];
    for (const char of hanziChars(item.hanzi)) {
      const seen = new Set<string>();
      const connected: ConnectedWord[] = [];
      for (const candidate of byChar.get(char) ?? []) {
        // Identical-hanzi words are the same word, never a connection.
        if (candidate.hanzi === item.hanzi) continue;
        if (seen.has(candidate.hanzi)) continue;
        seen.add(candidate.hanzi);
        connected.push(candidate);
      }
      if (connected.length === 0) continue;
      // Array.prototype.sort is stable, so cross-topic and same-topic words each
      // keep their dataset order within their half.
      const ordered = [...connected].sort((a, b) => Number(a.sameTopic) - Number(b.sameTopic));
      groups.push({
        char,
        words: ordered.slice(0, MAX_CONNECTIONS_PER_CHAR),
        totalCount: connected.length,
      });
    }
    if (groups.length > 0) {
      result[`${topic.slug}:${item.hanzi}`] = groups;
    }
  }
  return result;
}
