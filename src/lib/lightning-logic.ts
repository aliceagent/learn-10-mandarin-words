import type { FlashcardStat, QuizStat, Topic, VocabItem } from "./types";
// Explicit `.ts` extensions so these runtime imports resolve under `node --test`
// (Node's native TS runner does not add extensions), while `next build` and tsc
// accept them via `allowImportingTsExtensions`. Mirrors quiz-logic.ts /
// practice-logic.ts / daily-logic.ts.
import { buildQuizCard, defaultShuffle, type QuizCard } from "./quiz-logic.ts";
import { computeWeakWords, dueCards } from "./progress-logic.ts";
import { recommendedPath, wordKey } from "./data-logic.ts";

// Pure, DOM-free logic for the Lightning Round (Sprint 2): a 60-second timed
// hanzi → English quiz over the learner's due and weakest words, with a
// device-local personal best and a small combo multiplier. Nothing here touches
// the DOM, localStorage, or a backend — the component (lightning-app.tsx) layers
// timing + persistence on top, so all game rules are unit-testable without React.

// ─── Constants ─────────────────────────────────────────────────────────────────

// One round lasts 60 seconds. Wall-clock-anchored in the component (an `endsAt`
// deadline), so the countdown is drift- and tab-blur-safe.
export const LIGHTNING_DURATION_MS = 60_000;

// A fast player answers ~30 questions in 60s; 40 gives comfortable headroom and
// bounds the work done at Start. The component wraps + reshuffles the deck if a
// player ever exhausts it, so the pool never runs dry.
export const LIGHTNING_POOL_SIZE = 40;

// Base points for a correct answer, before the combo multiplier.
export const POINTS_PER_CORRECT = 100;

// Every COMBO_STEP consecutive correct answers lifts the multiplier by one, up to
// MAX_MULTIPLIER. A single miss resets the streak (and multiplier) to the floor.
export const COMBO_STEP = 3;
export const MAX_MULTIPLIER = 3;

// Device-local personal best lives under its own localStorage key — NOT in
// ProgressState — so it never touches progress export/import or the schema
// version (mirrors the tone-colors / video-rate standalone-pref pattern).
export const LIGHTNING_STORAGE_KEY = "learn-10-mandarin-lightning-v1";

// ─── Word pool ─────────────────────────────────────────────────────────────────

// Where a pooled word came from, in priority order: SRS-due, quiz-weak, or a
// fresh fill so the round is always playable even with no history.
export type LightningSource = "due" | "weak" | "fresh";

// A word queued for the round, resolved to its dataset item plus the metadata the
// game UI needs (a same-topic distractor pool, and its origin for display/debug).
export type LightningEntry = {
  key: string; // wordKey (`topic.slug:hanzi`)
  item: VocabItem;
  topicSlug: string;
  topicTitle: string;
  poolItems: VocabItem[]; // same-topic distractor pool (the owning topic's items)
  source: LightningSource;
};

// The subset of ProgressState the pool builder reads. Kept structural so the
// helper stays dataset-parameterized and easy to fixture in tests.
type LightningProgress = {
  quizStats?: Record<string, QuizStat>;
  flashcardStats?: Record<string, FlashcardStat>;
  learnedTopics?: string[];
};

// Build the prioritized, deduped word pool for one round: SRS-**due** words first
// (oldest due first, from dueCards), then **weak** quizzed words (weakest first,
// from computeWeakWords with minAttempts:2 — the /practice threshold), then a
// **fresh** fill drawn from the learner's learned topics and the curated starter
// path so a brand-new learner still gets a full, playable round. Words are
// deduped by wordKey (a word that is both due and weak appears once, tagged
// "due"), unresolvable stat keys are dropped silently (same policy as
// resolveWeakItems), and the pool is capped at `limit` (default
// LIGHTNING_POOL_SIZE). `now` and `shuffle` are injectable so the fresh fill is
// deterministic in tests.
export function buildLightningPool(
  topics: Topic[],
  progress: LightningProgress,
  opts: { now?: Date; limit?: number; shuffle?: <T>(items: T[]) => T[] } = {},
): LightningEntry[] {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? LIGHTNING_POOL_SIZE;
  const shuffle = opts.shuffle ?? defaultShuffle;

  // wordKey → {item, topic}, so any stat key resolves back to a real item and its
  // owning topic (the distractor pool).
  const byKey = new Map<string, { item: VocabItem; topic: Topic }>();
  for (const topic of topics) {
    for (const item of topic.items) {
      byKey.set(wordKey(topic, item), { item, topic });
    }
  }

  const seen = new Set<string>();
  const entries: LightningEntry[] = [];

  // Append `key` as `source` unless it's already queued or can't be resolved.
  const push = (key: string, source: LightningSource) => {
    if (seen.has(key)) return;
    const found = byKey.get(key);
    if (!found) return; // unresolvable stat key — drop it
    seen.add(key);
    entries.push({
      key,
      item: found.item,
      topicSlug: found.topic.slug,
      topicTitle: found.topic.titleEn,
      poolItems: found.topic.items,
      source,
    });
  };

  // 1. Due words, oldest-due first (dueCards already sorts that way).
  for (const card of dueCards(topics, progress.flashcardStats ?? {}, now)) {
    push(card.key, "due");
  }
  // 2. Weak words, weakest-first. minAttempts:2 mirrors /practice; ask for up to
  //    `limit` so the pool can fill from weak words alone before the fresh pass.
  for (const weak of computeWeakWords(progress.quizStats, { minAttempts: 2, limit })) {
    push(weak.key, "weak");
  }
  // 3. Fresh fill (only if still short): learned topics first, then the curated
  //    starter path, so even a zero-history learner gets a full round. Shuffled so
  //    a real game varies which fresh words surface; deterministic under a fixture
  //    shuffle in tests.
  if (entries.length < limit) {
    const learned = new Set(progress.learnedTopics ?? []);
    const freshTopics = [...topics.filter((t) => learned.has(t.slug)), ...recommendedPath(topics)];
    const freshKeys: string[] = [];
    const seenTopics = new Set<string>();
    for (const topic of freshTopics) {
      if (seenTopics.has(topic.slug)) continue; // a learned topic may also be in the starter path
      seenTopics.add(topic.slug);
      for (const item of topic.items) freshKeys.push(wordKey(topic, item));
    }
    for (const key of shuffle(freshKeys)) {
      if (entries.length >= limit) break;
      push(key, "fresh");
    }
  }

  return entries.slice(0, limit);
}

// One `"hanzi-english"` QuizCard per entry (keyed by the entry's wordKey so
// answers persist against the exact word), drawing distractors from that entry's
// own topic items so choices are same-topic. `promptPinyin` is set for
// hanzi-english mode, satisfying the "pinyin on Chinese lines" rule. Shuffle is
// injectable; the component reshuffles on deck wrap-around. Mirrors
// buildPracticeQuiz.
export function buildLightningDeck(
  entries: LightningEntry[],
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): QuizCard[] {
  return entries.map((e) => buildQuizCard(e.item, e.poolItems, "hanzi-english", () => e.key, shuffle));
}

// ─── Run scoring + combo ─────────────────────────────────────────────────────────

// Live scoring state for one round. `multiplier` is derived (multiplierFor(streak))
// and stored only so the UI can render the combo chip without recomputing.
export type LightningRun = {
  score: number;
  answered: number;
  correct: number;
  streak: number; // current consecutive-correct run
  bestStreak: number; // longest streak reached this round
  multiplier: number; // multiplierFor(streak) — for display
};

// The combo multiplier for a given consecutive-correct streak:
//   min(MAX_MULTIPLIER, 1 + floor(streak / COMBO_STEP))
// so 0–2 → ×1, 3–5 → ×2, and ≥6 → ×3 (capped). Tolerant of corrupt/negative
// input (falls back to ×1).
export function multiplierFor(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 0) return 1;
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(streak / COMBO_STEP));
}

// A fresh, zero-scored run.
export function emptyRun(): LightningRun {
  return { score: 0, answered: 0, correct: 0, streak: 0, bestStreak: 0, multiplier: multiplierFor(0) };
}

// Fold one answer into the run (pure — returns a NEW run). A correct answer scores
// POINTS_PER_CORRECT × the multiplier for the streak BEFORE this answer, then
// extends the streak; so answers 1–3 score ×1, 4–6 score ×2, 7+ score ×3. A wrong
// answer resets the streak (and multiplier) to the floor but NEVER subtracts
// points. `bestStreak` only ever grows.
export function applyAnswer(run: LightningRun, correct: boolean): LightningRun {
  if (correct) {
    const points = POINTS_PER_CORRECT * multiplierFor(run.streak);
    const streak = run.streak + 1;
    return {
      score: run.score + points,
      answered: run.answered + 1,
      correct: run.correct + 1,
      streak,
      bestStreak: Math.max(run.bestStreak, streak),
      multiplier: multiplierFor(streak),
    };
  }
  return {
    score: run.score,
    answered: run.answered + 1,
    correct: run.correct,
    streak: 0,
    bestStreak: run.bestStreak,
    multiplier: multiplierFor(0),
  };
}

// ─── Personal best ────────────────────────────────────────────────────────────

// The device-local personal best, persisted under LIGHTNING_STORAGE_KEY.
export type LightningBest = {
  bestScore: number;
  bestCorrect: number;
  runs: number;
  updatedAt: string | null; // ISO of the latest run, or null before the first run
};

// True for a well-formed ISO timestamp (matches progress-logic's isValidISO).
function isValidISO(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

// Coerce any stored/unknown value to a safe LightningBest — never throws. Corrupt,
// negative, non-finite, or missing fields collapse to a zero-state; valid stored
// objects round-trip. Mirrors normalizeQuizStat's defensive style.
export function normalizeLightningBest(raw: unknown): LightningBest {
  const zero: LightningBest = { bestScore: 0, bestCorrect: 0, runs: 0, updatedAt: null };
  if (!raw || typeof raw !== "object") return zero;
  const r = raw as Partial<LightningBest>;
  const coerce = (value: unknown): number =>
    Number.isFinite(value) && (value as number) >= 0 ? Math.round(value as number) : 0;
  return {
    bestScore: coerce(r.bestScore),
    bestCorrect: coerce(r.bestCorrect),
    runs: coerce(r.runs),
    updatedAt: isValidISO(r.updatedAt) ? (r.updatedAt as string) : null,
  };
}

// Merge a finished run into the stored best (pure). A run is a NEW best only when
// it answered at least one question AND its score strictly beats the stored best —
// so a zero-answered run and an equal/lower score never overwrite the best, but
// `runs` is always incremented and `updatedAt` always stamped. `now` is
// injectable for deterministic tests.
export function mergeRunIntoBest(
  best: LightningBest,
  run: LightningRun,
  now: Date = new Date(),
): { best: LightningBest; isNewBest: boolean } {
  const base = normalizeLightningBest(best);
  const isNewBest = run.answered > 0 && run.score > base.bestScore;
  return {
    best: {
      bestScore: isNewBest ? run.score : base.bestScore,
      bestCorrect: isNewBest ? run.correct : base.bestCorrect,
      runs: base.runs + 1,
      updatedAt: now.toISOString(),
    },
    isNewBest,
  };
}

// ─── Countdown ────────────────────────────────────────────────────────────────

// Milliseconds left until the `endsAt` wall-clock deadline, clamped to ≥ 0. The
// component derives the whole timer from this, so a backgrounded/blurred tab ends
// the round honestly rather than freezing.
export function remainingMs(endsAt: number, now: number): number {
  const remaining = endsAt - now;
  return remaining > 0 ? remaining : 0;
}
