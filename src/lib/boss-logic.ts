import type { VocabItem } from "./types";
import type { Tone } from "./pinyin";
import type { QuizCard } from "./quiz-logic";
import type { ClozeCard } from "./cloze-logic";
// Value imports carry the explicit `.ts` extension so they resolve under
// `node --test` (Node's native TS runner does not add extensions), while
// `next build` and tsc accept it via `allowImportingTsExtensions`. Mirrors
// cloze-logic.ts. The Boss Round composes the existing skill builders rather
// than inventing new question logic — recognition (quiz), context (cloze), ear
// (tone), production (typing) — so no new content is ever generated.
import { bareSyllables, tonesOf } from "./pinyin.ts";
import { buildQuizCard, defaultShuffle } from "./quiz-logic.ts";
import { buildClozeCard, clozeSentences } from "./cloze-logic.ts";

// Pure, DOM-free builder for the Topic Boss Round: a four-question capstone that
// pulls one question from each existing drill, each on a DIFFERENT word from the
// topic. Nothing here touches React, the DOM, storage, or a backend; the shuffle
// is injectable so the whole round is deterministic under test.

export const BOSS_STAGE_COUNT = 4;

// One stage of the gauntlet, discriminated by the skill it tests. `key` is the
// word's `wordKey` (`topic.slug:hanzi`) so each stage records through the same
// recordQuizAnswer path as its standalone drill.
export type BossStage =
  | { kind: "quiz"; key: string; card: QuizCard }
  | { kind: "cloze"; key: string; card: ClozeCard }
  | { kind: "tone"; key: string; item: VocabItem; tones: Tone[]; syllables: string[] }
  | { kind: "typing"; key: string; item: VocabItem };

export type BossRound = { stages: BossStage[] };

// A quiz stage over `item`, meaning-recognition (hanzi → English) like the Quiz
// tab, with distractors from `pool`.
function quizStage(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[],
): BossStage {
  const card = buildQuizCard(item, pool, "hanzi-english", keyFor, shuffle);
  return { kind: "quiz", key: card.key, card };
}

// A cloze stage over `item`, or — defensively, when `item` has no sentence
// containing its hanzi — a substitute quiz stage so the round always has four
// answerable stages. The dataset guarantees every item is cloze-eligible today.
function clozeStage(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[],
): BossStage {
  const card = buildClozeCard(item, pool, keyFor, shuffle);
  if (card === null) return quizStage(item, pool, keyFor, shuffle);
  return { kind: "cloze", key: card.key, card };
}

// A tone stage over `item`, or — defensively, when its pinyin yields no tones —
// a substitute quiz stage. Tones and per-syllable display labels are derived
// from the existing tone-marked pinyin (no hardcoded tone table).
function toneStage(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[],
): BossStage {
  const tones = tonesOf(item.pinyin);
  if (tones.length === 0) return quizStage(item, pool, keyFor, shuffle);
  return { kind: "tone", key: keyFor(item), item, tones, syllables: bareSyllables(item.pinyin, tones.length) };
}

// A typing stage over `item`: type its pinyin, graded by gradeTypedPinyin.
function typingStage(item: VocabItem, keyFor: (item: VocabItem) => string): BossStage {
  return { kind: "typing", key: keyFor(item), item };
}

/**
 * Build a four-stage boss round from `items` (a topic's words), with distractors
 * drawn from `pool` (usually the same topic). Each stage lands on a DISTINCT
 * word: the skills with eligibility constraints pick first from the shuffled
 * order — cloze (needs a sentence containing the hanzi), then tone (needs a
 * derivable tone sequence) — so they claim a word that works before the
 * unconstrained quiz and typing slots take what remains. The rendered stage order
 * is fixed for drama regardless of assignment order: quiz → cloze → tone → typing
 * (recognition → context → ear → production). `shuffle` is injectable so tests
 * pin the word choices with an identity shuffle. The dataset guarantees ≥4 words
 * per topic and full cloze/tone eligibility, so a real topic always yields four
 * distinct-word stages; a substitute quiz stage covers the defensive gap.
 */
export function buildBossRound(
  items: VocabItem[],
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): BossRound {
  const shuffled = shuffle(items);
  const used = new Set<string>();

  // Claim the next unused word matching `predicate` (falling back to any unused
  // word when nothing matches), so every stage gets a distinct word.
  function take(predicate: (item: VocabItem) => boolean): VocabItem | null {
    for (const item of shuffled) {
      const key = keyFor(item);
      if (used.has(key)) continue;
      if (predicate(item)) {
        used.add(key);
        return item;
      }
    }
    return null;
  }
  const takeAny = () => take(() => true);

  // Constrained skills first, each with an any-unused-word fallback (that slot
  // then renders as a substitute quiz stage inside its stage builder).
  const clozeItem = take((item) => clozeSentences(item).length > 0) ?? takeAny();
  const toneItem = take((item) => tonesOf(item.pinyin).length > 0) ?? takeAny();
  const quizItem = takeAny();
  const typingItem = takeAny();

  const stages: BossStage[] = [];
  if (quizItem) stages.push(quizStage(quizItem, pool, keyFor, shuffle));
  if (clozeItem) stages.push(clozeStage(clozeItem, pool, keyFor, shuffle));
  if (toneItem) stages.push(toneStage(toneItem, pool, keyFor, shuffle));
  if (typingItem) stages.push(typingStage(typingItem, keyFor));
  return { stages };
}
