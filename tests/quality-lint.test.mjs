import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import { tonesOf } from "../src/lib/pinyin.ts";
import {
  expectedArticle,
  suspiciousArticles,
  hasTerminalPunctuation,
  looksTruncated,
  punctuationMismatch,
  duplicateEnglishLabels,
  hanziCharCount,
  pinyinSyllableCount,
  syllableCountMismatch,
  collectQualityWarnings,
} from "../scripts/quality-lint.mjs";

// ── expectedArticle ──────────────────────────────────────────────────────────
test("expectedArticle uses sound, not spelling, for tricky words", () => {
  assert.equal(expectedArticle("apple"), "an");
  assert.equal(expectedArticle("dog"), "a");
  // vowel letter, consonant sound
  assert.equal(expectedArticle("university"), "a");
  assert.equal(expectedArticle("one-way"), "a");
  // consonant letter, vowel sound
  assert.equal(expectedArticle("hour"), "an");
  assert.equal(expectedArticle("honest"), "an");
  // initialisms
  assert.equal(expectedArticle("US"), "a");
  assert.equal(expectedArticle("RMB"), "an");
  assert.equal(expectedArticle("EU"), "an");
});

// ── suspiciousArticles ───────────────────────────────────────────────────────
test("suspiciousArticles flags the sprint's example article mistakes", () => {
  assert.equal(suspiciousArticles("I paid with an US dollar today.").length, 1);
  assert.equal(suspiciousArticles("That costs a RMB or two.").length, 1);
  assert.equal(suspiciousArticles("He ate a apple.").length, 1);
  assert.equal(suspiciousArticles("We celebrated a Spring Festival.").length, 1);
});

test("suspiciousArticles leaves correct articles alone", () => {
  assert.deepEqual(suspiciousArticles("I saw a dog and an apple."), []);
  assert.deepEqual(suspiciousArticles("She studies at a university for an hour."), []);
  assert.deepEqual(suspiciousArticles("It cost an RMB and a US dollar."), []);
  assert.deepEqual(suspiciousArticles("We visited the Spring Festival market."), []);
});

// ── terminal punctuation / truncation ────────────────────────────────────────
test("hasTerminalPunctuation accepts sentence-final marks and trailing quotes", () => {
  assert.equal(hasTerminalPunctuation("This is fine."), true);
  assert.equal(hasTerminalPunctuation("Is it?"), true);
  assert.equal(hasTerminalPunctuation('He said "hello."'), true);
  assert.equal(hasTerminalPunctuation("This is cut off"), false);
});

test("looksTruncated catches real cutoffs but not sentence-final particles", () => {
  assert.match(looksTruncated("We need to buy the"), /dangling/);
  assert.match(looksTruncated("I went to the store and"), /dangling/);
  assert.match(looksTruncated("She said hello,"), /comma/);
  assert.match(looksTruncated("Wait for me…"), /ellipsis/);
  // Properly terminated phrasal verbs are NOT truncated.
  assert.equal(looksTruncated("Please try it on."), null);
  assert.equal(looksTruncated("May I come in?"), null);
  assert.equal(looksTruncated("Let's keep in touch from now on."), null);
});

// ── punctuationMismatch ──────────────────────────────────────────────────────
test("punctuationMismatch flags question/exclamation drift between CN and EN", () => {
  assert.match(punctuationMismatch("你好。", "Is that you?"), /question/);
  assert.match(punctuationMismatch("是你吗？", "That is you."), /question/);
  assert.match(punctuationMismatch("太好了。", "Wonderful!"), /exclamation/);
  assert.equal(punctuationMismatch("是你吗？", "Is that you?"), null);
  assert.equal(punctuationMismatch("太好了！", "Wonderful!"), null);
  assert.equal(punctuationMismatch("这是一只狗。", "This is a dog."), null);
});

test("punctuationMismatch flags a CN sentence with no terminal punctuation", () => {
  assert.match(punctuationMismatch("这是一只狗", "This is a dog."), /terminal/);
});

// ── duplicateEnglishLabels ───────────────────────────────────────────────────
test("duplicateEnglishLabels groups repeated labels within a topic", () => {
  const dups = duplicateEnglishLabels([
    { english: "dog" },
    { english: "cat" },
    { english: "Dog" }, // case-insensitive match
    { english: "bird" },
  ]);
  assert.equal(dups.length, 1);
  assert.equal(dups[0].indices.length, 2);
  assert.deepEqual(dups[0].indices, [0, 2]);
});

test("duplicateEnglishLabels returns nothing when labels are unique", () => {
  assert.deepEqual(
    duplicateEnglishLabels([{ english: "a" }, { english: "b" }, { english: "c" }]),
    []
  );
});

// ── pinyin ↔ hanzi syllable alignment ────────────────────────────────────────
test("hanziCharCount counts Han-script code points only", () => {
  assert.equal(hanziCharCount("狗"), 1);
  assert.equal(hanziCharCount("对不起"), 3);
  assert.equal(hanziCharCount("一点儿"), 3);
  assert.equal(hanziCharCount("T恤"), 1);
  assert.equal(hanziCharCount("你好！"), 2);
  assert.equal(hanziCharCount(""), 0);
});

test("pinyinSyllableCount counts maximal vowel clusters", () => {
  assert.equal(pinyinSyllableCount("gǒu"), 1);
  assert.equal(pinyinSyllableCount("duì bu qǐ"), 3);
  assert.equal(pinyinSyllableCount("tùzi"), 2);
  assert.equal(pinyinSyllableCount("péngyou"), 2);
  assert.equal(pinyinSyllableCount("xī'ān"), 2);
  assert.equal(pinyinSyllableCount("nǚ'ér"), 2);
  assert.equal(pinyinSyllableCount("yìdiǎnr"), 2);
});

test("syllableCountMismatch aligns pinyin syllables to hanzi characters", () => {
  // Matching counts → null.
  assert.equal(syllableCountMismatch("狗", "gǒu"), null);
  assert.equal(syllableCountMismatch("朋友", "péngyou"), null);
  // Genuine mismatch → message naming both counts.
  const msg = syllableCountMismatch("我们", "wǒ");
  assert.match(msg, /1 syllable\b/);
  assert.match(msg, /2 characters\b/);
  // Erhua contraction is exempt.
  assert.equal(syllableCountMismatch("一点儿", "yìdiǎnr"), null);
  // A genuine erhua mismatch is still flagged.
  assert.match(syllableCountMismatch("一点儿", "yì"), /syllable/);
  // Empty / missing inputs → null (structural checks handle those).
  assert.equal(syllableCountMismatch("", "gǒu"), null);
  assert.equal(syllableCountMismatch("狗", ""), null);
  assert.equal(syllableCountMismatch(undefined, undefined), null);
});

test("pinyinSyllableCount matches tonesOf across the whole shipped dataset", () => {
  for (const topic of rawData.topics) {
    for (const item of topic.items) {
      assert.equal(
        pinyinSyllableCount(item.pinyin),
        tonesOf(item.pinyin).length,
        `syllable counter drifted from tonesOf() on "${item.pinyin}"`
      );
    }
  }
});

test("collectQualityWarnings reports a syllable-count mismatch once, located", () => {
  const bad = [
    {
      slug: "counts",
      items: [{ hanzi: "我们", pinyin: "wǒ", english: "we", sentences: [] }],
    },
  ];
  const warnings = collectQualityWarnings(bad).filter((w) => /splits into/.test(w));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^topic "counts" item\[0\]:/);
});

// ── collectQualityWarnings (roll-up) ─────────────────────────────────────────
test("collectQualityWarnings is clean on the shipped dataset", () => {
  assert.deepEqual(collectQualityWarnings(rawData.topics), []);
});

test("collectQualityWarnings reports actionable, located findings on bad data", () => {
  const bad = [
    {
      slug: "bad-topic",
      items: [
        {
          english: "dog",
          sentences: [
            { cn: "这是一只狗。", en: "He paid with an US dollar." },
            { cn: "你好吗？", en: "Hello." }, // question mismatch
          ],
        },
        {
          english: "Dog", // duplicate label
          sentences: [{ cn: "我们要买一些", en: "We need to buy the" }], // cutoff + cn no terminal
        },
      ],
    },
  ];
  const warnings = collectQualityWarnings(bad);
  // Every finding names the topic slug and a field locus.
  for (const w of warnings) {
    assert.match(w, /^topic "bad-topic" /);
  }
  assert.ok(warnings.some((w) => /duplicate English label/i.test(w)));
  assert.ok(warnings.some((w) => /article/i.test(w)));
  assert.ok(warnings.some((w) => /question/i.test(w)));
  assert.ok(warnings.some((w) => /dangling|terminal/i.test(w)));
});

test("collectQualityWarnings only flags missing terminal punctuation when the corpus mostly has it", () => {
  // A corpus where NO sentence has terminal punctuation must not be drowned in
  // missing-terminal warnings (majority rule).
  const noTerminals = [
    {
      slug: "styleless",
      items: [
        { english: "a", sentences: [{ cn: "甲。", en: "alpha" }] },
        { english: "b", sentences: [{ cn: "乙。", en: "beta" }] },
      ],
    },
  ];
  const warnings = collectQualityWarnings(noTerminals);
  assert.equal(warnings.filter((w) => /missing terminal punctuation/i.test(w)).length, 0);
});
