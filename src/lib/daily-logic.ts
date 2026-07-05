import type { ProgressState, Topic, VocabItem } from "./types";
// Explicit `.ts` extensions so these runtime imports resolve under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept them via `allowImportingTsExtensions`. Mirrors quiz-logic.ts /
// practice-logic.ts.
import { buildQuizCard, type QuizCard, type QuizMode } from "./quiz-logic.ts";
import { recommendedPath, wordKey } from "./data-logic.ts";

// Pure, DOM-free logic for the Daily Challenge (Sprint 1): a deterministic,
// same-for-everyone-with-the-same-topics 10-question quiz seeded from today's
// UTC date. Nothing here touches the DOM, localStorage, randomness (beyond the
// seeded PRNG below), or a backend — the whole deck is a pure function of
// `(day, studied-topic set)`, so two builds in one day are byte-for-byte equal
// and the logic is fully unit-testable without React.

// Ten questions per challenge — small enough to finish in a sitting, large
// enough to mix all three visual modes.
export const DAILY_CHALLENGE_SIZE = 10;

// The three visual quiz modes the daily mix cycles through. Listening is
// deliberately excluded: speech availability is per-device and post-hydration,
// which would break the cross-device determinism contract (see the sprint plan).
export const DAILY_MODES: QuizMode[] = ["hanzi-english", "english-hanzi", "hanzi-pinyin"];

// A single daily-challenge question: a ready-to-answer quiz card (whose `key` is
// the wordKey, so it flows straight into recordQuizAnswer), the mode it's asked
// in, the originating topic, and the resolved item so the reveal line can always
// show hanzi + pinyin + english regardless of mode.
export type DailyQuestion = {
  card: QuizCard; // card.key is the wordKey → recordQuizAnswer-ready
  mode: QuizMode;
  topicSlug: string;
  topicTitle: string;
  item: VocabItem;
};

// The subset of ProgressState the daily builder reads. Kept structural so the
// helpers stay dataset-parameterized and easy to fixture in tests.
type DailyProgress = Pick<ProgressState, "learnedTopics" | "flashcardStats" | "quizStats">;

// ─── Seeded randomness ─────────────────────────────────────────────────────────

// FNV-1a hash of the "YYYY-MM-DD" day string → uint32. Deterministic per day and
// well-mixed across adjacent days, so consecutive dates yield unrelated decks.
export function dateSeed(day: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < day.length; i++) {
    hash ^= day.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}

// Standard mulberry32 PRNG: from a uint32 seed, returns a function producing the
// next float in [0, 1). Small, fast, and stable across engines — the single
// source of randomness for a challenge build.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A Fisher–Yates shuffle driven by `rng`, shaped exactly like the injectable
// `shuffle` that quiz-logic's buildQuizCard expects. Every call advances the
// shared `rng`, so the overall build stays deterministic as long as the sequence
// of shuffle calls is fixed (it is — the pool is sorted by wordKey first).
export function seededShuffle(rng: () => number): <T>(items: T[]) => T[] {
  return function <T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };
}

// ─── Studied-topic selection ───────────────────────────────────────────────────

// The set of topic slugs the learner has "studied": topics marked learned, plus
// the topic slug parsed from every flashcard/quiz stat key (a wordKey of shape
// `slug:hanzi`, split on the first ":"). This is what scopes the daily pool to
// vocabulary the learner has actually touched.
export function studiedTopicSlugs(progress: DailyProgress): Set<string> {
  const slugs = new Set<string>(progress.learnedTopics ?? []);
  for (const key of Object.keys(progress.flashcardStats ?? {})) {
    slugs.add(key.split(":")[0]);
  }
  for (const key of Object.keys(progress.quizStats ?? {})) {
    slugs.add(key.split(":")[0]);
  }
  return slugs;
}

// Total word count across `topics`.
function totalWords(topics: Topic[]): number {
  return topics.reduce((sum, topic) => sum + topic.items.length, 0);
}

// True when the studied pool is too small to fill a challenge, so the deck falls
// back to the curated starter path. Drives the "you're new here" subline copy.
export function usesStarterFallback(topics: Topic[], progress: DailyProgress): boolean {
  const studied = studiedTopicSlugs(progress);
  const studiedTopics = topics.filter((topic) => studied.has(topic.slug));
  return totalWords(studiedTopics) < DAILY_CHALLENGE_SIZE;
}

// The topics the daily challenge draws from: the learner's studied topics, or —
// if those hold fewer than DAILY_CHALLENGE_SIZE words — the curated starter path
// so a brand-new learner still gets a full, shared deck.
export function dailyChallengeTopics(topics: Topic[], progress: DailyProgress): Topic[] {
  if (usesStarterFallback(topics, progress)) return recommendedPath(topics);
  const studied = studiedTopicSlugs(progress);
  return topics.filter((topic) => studied.has(topic.slug));
}

// ─── Challenge builder ─────────────────────────────────────────────────────────

// Build today's deterministic 10-question challenge. One RNG is seeded from the
// day; the pool of (topic, item) pairs is sorted by wordKey FIRST so topic/array
// iteration order can't affect the result, then seeded-shuffled and truncated to
// DAILY_CHALLENGE_SIZE. Modes cycle through a seeded-shuffled copy of DAILY_MODES
// so every run mixes all three. Each card draws its distractors from its own
// topic's items via the same seeded shuffle, keeping choices same-topic and the
// whole build reproducible.
export function buildDailyChallenge(
  topics: Topic[],
  progress: DailyProgress,
  day: string,
): DailyQuestion[] {
  const rng = mulberry32(dateSeed(day));
  const shuffle = seededShuffle(rng);

  const pool = dailyChallengeTopics(topics, progress);

  // Flatten to (topic, item) pairs and sort by wordKey for iteration-order
  // independence. wordKeys are unique across the dataset, so no dedupe is needed.
  const pairs = pool
    .flatMap((topic) => topic.items.map((item) => ({ topic, item, key: wordKey(topic, item) })))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const chosen = shuffle(pairs).slice(0, DAILY_CHALLENGE_SIZE);

  // A seeded-shuffled mode order, cycled so all three modes appear in a 10-card
  // deck (10 / 3 → each mode used at least three times).
  const modeOrder = shuffle(DAILY_MODES);

  return chosen.map((pair, i) => {
    const mode = modeOrder[i % modeOrder.length];
    const card = buildQuizCard(pair.item, pair.topic.items, mode, () => pair.key, shuffle);
    return {
      card,
      mode,
      topicSlug: pair.topic.slug,
      topicTitle: pair.topic.titleEn,
      item: pair.item,
    };
  });
}

// ─── Share text ────────────────────────────────────────────────────────────────

// Emoji for a single answer outcome: green for correct, red for wrong.
const CORRECT_EMOJI = "🟩";
const WRONG_EMOJI = "🟥";

// The emoji strip for a run's outcomes, e.g. "🟩🟩🟥🟩…".
export function outcomeStrip(outcomes: boolean[]): string {
  return outcomes.map((ok) => (ok ? CORRECT_EMOJI : WRONG_EMOJI)).join("");
}

// A Wordle-style, plain-text share block for a completed challenge. No URLs are
// invented — just the day, the score, the emoji strip, and the site name. No
// trailing whitespace.
export function shareText(day: string, outcomes: boolean[]): string {
  const score = outcomes.filter(Boolean).length;
  const total = outcomes.length;
  return [`Daily Mandarin — ${day}`, `${score}/${total}`, outcomeStrip(outcomes), "Learn 10 Mandarin Words"].join("\n");
}
