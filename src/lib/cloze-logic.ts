import type { Sentence, VocabItem } from "./types";
// Explicit `.ts` extension so this runtime import resolves under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept it via `allowImportingTsExtensions`. Cloze reuses the quiz module's
// hanzi-answer distractor ranking so wrong choices are as tempting here as in
// the English → Hanzi quiz, with no duplicated scoring.
import { defaultShuffle, rankedDistractors } from "./quiz-logic.ts";

// Pure sentence-cloze helpers, kept DOM-free and injectable-shuffle so they can
// be unit-tested without React. A cloze question blanks a word's target hanzi
// out of one of its real example sentences and asks the learner to pick the
// right hanzi from four choices. The panel layers drill state on top; nothing
// here touches the DOM, localStorage, or a backend.
//
// Dataset guarantee (verified): every one of the dataset's example sentences
// contains its item's exact hanzi string, so `clozeSentences` is non-empty for
// real items. The helpers below still degrade gracefully (drop the card) if a
// future edit ever breaks that, so the mode can never render a broken question.

// Two full-width underscores — the visible gap the learner fills in.
export const CLOZE_BLANK = "＿＿";

export type ClozeCard = {
  /** Stable identity for the quizzed word, used to record answers. */
  key: string;
  /** The correct answer (and the word this card drills). */
  hanzi: string;
  pinyin: string;
  english: string;
  /** The original, un-blanked example sentence (shown/spoken after answering). */
  sentenceCn: string;
  /** English translation of the sentence, shown as a toggleable hint. */
  sentenceEn: string;
  /** The sentence with the target hanzi replaced by CLOZE_BLANK. */
  prompt: string;
  /** Four unique hanzi choices, including the answer, in display order. */
  choices: string[];
};

/**
 * `cn` with the FIRST occurrence of `hanzi` replaced by CLOZE_BLANK. Returns
 * null when the sentence does not contain the hanzi (defensive; the dataset
 * currently guarantees containment). Multi-character hanzi are matched whole,
 * and only the first occurrence is blanked — a repeated later occurrence is an
 * accepted hint, not something to over-engineer around.
 */
export function blankSentence(cn: string, hanzi: string): string | null {
  const idx = cn.indexOf(hanzi);
  if (idx === -1) return null;
  return cn.slice(0, idx) + CLOZE_BLANK + cn.slice(idx + hanzi.length);
}

/** The sentences of `item` usable for cloze (those containing its hanzi). */
export function clozeSentences(item: VocabItem): Sentence[] {
  return item.sentences.filter((s) => s.cn.includes(item.hanzi));
}

/**
 * Build one cloze card for `item`, drawing up to three hanzi distractors from
 * `pool` (usually the full topic). The example sentence is chosen via the
 * injected `shuffle` over the item's eligible sentences (`shuffle(eligible)[0]`)
 * so tests pin it with an identity shuffle and real runs vary. Returns null when
 * the item has no sentence containing its hanzi, so a broken question is dropped
 * rather than rendered.
 */
export function buildClozeCard(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): ClozeCard | null {
  const eligible = clozeSentences(item);
  if (eligible.length === 0) return null;
  const sentence = shuffle(eligible)[0];
  const prompt = blankSentence(sentence.cn, item.hanzi);
  // `clozeSentences` guarantees containment, so `prompt` is non-null here; the
  // guard keeps the types honest and the function total.
  if (prompt === null) return null;
  // Hanzi-answer distractors: the "english-hanzi" mode scores exactly this
  // (same character length, shared characters), which is right for cloze too.
  const distractors = rankedDistractors(item, pool, "english-hanzi", shuffle).slice(0, 3);
  return {
    key: keyFor(item),
    hanzi: item.hanzi,
    pinyin: item.pinyin,
    english: item.english,
    sentenceCn: sentence.cn,
    sentenceEn: sentence.en,
    prompt,
    choices: shuffle([item.hanzi, ...distractors]),
  };
}

/**
 * A deck of cloze cards over `items`, distractors drawn from `pool`. Items whose
 * sentences never contain their hanzi are silently dropped (see buildClozeCard),
 * so the deck can be shorter than `items` but never contains a broken card.
 */
export function buildClozeDeck(
  items: VocabItem[],
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): ClozeCard[] {
  const cards: ClozeCard[] = [];
  for (const item of items) {
    const card = buildClozeCard(item, pool, keyFor, shuffle);
    if (card !== null) cards.push(card);
  }
  return cards;
}
