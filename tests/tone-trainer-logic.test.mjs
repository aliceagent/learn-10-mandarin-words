import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  TONE_GLYPHS,
  buildToneRound,
  buildToneRounds,
  hasThirdTonePair,
  mutatedPatterns,
  patternAriaLabel,
  patternGlyphs,
  patternKey,
  streakLabel,
} from "../src/lib/tone-trainer-logic.ts";

// Deterministic "shuffle" that preserves order, so options are testable.
const identity = (items) => [...items];
const keyFor = (item) => `pets:${item.hanzi}`;

// A tiny fixture with varied tone patterns and syllable counts.
const ITEMS = [
  { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [] }, // [3]
  { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [] }, // [1]
  { hanzi: "鱼", pinyin: "yú", english: "fish", sentences: [] }, // [2]
  { hanzi: "鸟", pinyin: "niǎo", english: "bird", sentences: [] }, // [3]
  { hanzi: "兔子", pinyin: "tùzi", english: "rabbit", sentences: [] }, // [4,5]
  { hanzi: "金鱼", pinyin: "jīnyú", english: "goldfish", sentences: [] }, // [1,2]
];

test("patternKey / patternGlyphs / patternAriaLabel format all lengths incl. neutral", () => {
  assert.equal(patternKey([3]), "3");
  assert.equal(patternKey([4, 5, 3]), "4-5-3");
  assert.equal(patternGlyphs([3]), "ˇ");
  assert.equal(patternGlyphs([4, 5, 3]), "ˋ · ˇ");
  assert.equal(patternGlyphs([1, 2]), "ˉ ˊ");
  assert.equal(patternAriaLabel([3]), "tone 3");
  assert.equal(patternAriaLabel([4, 5, 3]), "tone 4, neutral tone, tone 3");
  // Glyph map matches tone-practice.tsx's vocabulary.
  assert.deepEqual(TONE_GLYPHS, { 1: "ˉ", 2: "ˊ", 3: "ˇ", 4: "ˋ", 5: "·" });
});

test("mutatedPatterns([3]) returns exactly the 4 other single-tone patterns", () => {
  const muts = mutatedPatterns([3]);
  const keys = muts.map(patternKey).sort();
  assert.deepEqual(keys, ["1", "2", "4", "5"]);
});

test("mutatedPatterns differ from the answer in exactly one position, no dupes", () => {
  const answer = [3, 1];
  const muts = mutatedPatterns(answer);
  const keys = new Set();
  for (const pattern of muts) {
    assert.equal(pattern.length, answer.length);
    const diffs = pattern.filter((tone, i) => tone !== answer[i]).length;
    assert.equal(diffs, 1, `expected exactly one differing tone in ${patternKey(pattern)}`);
    const key = patternKey(pattern);
    assert.ok(!keys.has(key), `duplicate mutation ${key}`);
    keys.add(key);
  }
  // Never the answer itself.
  assert.ok(!keys.has(patternKey(answer)));
  // [3,1]: 2 positions × 4 other tones = 8 mutations.
  assert.equal(muts.length, 8);
});

test("buildToneRound: answer present once, options unique + same length, ≤4", () => {
  const round = buildToneRound(ITEMS[0], ITEMS, keyFor, identity);
  assert.ok(round);
  assert.equal(round.key, "pets:狗");
  assert.deepEqual(round.answer, [3]);
  const keys = round.options.map(patternKey);
  // The answer appears exactly once.
  assert.equal(keys.filter((k) => k === patternKey(round.answer)).length, 1);
  // All options unique.
  assert.equal(new Set(keys).size, keys.length);
  // All options share the answer's length.
  for (const option of round.options) assert.equal(option.length, round.answer.length);
  // At most 4 options.
  assert.ok(round.options.length <= 4);
});

test("buildToneRound: real pool patterns are preferred over mutations", () => {
  // Answer 狗 [3]; the pool offers real single-syllable patterns [1], [2].
  // With identity shuffle those must be chosen before any mutation.
  const pool = [
    ITEMS[0], // 狗 [3] (answer)
    ITEMS[1], // 猫 [1]
    ITEMS[2], // 鱼 [2]
    ITEMS[3], // 鸟 [3] — same as answer, deduped away
  ];
  const round = buildToneRound(ITEMS[0], pool, keyFor, identity);
  assert.ok(round);
  const distractorKeys = round.options.map(patternKey).filter((k) => k !== "3");
  assert.ok(distractorKeys.includes("1"));
  assert.ok(distractorKeys.includes("2"));
});

test("buildToneRound: options only include same-syllable-count patterns", () => {
  // 金鱼 [1,2] is two syllables; every option must be length 2.
  const round = buildToneRound(ITEMS[5], ITEMS, keyFor, identity);
  assert.ok(round);
  for (const option of round.options) assert.equal(option.length, 2);
});

test("buildToneRound returns null when pinyin has no tones (no vowels)", () => {
  const round = buildToneRound(
    { hanzi: "？", pinyin: "", english: "n/a", sentences: [] },
    ITEMS,
    keyFor,
    identity,
  );
  assert.equal(round, null);
});

test("buildToneRounds: one round per item, order respects injected shuffle", () => {
  const rounds = buildToneRounds({ slug: "pets", items: ITEMS }, keyFor, identity);
  assert.equal(rounds.length, ITEMS.length);
  assert.deepEqual(
    rounds.map((r) => r.key),
    ITEMS.map((item) => keyFor(item)),
  );
});

test("hasThirdTonePair detects adjacent 3-3 only", () => {
  assert.equal(hasThirdTonePair([3, 3]), true);
  assert.equal(hasThirdTonePair([2, 3, 3]), true);
  assert.equal(hasThirdTonePair([3, 1, 3]), false);
  assert.equal(hasThirdTonePair([3]), false);
  assert.equal(hasThirdTonePair([1, 2, 4]), false);
});

test("streakLabel is non-null exactly at 3, 5, 10", () => {
  for (let n = 0; n <= 12; n++) {
    const label = streakLabel(n);
    if (n === 3 || n === 5 || n === 10) assert.ok(label, `expected label at ${n}`);
    else assert.equal(label, null, `expected null at ${n}`);
  }
});

test("dataset-wide: every word yields 4 unique same-length options incl. the answer", () => {
  let words = 0;
  for (const topic of rawData.topics) {
    const topicKeyFor = (item) => `${topic.slug}:${item.hanzi}`;
    for (const item of topic.items) {
      const round = buildToneRound(item, topic.items, topicKeyFor, identity);
      assert.ok(round, `no round for ${item.hanzi} (${item.pinyin})`);
      const keys = round.options.map(patternKey);
      assert.equal(round.options.length, 4, `${item.hanzi}: expected 4 options`);
      assert.equal(new Set(keys).size, 4, `${item.hanzi}: options not unique`);
      assert.ok(keys.includes(patternKey(round.answer)), `${item.hanzi}: answer missing`);
      for (const option of round.options) {
        assert.equal(option.length, round.answer.length, `${item.hanzi}: length mismatch`);
      }
      words++;
    }
  }
  assert.equal(words, 1020);
});
