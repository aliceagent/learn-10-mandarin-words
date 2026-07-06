import type { Sentence, VocabItem } from "./types";
// Explicit `.ts` extension so this runtime import resolves under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept it via `allowImportingTsExtensions`. Sentence listening reuses the quiz
// module's English-answer distractor ranking so the wrong translations are as
// tempting here as in the hanzi → English quiz, with no duplicated scoring.
import { defaultShuffle, rankedDistractors, type QuizWord } from "./quiz-logic.ts";

// Pure sentence-listening helpers, kept DOM-free and injectable-shuffle so they
// can be unit-tested without React. A listening card speaks one of a word's real
// example sentences (via TTS in the panel) and asks the learner to pick the
// sentence's English translation from four choices. The panel layers drill state
// and the actual speech on top; nothing here touches the DOM, localStorage, or a
// backend.
//
// Dataset guarantee (verified): every topic ships 10 items × 2 sentences with
// unique English strings, so each card always has 19+ distractor candidates. The
// helpers still degrade gracefully (drop the card) if a future edit ever breaks
// that, so the mode can never render a broken question.

/** Absolute utterance rate for the post-answer "Play slower 🐢" replay — slow
 *  enough to expose word boundaries and tones in a full sentence, yet above the
 *  ~0.5 floor where many engines sound glitchy. Passed to `speak`'s `rate`
 *  option; kept strictly below SPEECH_RATE (0.85) so "slower" really is slower. */
export const SLOW_SPEECH_RATE = 0.65;

export type SentenceListenCard = {
  /** wordKey (`topic.slug:hanzi`) — identity for recordQuizAnswer. */
  key: string;
  /** The drilled word (revealed after answering). */
  hanzi: string;
  pinyin: string;
  english: string;
  /** The spoken sentence — NEVER rendered before the learner answers. */
  sentenceCn: string;
  /** Correct choice: the sentence's English translation. */
  answer: string;
  /** Four unique English translations, answer included, in display order. */
  choices: string[];
};

/** Adapt a `Sentence` to the structural `QuizWord` the distractor ranker reads:
 *  the sentence's `cn`/`en` stand in for hanzi/english (pinyin is unused for the
 *  "listening" mode, which scores on the English field only). This is why we can
 *  reuse `rankedDistractors` verbatim without touching quiz-logic.ts. */
function sentenceAsWord(sentence: Sentence): QuizWord {
  return { hanzi: sentence.cn, pinyin: "", english: sentence.en };
}

/** Every sentence across `pool`'s items, excluding the played one (matched by
 *  `cn`), as the candidate set for English distractors. */
export function sentencePool(pool: VocabItem[], exceptCn: string): Sentence[] {
  return pool.flatMap((item) => item.sentences).filter((s) => s.cn !== exceptCn);
}

/**
 * Build one listening card for `item`. The spoken sentence is chosen via the
 * injected `shuffle` over the item's sentences (`shuffle(item.sentences)[0]`) so
 * tests pin it with an identity shuffle and real runs vary. English distractors
 * are drawn from every OTHER sentence in `pool` and ranked by the quiz module's
 * English-answer similarity (its dedupe also strips the answer's own value and
 * any duplicate translations). Returns null when the item has no sentences or
 * fewer than three distractors survive, so a broken card is dropped rather than
 * rendered (defensive; real data always yields 19+ candidates).
 */
export function buildSentenceListenCard(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): SentenceListenCard | null {
  if (item.sentences.length === 0) return null;
  const sentence = shuffle(item.sentences)[0];
  const target = sentenceAsWord(sentence);
  const candidates = sentencePool(pool, sentence.cn).map(sentenceAsWord);
  const distractors = rankedDistractors(target, candidates, "listening", shuffle).slice(0, 3);
  if (distractors.length < 3) return null;
  return {
    key: keyFor(item),
    hanzi: item.hanzi,
    pinyin: item.pinyin,
    english: item.english,
    sentenceCn: sentence.cn,
    answer: sentence.en,
    choices: shuffle([sentence.en, ...distractors]),
  };
}

/**
 * A deck of listening cards over `items`, distractors drawn from `pool`. Items
 * with no sentences (or too few distractors) are silently dropped (see
 * buildSentenceListenCard), so the deck can be shorter than `items` but never
 * contains a broken card.
 */
export function buildSentenceListenDeck(
  items: VocabItem[],
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): SentenceListenCard[] {
  const cards: SentenceListenCard[] = [];
  for (const item of items) {
    const card = buildSentenceListenCard(item, pool, keyFor, shuffle);
    if (card !== null) cards.push(card);
  }
  return cards;
}
