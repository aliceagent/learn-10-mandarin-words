// Pure, DOM-free logic for the "Tone Twins" minimal-pair drill (Fable Sprint 2).
// The app speaks a real dataset word and the learner picks which of two (or
// three) real words they heard — words that share the exact tone-stripped pinyin
// base and differ ONLY by tone (书 shū *book* vs 树 shù *tree*). Every option is
// drawn from `src/data/topics.json`; no vocabulary is invented.
//
// House style mirrors tone-trainer-logic.ts / quiz-logic.ts: everything here is a
// pure function of its inputs (no DOM, no storage, no randomness beyond the
// injectable `shuffle`) so the pairing/session rules are unit-testable under
// `node --test`. Explicit `.ts` import extensions are required for the Node test
// runner (accepted by tsc/next via `allowImportingTsExtensions`). Tones are
// ALWAYS derived from the tone-marked pinyin via `tonesOf` — no per-word table.
import { stripToneMarks, tonesOf, type Tone } from "./pinyin.ts";
import { patternKey } from "./tone-trainer-logic.ts";
import { defaultShuffle } from "./quiz-logic.ts";
import { wordKey } from "./data-logic.ts";
import type { Topic } from "./types";

/** Default number of rounds per session — small and on-brand (ten words). */
export const TONE_PAIRS_SESSION_SIZE = 10;

/** One real dataset word that participates in a tone-only minimal pair. */
export type TonePairWord = {
  /** wordKey(topic, item) = `${topicSlug}:${hanzi}` — the quizStats identity. */
  key: string;
  hanzi: string;
  /** Tone-marked pinyin, straight from the dataset. */
  pinyin: string;
  english: string;
  /** tonesOf(pinyin) — derived, never stored. */
  tones: Tone[];
  topicSlug: string;
  topicTitle: string;
};

/** A group of ≥2 words sharing a tone-stripped base but differing by tone. */
export type TonePairGroup = { base: string; words: TonePairWord[] };

/** One drill round: a spoken target plus the whole (shuffled) group to pick from. */
export type TonePairRound = {
  base: string;
  /** The word spoken aloud — the learner must identify it. */
  target: TonePairWord;
  /** The whole group, shuffled (2–3 cards); always includes `target`. */
  options: TonePairWord[];
};

/**
 * The tone-stripped, separator-free, lowercased base used to bucket words into
 * minimal pairs. `stripToneMarks` preserves ü (so lǘ ≠ lu), and stripping the
 * syllable separators (`/[\s\-·'’]+/g`) makes multi-word pinyin like `qì chē`
 * group robustly with `qíchē`. Case-folded so labels compare consistently.
 */
export function pairBase(pinyin: string): string {
  return stripToneMarks(pinyin).replace(/[\s\-·'’]+/g, "").toLowerCase();
}

/**
 * Walk every topic/word, bucket by `pairBase`, and keep only genuine tone-only
 * minimal-pair groups. Rules, in order:
 *   • dedupe by hanzi within a bucket (first occurrence wins), so a word that
 *     appears in two topics counts once;
 *   • keep a bucket only if it has ≥2 members whose tone patterns
 *     (`patternKey(tones)`) are pairwise-distinct AND whose lowercased English
 *     labels are pairwise-distinct — the latter kills 星星/星形 (both "star"),
 *     where a reveal would be ambiguous;
 *   • the ü/u distinction falls out of `stripToneMarks` preserving ü, so
 *     lǘ (donkey) and lù (deer) never share a base.
 * Groups are returned sorted by `base` for deterministic sessions/tests.
 */
export function buildTonePairGroups(topics: Topic[]): TonePairGroup[] {
  const buckets = new Map<string, TonePairWord[]>();

  for (const topic of topics) {
    for (const item of topic.items) {
      const base = pairBase(item.pinyin);
      if (!base) continue;
      let members = buckets.get(base);
      if (!members) {
        members = [];
        buckets.set(base, members);
      }
      // Dedupe by hanzi — the same word can live in multiple topics.
      if (members.some((word) => word.hanzi === item.hanzi)) continue;
      members.push({
        key: wordKey(topic, item),
        hanzi: item.hanzi,
        pinyin: item.pinyin,
        english: item.english,
        tones: tonesOf(item.pinyin),
        topicSlug: topic.slug,
        topicTitle: topic.titleEn,
      });
    }
  }

  const groups: TonePairGroup[] = [];
  for (const [base, members] of buckets) {
    // Require pairwise-distinct tone patterns AND English glosses across the
    // kept members. Build the survivors greedily so a third same-tone or
    // same-gloss homophone is dropped rather than poisoning the group.
    const seenPattern = new Set<string>();
    const seenEnglish = new Set<string>();
    const patternCounts = new Map<string, number>();
    const englishCounts = new Map<string, number>();
    for (const word of members) {
      patternCounts.set(patternKey(word.tones), (patternCounts.get(patternKey(word.tones)) ?? 0) + 1);
      const eng = word.english.toLowerCase();
      englishCounts.set(eng, (englishCounts.get(eng) ?? 0) + 1);
    }
    const kept: TonePairWord[] = [];
    for (const word of members) {
      const pk = patternKey(word.tones);
      const eng = word.english.toLowerCase();
      // Skip a member whose tone pattern or gloss collides with another member:
      // it can't form an unambiguous tone-only contrast.
      if ((patternCounts.get(pk) ?? 0) > 1) continue;
      if ((englishCounts.get(eng) ?? 0) > 1) continue;
      if (seenPattern.has(pk) || seenEnglish.has(eng)) continue;
      seenPattern.add(pk);
      seenEnglish.add(eng);
      kept.push(word);
    }
    if (kept.length >= 2) groups.push({ base, words: kept });
  }

  groups.sort((a, b) => (a.base < b.base ? -1 : a.base > b.base ? 1 : 0));
  return groups;
}

/**
 * Build a session of up to `limit` rounds. Groups are shuffled and capped; for
 * each surviving group the spoken `target` is the first element of the shuffled
 * members and `options` is the whole group shuffled (so which twin is spoken
 * varies run-to-run). Injectable `shuffle` keeps it testable.
 */
export function buildTonePairSession(
  groups: TonePairGroup[],
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
  limit: number = TONE_PAIRS_SESSION_SIZE,
): TonePairRound[] {
  const chosen = shuffle(groups).slice(0, Math.max(0, limit));
  return chosen.map((group) => {
    const options = shuffle(group.words);
    return { base: group.base, target: options[0], options };
  });
}

/** Summary copy keyed off the final score. */
export function resultMessage(score: number, total: number): string {
  if (total > 0 && score === total) return "Perfect — no tone can fool you.";
  if (total > 0 && score / total >= 0.8) return "Sharp ears — one more run makes it stick.";
  return "Tone twins are tricky — replay and listen for the pitch shape.";
}
