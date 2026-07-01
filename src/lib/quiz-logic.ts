import type { VocabItem } from "./types";

// Pure quiz helpers, extracted from topic-app.tsx so the quiz-building and
// missed-word logic can be unit-tested without React or the DOM. The component
// imports these and layers component state (current index, score, picked
// choice) on top. Nothing here touches the DOM, localStorage, or a backend.

export type QuizMode = "hanzi-english" | "english-hanzi" | "hanzi-pinyin";

export type QuizCard = {
  /** Stable identity for the quizzed word, used to collect missed items. */
  key: string;
  prompt: string;
  promptPinyin?: string;
  answer: string;
  choices: string[];
};

// Which VocabItem field supplies the answer (and therefore the distractors) for
// a given mode. The prompt/pinyin shown are derived separately below.
const ANSWER_FIELD: Record<QuizMode, "english" | "hanzi" | "pinyin"> = {
  "hanzi-english": "english",
  "english-hanzi": "hanzi",
  "hanzi-pinyin": "pinyin",
};

// Default shuffle: a small Fisher–Yates-ish sort. Injectable so tests can pass a
// deterministic (e.g. identity) shuffle and assert on card contents.
export function defaultShuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

// Build one quiz card for `item`, drawing up to three distractors from `pool`
// (the full topic word list) so a retry over a single missed word still gets a
// full set of choices. `keyFor` produces the card's stable identity.
export function buildQuizCard(
  item: VocabItem,
  pool: VocabItem[],
  mode: QuizMode,
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): QuizCard {
  const field = ANSWER_FIELD[mode];
  const answer = item[field];
  const distractors = shuffle(pool.filter((o) => o[field] !== answer))
    .slice(0, 3)
    .map((o) => o[field]);
  return {
    key: keyFor(item),
    prompt: mode === "english-hanzi" ? item.english : item.hanzi,
    promptPinyin: mode === "hanzi-english" ? item.pinyin : undefined,
    answer,
    choices: shuffle([answer, ...distractors]),
  };
}

// Build a quiz over `items` (the words currently being asked), with distractors
// drawn from `pool` (usually the whole topic). On a normal run `items === pool`;
// on a "retry missed" run `items` is the missed subset while `pool` stays the
// full topic so choices remain plausible.
export function buildQuiz(
  items: VocabItem[],
  pool: VocabItem[],
  mode: QuizMode,
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): QuizCard[] {
  return items.map((item) => buildQuizCard(item, pool, mode, keyFor, shuffle));
}

// Return the subset of `items` whose key is in `keys`, preserving `items` order.
// Used to rebuild the quiz from the words the learner missed.
export function itemsForKeys(
  items: VocabItem[],
  keyFor: (item: VocabItem) => string,
  keys: Iterable<string>,
): VocabItem[] {
  const set = new Set(keys);
  return items.filter((item) => set.has(keyFor(item)));
}
