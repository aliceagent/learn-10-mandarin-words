import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAnswer,
  buildLightningDeck,
  buildLightningPool,
  COMBO_STEP,
  emptyRun,
  LIGHTNING_HISTORY_LIMIT,
  LIGHTNING_POOL_SIZE,
  MAX_MULTIPLIER,
  mergeRunIntoBest,
  multiplierFor,
  nextTier,
  normalizeLightningBest,
  POINTS_PER_CORRECT,
  remainingMs,
  sparklinePoints,
  tierForScore,
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
  const zero = { bestScore: 0, bestCorrect: 0, runs: 0, updatedAt: null, history: [] };
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
    history: [],
  });
});

test("normalizeLightningBest: a legacy v1 payload without history round-trips with history: []", () => {
  // The exact shape shipped before Sprint 12 — no `history` key.
  const legacy = { bestScore: 2100, bestCorrect: 18, runs: 5, updatedAt: "2026-07-01T00:00:00.000Z" };
  assert.deepEqual(normalizeLightningBest(legacy), { ...legacy, history: [] });
});

test("normalizeLightningBest: corrupt history entries are dropped; a non-array history becomes []", () => {
  const good = { score: 800, correct: 8, answered: 10, at: "2026-07-05T12:00:00.000Z" };
  const normalized = normalizeLightningBest({
    bestScore: 800,
    bestCorrect: 8,
    runs: 3,
    updatedAt: "2026-07-05T12:00:00.000Z",
    history: [
      good,
      { score: -1, correct: 2, answered: 3, at: "2026-07-05T11:00:00.000Z" }, // negative score
      { score: Number.NaN, correct: 2, answered: 3, at: "2026-07-05T11:00:00.000Z" }, // NaN
      { score: 400, correct: 2, answered: 3, at: "not-a-date" }, // bad ISO
      "junk",
      null,
    ],
  });
  // Only the well-formed entry survives; score is rounded via the coercer.
  assert.deepEqual(normalized.history, [good]);

  // A non-array history (or missing) collapses to [].
  assert.deepEqual(normalizeLightningBest({ bestScore: 1, history: "nope" }).history, []);
});

test("normalizeLightningBest: over-long history is capped at LIGHTNING_HISTORY_LIMIT (newest-first)", () => {
  const history = Array.from({ length: LIGHTNING_HISTORY_LIMIT + 8 }, (_, i) => ({
    score: 1000 - i, // newest-first: index 0 is the newest/highest here
    correct: 5,
    answered: 8,
    at: "2026-07-05T12:00:00.000Z",
  }));
  const normalized = normalizeLightningBest({ bestScore: 1000, history });
  assert.equal(normalized.history.length, LIGHTNING_HISTORY_LIMIT);
  // The cap keeps the first (newest) entries, dropping the oldest overflow.
  assert.equal(normalized.history[0].score, 1000);
  assert.equal(normalized.history[LIGHTNING_HISTORY_LIMIT - 1].score, 1000 - (LIGHTNING_HISTORY_LIMIT - 1));
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

test("mergeRunIntoBest: an answered run is prepended to history newest-first, with the injected ISO", () => {
  const zero = normalizeLightningBest(null);
  const run1 = { ...emptyRun(), score: 500, answered: 6, correct: 5 };
  const first = mergeRunIntoBest(zero, run1, NOW);
  assert.deepEqual(first.best.history, [
    { score: 500, correct: 5, answered: 6, at: NOW.toISOString() },
  ]);

  // A later, lower run is not a best but still lands at the FRONT of history.
  const later = new Date("2026-07-06T12:00:00.000Z");
  const run2 = { ...emptyRun(), score: 300, answered: 4, correct: 3 };
  const second = mergeRunIntoBest(first.best, run2, later);
  assert.equal(second.isNewBest, false);
  assert.deepEqual(
    second.best.history.map((r) => r.score),
    [300, 500],
  );
  assert.equal(second.best.history[0].at, later.toISOString());
});

test("mergeRunIntoBest: a zero-answered run increments runs but appends nothing to history", () => {
  const seeded = mergeRunIntoBest(normalizeLightningBest(null), { ...emptyRun(), score: 400, answered: 5, correct: 4 }, NOW);
  assert.equal(seeded.best.history.length, 1);
  const walked = mergeRunIntoBest(seeded.best, emptyRun(), NOW);
  assert.equal(walked.best.runs, 2);
  assert.equal(walked.best.history.length, 1); // unchanged — the empty run isn't recorded
});

test("mergeRunIntoBest: history is capped at LIGHTNING_HISTORY_LIMIT as runs accumulate", () => {
  let state = normalizeLightningBest(null);
  for (let i = 0; i < LIGHTNING_HISTORY_LIMIT + 5; i += 1) {
    state = mergeRunIntoBest(state, { ...emptyRun(), score: 100 + i, answered: 3, correct: 2 }, NOW).best;
  }
  assert.equal(state.history.length, LIGHTNING_HISTORY_LIMIT);
  // Newest-first: the most recent run (highest score here) sits at the front.
  assert.equal(state.history[0].score, 100 + (LIGHTNING_HISTORY_LIMIT + 5 - 1));
});

test("remainingMs: mid-run value, exact zero, and past-deadline all clamp to ≥ 0", () => {
  assert.equal(remainingMs(1_000, 400), 600);
  assert.equal(remainingMs(1_000, 1_000), 0);
  assert.equal(remainingMs(1_000, 5_000), 0);
});

test("tierForScore: boundary values map to the right tier; below-Spark and non-finite → null", () => {
  assert.equal(tierForScore(0), null);
  assert.equal(tierForScore(499), null);
  assert.equal(tierForScore(500).name, "Spark");
  assert.equal(tierForScore(1_499).name, "Spark");
  assert.equal(tierForScore(1_500).name, "Bolt");
  assert.equal(tierForScore(2_999).name, "Bolt");
  assert.equal(tierForScore(3_000).name, "Storm");
  assert.equal(tierForScore(4_999).name, "Storm");
  assert.equal(tierForScore(5_000).name, "Thunderclap");
  assert.equal(tierForScore(9_999).name, "Thunderclap");
  assert.equal(tierForScore(Number.NaN), null);
  assert.equal(tierForScore(-100), null);
});

// Named tiers resolved from the exported thresholds so the tests don't hard-code
// the objects.
const SPARK = tierForScore(500);
const STORM = tierForScore(3_000);

test("nextTier: exact point gaps below the top tier; null at/above Thunderclap", () => {
  assert.deepEqual(nextTier(0), { tier: SPARK, pointsAway: 500 });
  assert.deepEqual(nextTier(2_600), { tier: STORM, pointsAway: 400 });
  // Just inside a tier still chases the next one.
  assert.equal(nextTier(1_500).tier.name, "Storm");
  assert.equal(nextTier(1_500).pointsAway, 1_500);
  assert.equal(nextTier(5_000), null);
  assert.equal(nextTier(9_999), null);
  assert.equal(nextTier(Number.NaN), null);
});

test("sparklinePoints: empty → \"\"; single score → one centered point", () => {
  assert.equal(sparklinePoints([], 160, 40), "");
  const single = sparklinePoints([1_200], 160, 40);
  // One coordinate pair, centered in the padded box (PAD=4 → center 80,20).
  assert.equal(single.split(" ").length, 1);
  assert.equal(single, "80.00,20.00");
});

test("sparklinePoints: two scores — higher score maps to a smaller y; one pair per score", () => {
  const pts = sparklinePoints([100, 900], 160, 40).split(" ");
  assert.equal(pts.length, 2);
  const [x0, y0] = pts[0].split(",").map(Number);
  const [x1, y1] = pts[1].split(",").map(Number);
  // x spans left→right across the padded width.
  assert.equal(x0, 4);
  assert.equal(x1, 156);
  // The higher (second) score sits higher on screen → smaller y.
  assert.ok(y1 < y0);
});

test("sparklinePoints: all-equal scores render a flat midline, never NaN", () => {
  const out = sparklinePoints([500, 500, 500], 160, 40);
  assert.ok(!out.includes("NaN"));
  const ys = out.split(" ").map((p) => Number(p.split(",")[1]));
  assert.deepEqual(ys, [20, 20, 20]); // all on the vertical midline
  assert.equal(out.split(" ").length, 3); // one pair per score
});
