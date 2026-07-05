import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAnswer,
  buildLightningDeck,
  buildLightningPool,
  COMBO_STEP,
  emptyRun,
  LIGHTNING_POOL_SIZE,
  MAX_MULTIPLIER,
  mergeRunIntoBest,
  multiplierFor,
  normalizeLightningBest,
  POINTS_PER_CORRECT,
  remainingMs,
} from "../src/lib/lightning-logic.ts";

// Minimal Topic/VocabItem fixtures, matching the practice-logic test style.
// wordKey is `slug:hanzi`; each item's english/pinyin derive from its hanzi so
// they stay distinct and 4 unique choices always fill from a same-topic pool.
function makeTopic(slug, hanziList, titleEn = slug) {
  return {
    slug,
    titleEn,
    items: hanziList.map((hanzi) => ({
      hanzi,
      pinyin: `${hanzi}-pinyin`,
      english: `${hanzi}-english`,
      sentences: [],
    })),
  };
}

const alpha = makeTopic("alpha", ["好", "坏", "空", "半"], "Alpha topic");
const beta = makeTopic("beta", ["日", "月", "水", "火", "木"], "Beta topic");
const TOPICS = [alpha, beta];

// Deterministic identity "shuffle" so pool/deck contents are assertable.
const identity = (items) => [...items];

const NOW = new Date("2026-07-05T12:00:00.000Z");
// A due card resolves via flashcardStats whose dueAt is at/before `now`.
function dueStat(dueAt, intervalDays = 1) {
  return { intervalDays, ease: 2.5, dueAt, reviewCount: 1 };
}

test("buildLightningPool: due words first (oldest due), then weak, then fresh — with source tags", () => {
  const progress = {
    // Two due words; beta:日 is due earlier than alpha:空, so it must come first.
    flashcardStats: {
      "alpha:空": dueStat("2026-07-05T09:00:00.000Z"),
      "beta:日": dueStat("2026-07-04T09:00:00.000Z"),
      // Not yet due — must be excluded from the due pass.
      "beta:火": dueStat("2026-08-01T00:00:00.000Z"),
    },
    // Weak words (≥2 attempts); alpha:好 weaker (0.25) than alpha:坏 (0.5).
    quizStats: {
      "alpha:好": { correct: 1, attempts: 4 },
      "alpha:坏": { correct: 2, attempts: 4 },
    },
    learnedTopics: [],
  };

  const pool = buildLightningPool(TOPICS, progress, { now: NOW, shuffle: identity });

  // Due (oldest first), then weak (weakest first), then fresh fill.
  const dueThenWeak = pool.slice(0, 4);
  assert.deepEqual(
    dueThenWeak.map((e) => e.key),
    ["beta:日", "alpha:空", "alpha:好", "alpha:坏"],
  );
  assert.deepEqual(
    dueThenWeak.map((e) => e.source),
    ["due", "due", "weak", "weak"],
  );
  // Fresh words fill the remainder and are tagged "fresh".
  assert.ok(pool.length > 4);
  assert.ok(pool.slice(4).every((e) => e.source === "fresh"));
  // Every entry carries its owning topic's items as the distractor pool.
  const betaDue = pool.find((e) => e.key === "beta:日");
  assert.equal(betaDue.topicSlug, "beta");
  assert.equal(betaDue.poolItems.length, beta.items.length);
});

test("buildLightningPool: a word that is both due and weak appears once, tagged 'due'", () => {
  const progress = {
    flashcardStats: { "alpha:好": dueStat("2026-07-04T00:00:00.000Z") },
    quizStats: { "alpha:好": { correct: 1, attempts: 4 } },
    learnedTopics: [],
  };
  const pool = buildLightningPool(TOPICS, progress, { now: NOW, shuffle: identity });
  const matches = pool.filter((e) => e.key === "alpha:好");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].source, "due");
});

test("buildLightningPool: empty progress still yields a non-empty fresh pool", () => {
  const pool = buildLightningPool(TOPICS, {}, { now: NOW, shuffle: identity });
  assert.ok(pool.length > 0);
  assert.ok(pool.every((e) => e.source === "fresh"));
});

test("buildLightningPool: unresolvable stat keys are dropped silently", () => {
  const progress = {
    flashcardStats: { "ghost:x": dueStat("2026-07-01T00:00:00.000Z") },
    quizStats: { "phantom:y": { correct: 0, attempts: 5 } },
    learnedTopics: [],
  };
  const pool = buildLightningPool(TOPICS, progress, { now: NOW, shuffle: identity });
  assert.ok(!pool.some((e) => e.key === "ghost:x" || e.key === "phantom:y"));
  // The fresh fill still makes the round playable.
  assert.ok(pool.length > 0);
});

test("buildLightningPool: never exceeds the limit", () => {
  const small = buildLightningPool(TOPICS, {}, { now: NOW, limit: 3, shuffle: identity });
  assert.equal(small.length, 3);
  const full = buildLightningPool(TOPICS, {}, { now: NOW, shuffle: identity });
  assert.ok(full.length <= LIGHTNING_POOL_SIZE);
});

test("buildLightningDeck: one hanzi-english card per entry, keyed to the entry, 4 unique choices with pinyin", () => {
  const pool = buildLightningPool(TOPICS, {}, { now: NOW, shuffle: identity });
  const deck = buildLightningDeck(pool, identity);
  assert.equal(deck.length, pool.length);
  deck.forEach((card, i) => {
    assert.equal(card.key, pool[i].key);
    // hanzi-english: prompt is the hanzi, answer is the English, pinyin is set.
    assert.equal(card.prompt, pool[i].item.hanzi);
    assert.equal(card.answer, pool[i].item.english);
    assert.ok(card.promptPinyin, "promptPinyin present for hanzi-english mode");
    assert.ok(card.choices.includes(card.answer));
    assert.equal(new Set(card.choices).size, card.choices.length, "choices are unique");
    assert.ok(card.choices.length >= 2 && card.choices.length <= 4);
  });
});

test("multiplierFor: 0–2 → ×1, 3–5 → ×2, ≥6 → ×3 (capped), corrupt → ×1", () => {
  assert.equal(multiplierFor(0), 1);
  assert.equal(multiplierFor(2), 1);
  assert.equal(multiplierFor(COMBO_STEP), 2);
  assert.equal(multiplierFor(5), 2);
  assert.equal(multiplierFor(6), MAX_MULTIPLIER);
  assert.equal(multiplierFor(99), MAX_MULTIPLIER);
  assert.equal(multiplierFor(-3), 1);
  assert.equal(multiplierFor(Number.NaN), 1);
});

test("applyAnswer: correct answers score at the pre-answer multiplier; misses reset streak, never subtract", () => {
  let run = emptyRun();
  // First 3 correct score ×1 each.
  run = applyAnswer(run, true);
  run = applyAnswer(run, true);
  run = applyAnswer(run, true);
  assert.equal(run.score, 3 * POINTS_PER_CORRECT);
  assert.equal(run.streak, 3);
  assert.equal(run.correct, 3);
  assert.equal(run.answered, 3);
  // 4th correct scores at ×2 (streak is now ≥ COMBO_STEP).
  run = applyAnswer(run, true);
  assert.equal(run.score, 3 * POINTS_PER_CORRECT + 2 * POINTS_PER_CORRECT);
  assert.equal(run.streak, 4);
  assert.equal(run.bestStreak, 4);
  // A miss resets the streak/multiplier but keeps the score and bestStreak.
  const beforeMiss = run.score;
  run = applyAnswer(run, false);
  assert.equal(run.score, beforeMiss);
  assert.equal(run.streak, 0);
  assert.equal(run.multiplier, 1);
  assert.equal(run.bestStreak, 4);
  assert.equal(run.answered, 5);
  assert.equal(run.correct, 4);
});

test("applyAnswer: a long streak caps the multiplier at MAX_MULTIPLIER", () => {
  let run = emptyRun();
  for (let i = 0; i < 6; i += 1) run = applyAnswer(run, true);
  // The 7th correct scores at the capped ×MAX_MULTIPLIER.
  const before = run.score;
  run = applyAnswer(run, true);
  assert.equal(run.score - before, MAX_MULTIPLIER * POINTS_PER_CORRECT);
});

test("applyAnswer: pure — the input run is not mutated", () => {
  const run = emptyRun();
  const snapshot = { ...run };
  applyAnswer(run, true);
  assert.deepEqual(run, snapshot);
});

test("normalizeLightningBest: corrupt/missing/out-of-range values collapse to a safe zero-state", () => {
  const zero = { bestScore: 0, bestCorrect: 0, runs: 0, updatedAt: null };
  assert.deepEqual(normalizeLightningBest(null), zero);
  assert.deepEqual(normalizeLightningBest("junk"), zero);
  assert.deepEqual(normalizeLightningBest(42), zero);
  assert.deepEqual(
    normalizeLightningBest({ bestScore: -5, bestCorrect: Number.NaN, runs: "3", updatedAt: "nope" }),
    zero,
  );
  // Floats round; a valid ISO round-trips.
  const cleaned = normalizeLightningBest({
    bestScore: 1200.6,
    bestCorrect: 11,
    runs: 4,
    updatedAt: "2026-07-05T12:00:00.000Z",
  });
  assert.deepEqual(cleaned, {
    bestScore: 1201,
    bestCorrect: 11,
    runs: 4,
    updatedAt: "2026-07-05T12:00:00.000Z",
  });
});

test("mergeRunIntoBest: higher score sets a new best; equal/lower preserves it; runs always increments", () => {
  const zero = normalizeLightningBest(null);
  // First real run sets the best and increments runs.
  const run1 = { ...emptyRun(), score: 800, answered: 10, correct: 8, bestStreak: 4 };
  const first = mergeRunIntoBest(zero, run1, NOW);
  assert.equal(first.isNewBest, true);
  assert.equal(first.best.bestScore, 800);
  assert.equal(first.best.bestCorrect, 8);
  assert.equal(first.best.runs, 1);
  assert.equal(first.best.updatedAt, NOW.toISOString());

  // A lower score does not overwrite the best but still counts as a run.
  const run2 = { ...emptyRun(), score: 500, answered: 9, correct: 5, bestStreak: 2 };
  const second = mergeRunIntoBest(first.best, run2, NOW);
  assert.equal(second.isNewBest, false);
  assert.equal(second.best.bestScore, 800);
  assert.equal(second.best.bestCorrect, 8);
  assert.equal(second.best.runs, 2);

  // An equal score is not a new best.
  const run3 = { ...emptyRun(), score: 800, answered: 10, correct: 8 };
  const third = mergeRunIntoBest(second.best, run3, NOW);
  assert.equal(third.isNewBest, false);
  assert.equal(third.best.runs, 3);
});

test("mergeRunIntoBest: a zero-answered run never sets a best", () => {
  const zero = normalizeLightningBest(null);
  const empty = mergeRunIntoBest(zero, emptyRun(), NOW);
  assert.equal(empty.isNewBest, false);
  assert.equal(empty.best.bestScore, 0);
  assert.equal(empty.best.runs, 1);
});

test("remainingMs: mid-run value, exact zero, and past-deadline all clamp to ≥ 0", () => {
  assert.equal(remainingMs(1_000, 400), 600);
  assert.equal(remainingMs(1_000, 1_000), 0);
  assert.equal(remainingMs(1_000, 5_000), 0);
});
