import type { VocabItem } from "./types";
// Explicit `.ts` extension so this runtime import resolves under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept it via `allowImportingTsExtensions`. The pinyin helpers power the
// tone-aware distractor ranking below.
import { stripToneMarks, tonesOf } from "./pinyin.ts";

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

// ─── Distractor similarity scoring ─────────────────────────────────────────────
// Pure heuristics that rank candidate distractors by how *tempting* (i.e. close
// to the correct answer) they are, so the wrong choices aren't trivially random.
// Nothing here touches the DOM, storage, or randomness — scores are a pure
// function of the two words, and ties are broken by the injected shuffle in
// `rankedDistractors`.

// Split a string into its code points (so multi-byte hanzi count as one char).
function codePoints(s: string): string[] {
  return [...s];
}

// Character bigrams of a (lowercased) string, used for Dice similarity.
function bigrams(s: string): string[] {
  const chars = codePoints(s.toLowerCase());
  const grams: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) grams.push(chars[i] + chars[i + 1]);
  return grams;
}

// Sørensen–Dice similarity over character bigrams, in [0, 1]. Case-insensitive.
// Strings too short for bigrams fall back to plain equality.
function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.length === 0 || gb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const g of ga) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of gb) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      overlap += 1;
      counts.set(g, c - 1);
    }
  }
  return (2 * overlap) / (ga.length + gb.length);
}

// Size of the multiset intersection of the characters of `a` and `b`.
function sharedCharCount(a: string, b: string): number {
  const counts = new Map<string, number>();
  for (const ch of codePoints(a)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let shared = 0;
  for (const ch of codePoints(b)) {
    const c = counts.get(ch) ?? 0;
    if (c > 0) {
      shared += 1;
      counts.set(ch, c - 1);
    }
  }
  return shared;
}

// Size of the multiset intersection of two tone sequences (order-independent).
function sharedToneCount(a: number[], b: number[]): number {
  const counts = new Map<number, number>();
  for (const t of a) counts.set(t, (counts.get(t) ?? 0) + 1);
  let shared = 0;
  for (const t of b) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      shared += 1;
      counts.set(t, c - 1);
    }
  }
  return shared;
}

function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? "";
}

// Higher score → `candidate` is a more tempting distractor for `target` in the
// given mode. Purely a function of the two words.
function distractorScore(candidate: VocabItem, target: VocabItem, mode: QuizMode): number {
  switch (mode) {
    // Answer is pinyin: prefer tone-stripped pinyin that looks/sounds alike and
    // shares the same syllable count and tones.
    case "hanzi-pinyin": {
      const sim = diceSimilarity(stripToneMarks(candidate.pinyin), stripToneMarks(target.pinyin));
      const candTones = tonesOf(candidate.pinyin);
      const targetTones = tonesOf(target.pinyin);
      const sameSyllableCount = candTones.length === targetTones.length ? 1 : 0;
      const sharedTones = sharedToneCount(candTones, targetTones);
      return sim * 3 + sameSyllableCount + sharedTones * 0.25;
    }
    // Answer is hanzi: prefer the same character length and shared characters.
    case "english-hanzi": {
      const sameLength =
        codePoints(candidate.hanzi).length === codePoints(target.hanzi).length ? 1 : 0;
      const shared = sharedCharCount(candidate.hanzi, target.hanzi);
      return shared * 2 + sameLength;
    }
    // Answer is English: prefer similar overall length and a similar first word.
    case "hanzi-english": {
      const sim = diceSimilarity(candidate.english, target.english);
      const lenDiff = Math.abs(
        codePoints(candidate.english).length - codePoints(target.english).length,
      );
      const lenScore = 1 / (1 + lenDiff);
      const firstWordSim = diceSimilarity(firstWord(candidate.english), firstWord(target.english));
      return sim * 2 + firstWordSim + lenScore;
    }
  }
}

// Drop items whose answer-field value repeats (or equals `exclude`), keeping the
// first occurrence. This is what stops two words with the same English label —
// or the answer itself — from both appearing as choices.
function dedupeByField(
  items: VocabItem[],
  field: "english" | "hanzi" | "pinyin",
  exclude: string,
): VocabItem[] {
  const seen = new Set<string>([exclude]);
  const out: VocabItem[] = [];
  for (const item of items) {
    const value = item[field];
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(item);
  }
  return out;
}

// Ranked, de-duplicated distractor answer-values for `item`, drawn from `pool`,
// most-tempting first. The answer itself and any duplicate answer-values are
// removed first; the injected `shuffle` runs BEFORE the (stable) similarity sort
// so equally-similar candidates appear in a varied — but, under a deterministic
// injected shuffle, reproducible — order. Callers slice however many they need,
// so a tiny pool simply yields fewer distractors.
export function rankedDistractors(
  item: VocabItem,
  pool: VocabItem[],
  mode: QuizMode,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): string[] {
  const field = ANSWER_FIELD[mode];
  const answer = item[field];
  const candidates = shuffle(dedupeByField(pool, field, answer));
  const ranked = [...candidates].sort(
    (a, b) => distractorScore(b, item, mode) - distractorScore(a, item, mode),
  );
  return ranked.map((o) => o[field]);
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
  // Pick the three most-tempting distractors (fewer if the pool is tiny), then
  // shuffle the answer in among them. Because distractors are de-duplicated by
  // answer-value and never equal the answer, the four choices are always unique.
  const distractors = rankedDistractors(item, pool, mode, shuffle).slice(0, 3);
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
