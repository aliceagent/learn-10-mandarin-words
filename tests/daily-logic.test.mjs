import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  DAILY_CHALLENGE_SIZE,
  DAILY_MODES,
  buildDailyChallenge,
  dailyChallengeTopics,
  dateSeed,
  mulberry32,
  outcomeStrip,
  seededShuffle,
  shareText,
  studiedTopicSlugs,
  usesStarterFallback,
} from "../src/lib/daily-logic.ts";
import { recommendedPath } from "../src/lib/data-logic.ts";

const topics = rawData.topics;

// Progress fixtures — only the three fields the daily builder reads.
function progressWith({ learnedTopics = [], quizStats = {}, flashcardStats = {} } = {}) {
  return { learnedTopics, quizStats, flashcardStats };
}
const EMPTY = progressWith();

// A comparable signature of a built deck: word key, mode, and exact choice order.
function signature(questions) {
  return questions.map((q) => ({ key: q.card.key, mode: q.mode, choices: q.card.choices }));
}

// ─── Seeded RNG primitives ─────────────────────────────────────────────────────

test("dateSeed is deterministic per day and differs across days", () => {
  assert.equal(dateSeed("2026-07-05"), dateSeed("2026-07-05"));
  assert.notEqual(dateSeed("2026-07-05"), dateSeed("2026-07-06"));
  // Always a uint32.
  const s = dateSeed("2026-07-05");
  assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff);
});

test("mulberry32 is a stable PRNG in [0,1) for a fixed seed", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test("seededShuffle is a deterministic permutation", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const one = seededShuffle(mulberry32(99))(items);
  const two = seededShuffle(mulberry32(99))(items);
  assert.deepEqual(one, two);
  assert.deepEqual([...one].sort((x, y) => x - y), items); // same multiset
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8]); // input untouched
});

// ─── studiedTopicSlugs / topic selection ───────────────────────────────────────

test("studiedTopicSlugs unions learnedTopics with slugs parsed from stat keys", () => {
  const slugs = studiedTopicSlugs(
    progressWith({
      learnedTopics: ["alpha"],
      quizStats: { "beta:狗": { correct: 1, attempts: 2 } },
      flashcardStats: { "gamma:猫": { intervalDays: 1, ease: 2.5, dueAt: "x", reviewCount: 1 } },
    }),
  );
  assert.deepEqual([...slugs].sort(), ["alpha", "beta", "gamma"]);
});

test("usesStarterFallback is true for a new learner and false once a topic is studied", () => {
  assert.equal(usesStarterFallback(topics, EMPTY), true);
  // One learned real topic supplies 10 words == DAILY_CHALLENGE_SIZE → no fallback.
  assert.equal(usesStarterFallback(topics, progressWith({ learnedTopics: ["ten-types-of-pets"] })), false);
});

test("dailyChallengeTopics falls back to the starter path for a new learner", () => {
  const picked = dailyChallengeTopics(topics, EMPTY);
  const starterSlugs = recommendedPath(topics).map((t) => t.slug);
  assert.deepEqual(picked.map((t) => t.slug), starterSlugs);
});

// ─── buildDailyChallenge: determinism ──────────────────────────────────────────

test("same (topics, progress, day) builds an identical deck (keys, modes, choice order)", () => {
  const day = "2026-07-05";
  const a = buildDailyChallenge(topics, EMPTY, day);
  const b = buildDailyChallenge(topics, EMPTY, day);
  assert.deepEqual(signature(a), signature(b));
});

test("different days produce different decks", () => {
  const a = buildDailyChallenge(topics, EMPTY, "2026-07-05");
  const b = buildDailyChallenge(topics, EMPTY, "2026-07-06");
  assert.notDeepEqual(
    a.map((q) => q.card.key),
    b.map((q) => q.card.key),
  );
});

test("deck is independent of topic iteration order", () => {
  const day = "2026-07-05";
  const progress = progressWith({ learnedTopics: ["ten-types-of-pets", "ten-types-of-drinks"] });
  const forward = buildDailyChallenge(topics, progress, day);
  const reversed = buildDailyChallenge([...topics].reverse(), progress, day);
  assert.deepEqual(signature(forward), signature(reversed));
});

// ─── buildDailyChallenge: pool selection ───────────────────────────────────────

test("studied-only: every question is drawn from the studied topics", () => {
  const progress = progressWith({
    learnedTopics: ["ten-types-of-pets"],
    quizStats: { "ten-types-of-drinks:水": { correct: 1, attempts: 3 } },
  });
  const questions = buildDailyChallenge(topics, progress, "2026-07-05");
  const allowed = studiedTopicSlugs(progress);
  for (const q of questions) assert.ok(allowed.has(q.topicSlug), `${q.topicSlug} is studied`);
});

test("new learner: deck comes from the starter path and is DAILY_CHALLENGE_SIZE long", () => {
  const questions = buildDailyChallenge(topics, EMPTY, "2026-07-05");
  assert.equal(questions.length, DAILY_CHALLENGE_SIZE);
  const starterSlugs = new Set(recommendedPath(topics).map((t) => t.slug));
  for (const q of questions) assert.ok(starterSlugs.has(q.topicSlug));
});

test("small dataset: deck length is min(size, available words)", () => {
  const tiny = [
    { slug: "s1", titleEn: "S1", items: [item("A"), item("B"), item("C")] },
    { slug: "s2", titleEn: "S2", items: [item("D"), item("E"), item("F")] },
  ];
  const questions = buildDailyChallenge(tiny, EMPTY, "2026-07-05");
  assert.equal(questions.length, 6); // 6 words < 10 → all six, no crash
});

// ─── buildDailyChallenge: mode mix + card shape ────────────────────────────────

test("a full deck mixes all three visual modes", () => {
  const questions = buildDailyChallenge(topics, progressWith({ learnedTopics: ["ten-types-of-pets"] }), "2026-07-05");
  assert.equal(questions.length, DAILY_CHALLENGE_SIZE);
  const modes = new Set(questions.map((q) => q.mode));
  for (const mode of DAILY_MODES) assert.ok(modes.has(mode), `mode ${mode} present`);
});

test("every card has 4 unique choices including its answer", () => {
  const questions = buildDailyChallenge(topics, progressWith({ learnedTopics: ["ten-types-of-pets"] }), "2026-07-05");
  for (const q of questions) {
    assert.equal(q.card.choices.length, 4, `${q.card.key} has 4 choices`);
    assert.equal(new Set(q.card.choices).size, 4, `${q.card.key} choices are unique`);
    assert.ok(q.card.choices.includes(q.card.answer), `${q.card.key} includes its answer`);
    // card.key is the wordKey → recordQuizAnswer-ready.
    assert.equal(q.card.key, `${q.topicSlug}:${q.item.hanzi}`);
  }
});

// ─── shareText ─────────────────────────────────────────────────────────────────

test("outcomeStrip maps correct→🟩 and wrong→🟥", () => {
  assert.equal(outcomeStrip([true, false, true]), "🟩🟥🟩");
  assert.equal(outcomeStrip([]), "");
});

test("shareText emits the day, score line, emoji strip, and site name with no trailing whitespace", () => {
  const text = shareText("2026-07-05", [true, false, true]);
  assert.equal(text, "Daily Mandarin — 2026-07-05\n2/3\n🟩🟥🟩\nLearn 10 Mandarin Words");
  assert.equal(text, text.trimEnd(), "no trailing whitespace");
});

// Tiny VocabItem factory for the synthetic-dataset test.
function item(hanzi) {
  return { hanzi, pinyin: `${hanzi}-pinyin`, english: `${hanzi}-english`, sentences: [] };
}
