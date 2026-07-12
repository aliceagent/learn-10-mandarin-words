import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import { bareSyllables, toneOfSyllable, tonesOf, stripToneMarks } from "../src/lib/pinyin.ts";

test("tone-marked vowels map to their tone number", () => {
  assert.equal(toneOfSyllable("mā"), 1);
  assert.equal(toneOfSyllable("má"), 2);
  assert.equal(toneOfSyllable("mǎ"), 3);
  assert.equal(toneOfSyllable("mà"), 4);
  // Every marked vowel across all five vowel groups.
  assert.equal(toneOfSyllable("bā"), 1);
  assert.equal(toneOfSyllable("bié"), 2);
  assert.equal(toneOfSyllable("hǎo"), 3);
  assert.equal(toneOfSyllable("wò"), 4);
  assert.equal(toneOfSyllable("lǜ"), 4); // ü group
  assert.equal(toneOfSyllable("nǚ"), 3); // ü group
});

test("neutral syllables (no tone mark) return 5", () => {
  assert.equal(toneOfSyllable("ma"), 5);
  assert.equal(toneOfSyllable("zi"), 5);
  assert.equal(toneOfSyllable("le"), 5);
  assert.deepEqual(tonesOf("ma"), [5]);
});

test("tonesOf handles space-separated multi-syllable phrases", () => {
  assert.deepEqual(tonesOf("duì bu qǐ"), [4, 5, 3]); // 对不起
  assert.deepEqual(tonesOf("bù hǎo yì si"), [4, 3, 4, 5]); // 不好意思
  assert.deepEqual(tonesOf("xīn nián kuài lè"), [1, 2, 4, 4]); // 新年快乐
});

test("tonesOf handles concatenated (separator-free) words", () => {
  assert.deepEqual(tonesOf("tùzi"), [4, 5]); // 兔子, neutral 子
  assert.deepEqual(tonesOf("jīnyú"), [1, 2]); // 金鱼
  assert.deepEqual(tonesOf("xiǎozhū"), [3, 1]); // 小猪
  assert.deepEqual(tonesOf("péngyou"), [2, 5]); // 朋友, neutral 友
});

test("tonesOf handles hyphen and apostrophe separators", () => {
  assert.deepEqual(tonesOf("xī-ān"), [1, 1]); // 西安
  assert.deepEqual(tonesOf("nǚ'ér"), [3, 2]); // 女儿
});

test("tonesOf handles ü / v and mixed separators", () => {
  assert.deepEqual(tonesOf("lǜsè"), [4, 4]); // 绿色
  // ü written as v is still a vowel; unmarked → neutral.
  assert.deepEqual(tonesOf("nv"), [5]);
});

test("stripToneMarks removes marks but keeps base letters and ü", () => {
  assert.equal(stripToneMarks("nǐ hǎo"), "ni hao");
  assert.equal(stripToneMarks("lǜsè"), "lüse");
  assert.equal(stripToneMarks("tùzi"), "tuzi");
});

test("bareSyllables: single syllable strips its tone mark", () => {
  assert.deepEqual(bareSyllables("gǒu", 1), ["gou"]);
  assert.deepEqual(bareSyllables("mā", 1), ["ma"]);
});

test("bareSyllables: splits a separated multi-syllable word into bare chunks", () => {
  assert.deepEqual(bareSyllables("nǐ hǎo", 2), ["ni", "hao"]);
  assert.deepEqual(bareSyllables("duì bu qǐ", 3), ["dui", "bu", "qi"]);
  // Hyphen / middot / apostrophe separators split too.
  assert.deepEqual(bareSyllables("xī-ān", 2), ["xi", "an"]);
});

test("bareSyllables: ü is preserved (as ü) when stripping tones", () => {
  assert.deepEqual(bareSyllables("lǜ", 1), ["lü"]);
});

test("bareSyllables: falls back to the whole bare word when the split count disagrees", () => {
  // Concatenated (no separators) → one chunk, but count says 2 → whole word.
  assert.deepEqual(bareSyllables("tùzi", 2), ["tuzi"]);
  // Too many separated chunks for the requested count → whole word.
  assert.deepEqual(bareSyllables("nǐ hǎo", 3), ["ni hao"]);
});

test("tone count matches syllable count for real dataset pinyin", () => {
  // Count hanzi characters (each is one syllable) and assert tonesOf agrees.
  const cjk = /\p{Script=Han}/u;
  let checked = 0;
  for (const topic of rawData.topics) {
    for (const item of topic.items) {
      const syllables = [...item.hanzi].filter((c) => cjk.test(c)).length;
      const tones = tonesOf(item.pinyin);
      assert.equal(
        tones.length,
        syllables,
        `${item.hanzi} (${item.pinyin}) → ${tones.length} tones for ${syllables} hanzi`,
      );
      for (const t of tones) assert.ok(t >= 1 && t <= 5);
      checked++;
    }
  }
  assert.equal(checked, 1080);
});
