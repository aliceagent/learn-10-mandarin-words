// Pure, DOM-free logic for the audio-first "Listening tone trainer" (Fable
// Sprint 8). The inverse of the visual `TonePractice` drill: the app speaks a
// word and the learner picks its whole tone pattern (e.g. `ˇ ˉ` = 3-1) in one
// tap. Tones are ALWAYS derived from the existing tone-marked pinyin via
// `tonesOf` — there is no hardcoded per-word tone table.
//
// House style mirrors quiz-logic.ts / listen-logic.ts: everything here is a pure
// function of its inputs (no DOM, no storage, no randomness beyond the injectable
// `shuffle`) so the round/distractor/label rules are unit-testable under
// `node --test`. Explicit `.ts` import extensions are required for the Node test
// runner (accepted by tsc/next via `allowImportingTsExtensions`).
import { tonesOf, type Tone } from "./pinyin.ts";
import { defaultShuffle } from "./quiz-logic.ts";
import type { Topic, VocabItem } from "./types";

/** A tone pattern is one tone (1–5) per syllable, aligned to the hanzi. */
export type TonePattern = Tone[];

export type ToneRound = {
  /** wordKey(topic, item) — the quizStats / daily-goal identity. */
  key: string;
  hanzi: string;
  /** Tone-marked pinyin, revealed only after the learner answers. */
  pinyin: string;
  english: string;
  answer: TonePattern;
  /** 2–4 unique patterns including the answer, pre-shuffled. */
  options: TonePattern[];
};

/** Diacritic glyph per tone, matching the vocabulary used in tone-practice.tsx. */
export const TONE_GLYPHS: Record<Tone, string> = {
  1: "ˉ",
  2: "ˊ",
  3: "ˇ",
  4: "ˋ",
  5: "·",
};

const ALL_TONES: Tone[] = [1, 2, 3, 4, 5];

/** Stable string identity for a pattern: `[4,5,3]` → `"4-5-3"`. Used to dedupe. */
export function patternKey(pattern: TonePattern): string {
  return pattern.join("-");
}

/** Diacritic glyphs for a pattern: `[4,5,3]` → `"ˋ · ˇ"`. */
export function patternGlyphs(pattern: TonePattern): string {
  return pattern.map((tone) => TONE_GLYPHS[tone]).join(" ");
}

/** Screen-reader label: `[4,5,3]` → `"tone 4, neutral tone, tone 3"`. */
export function patternAriaLabel(pattern: TonePattern): string {
  return pattern.map((tone) => (tone === 5 ? "neutral tone" : `tone ${tone}`)).join(", ");
}

/**
 * Every pattern that differs from `answer` in exactly one syllable's tone (that
 * position cycles through the four other tones). These candidate distractors
 * always exist — even for a 1-syllable word — and never equal the answer. No
 * duplicates: a given (position, tone) pair yields a distinct pattern.
 */
export function mutatedPatterns(answer: TonePattern): TonePattern[] {
  const out: TonePattern[] = [];
  for (let i = 0; i < answer.length; i++) {
    for (const tone of ALL_TONES) {
      if (tone === answer[i]) continue;
      const mutated = [...answer];
      mutated[i] = tone;
      out.push(mutated);
    }
  }
  return out;
}

/** True when two 3rd tones sit next to each other (powers the tone-sandhi hint). */
export function hasThirdTonePair(pattern: TonePattern): boolean {
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i] === 3 && pattern[i - 1] === 3) return true;
  }
  return false;
}

/** Fun streak copy at milestone thresholds; `null` otherwise. */
export function streakLabel(streak: number): string | null {
  switch (streak) {
    case 3:
      return "3 in a row — your ear is waking up!";
    case 5:
      return "5 straight — golden ear! ✨";
    case 10:
      return "10 straight — tone master! 🐉";
    default:
      return null;
  }
}

/**
 * Build one round for `item`, drawing tempting distractors from `pool`.
 *
 * The answer is `tonesOf(item.pinyin)`; distractors prefer the *real* tone
 * patterns of other pool words with the same syllable count (the most tempting,
 * because they're patterns the learner has actually met), then top up from
 * `mutatedPatterns`. All options are deduped by `patternKey`, capped at three
 * distractors, then the answer is shuffled in among them.
 *
 * Returns `null` when the pinyin yields no tones (defensive — the dataset never
 * hits this).
 */
export function buildToneRound(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): ToneRound | null {
  const answer = tonesOf(item.pinyin);
  if (answer.length === 0) return null;

  // `seen` starts with the answer so its own pattern (and any pool word sharing
  // it) is never re-added as a distractor.
  const seen = new Set<string>([patternKey(answer)]);
  const distractors: TonePattern[] = [];

  // Real same-length patterns from the rest of the pool, most-tempting first.
  const poolPatterns = shuffle(
    pool.map((other) => tonesOf(other.pinyin)).filter((tones) => tones.length === answer.length),
  );
  for (const pattern of poolPatterns) {
    if (distractors.length >= 3) break;
    const key = patternKey(pattern);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(pattern);
  }

  // Top up from single-syllable mutations, which always exist.
  const mutations = shuffle(mutatedPatterns(answer));
  for (const pattern of mutations) {
    if (distractors.length >= 3) break;
    const key = patternKey(pattern);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(pattern);
  }

  return {
    key: keyFor(item),
    hanzi: item.hanzi,
    pinyin: item.pinyin,
    english: item.english,
    answer,
    options: shuffle([answer, ...distractors]),
  };
}

/**
 * One round per topic word whose tones are derivable, in a session-shuffled
 * order. Distractors for each round are drawn from the whole topic word list.
 */
export function buildToneRounds(
  topic: Topic,
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): ToneRound[] {
  const rounds: ToneRound[] = [];
  for (const item of shuffle(topic.items)) {
    const round = buildToneRound(item, topic.items, keyFor, shuffle);
    if (round) rounds.push(round);
  }
  return rounds;
}
