import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  expectedSyllables,
  parseTypedPinyin,
  gradeTypedPinyin,
  toneNumberForm,
} from "../src/lib/typing-logic.ts";

// ── expectedSyllables ─────────────────────────────────────────────────────────

test("expectedSyllables splits a separated phrase with correct tones and letters", () => {
  const syl = expectedSyllables("duì bu qǐ");
  assert.equal(syl.length, 3);
  assert.deepEqual(syl.map((s) => s.tone), [4, 5, 3]);
  assert.deepEqual(syl.map((s) => s.letters), ["dui", "bu", "qi"]);
});

test("expectedSyllables segments concatenated pinyin (neutral final tone)", () => {
  const syl = expectedSyllables("tùzi");
  assert.deepEqual(syl.map((s) => s.tone), [4, 5]);
  assert.deepEqual(syl.map((s) => s.letters), ["tu", "zi"]);
});

test("expectedSyllables normalises ü to v", () => {
  assert.deepEqual(expectedSyllables("nǚ"), [{ letters: "nv", tone: 3 }]);
  assert.deepEqual(expectedSyllables("lǜsè").map((s) => s.letters), ["lv", "se"]);
});

// ── parseTypedPinyin ──────────────────────────────────────────────────────────

test("parseTypedPinyin: whitespace-only and letter-less input yields []", () => {
  assert.deepEqual(parseTypedPinyin(""), []);
  assert.deepEqual(parseTypedPinyin("   "), []);
  assert.deepEqual(parseTypedPinyin("3"), []);
});

test("parseTypedPinyin: tone marks set tones, bare letters leave them null", () => {
  assert.deepEqual(parseTypedPinyin("gǒu"), [{ letters: "gou", tone: 3 }]);
  assert.deepEqual(parseTypedPinyin("gou"), [{ letters: "gou", tone: null }]);
  assert.deepEqual(parseTypedPinyin("gou3"), [{ letters: "gou", tone: 3 }]);
});

test("parseTypedPinyin: 0 is neutral, uppercase and u:/v map to ü→v", () => {
  assert.deepEqual(parseTypedPinyin("GOU3"), [{ letters: "gou", tone: 3 }]);
  assert.deepEqual(parseTypedPinyin("nv3"), [{ letters: "nv", tone: 3 }]);
  assert.deepEqual(parseTypedPinyin("nu:3"), [{ letters: "nv", tone: 3 }]);
  assert.deepEqual(parseTypedPinyin("le0"), [{ letters: "le", tone: 5 }]);
});

test("parseTypedPinyin: digits and separators terminate syllables", () => {
  assert.deepEqual(parseTypedPinyin("tu4zi5"), [
    { letters: "tu", tone: 4 },
    { letters: "zi", tone: 5 },
  ]);
  assert.deepEqual(parseTypedPinyin("tu zi"), [
    { letters: "tu", tone: null },
    { letters: "zi", tone: null },
  ]);
  assert.deepEqual(parseTypedPinyin("dui4bu5qi3"), [
    { letters: "dui", tone: 4 },
    { letters: "bu", tone: 5 },
    { letters: "qi", tone: 3 },
  ]);
});

test("parseTypedPinyin: an unmarked syllable is neutral only when marks appear elsewhere", () => {
  // Marks present → the unmarked middle syllable reads as neutral (5).
  assert.deepEqual(parseTypedPinyin("duì bu qǐ"), [
    { letters: "dui", tone: 4 },
    { letters: "bu", tone: 5 },
    { letters: "qi", tone: 3 },
  ]);
  // No marks anywhere → the digit-less syllable stays unspecified (null).
  assert.deepEqual(parseTypedPinyin("dui4 bu qi3"), [
    { letters: "dui", tone: 4 },
    { letters: "bu", tone: null },
    { letters: "qi", tone: 3 },
  ]);
});

// ── gradeTypedPinyin: single syllable ─────────────────────────────────────────

test("gradeTypedPinyin: perfect answers in every notation are correct", () => {
  assert.equal(gradeTypedPinyin("gǒu", "gǒu"), "correct");
  assert.equal(gradeTypedPinyin("gou3", "gǒu"), "correct");
  assert.equal(gradeTypedPinyin("GOU3", "gǒu"), "correct");
});

test("gradeTypedPinyin: right letters, missing/wrong tone is tones-off", () => {
  assert.equal(gradeTypedPinyin("gou", "gǒu"), "tones-off");
  assert.equal(gradeTypedPinyin("gou2", "gǒu"), "tones-off");
});

test("gradeTypedPinyin: wrong letters is incorrect", () => {
  assert.equal(gradeTypedPinyin("mao", "gǒu"), "incorrect");
});

test("gradeTypedPinyin: ü handling distinguishes v from u", () => {
  assert.equal(gradeTypedPinyin("nv3", "nǚ"), "correct");
  assert.equal(gradeTypedPinyin("nu:3", "nǚ"), "correct");
  assert.equal(gradeTypedPinyin("nu3", "nǚ"), "incorrect");
});

// ── gradeTypedPinyin: multi-syllable ──────────────────────────────────────────

test("gradeTypedPinyin: multi-syllable tone-number grading", () => {
  assert.equal(gradeTypedPinyin("tu4zi5", "tùzi"), "correct");
  assert.equal(gradeTypedPinyin("tu4zi", "tùzi"), "tones-off");
  assert.equal(gradeTypedPinyin("tuzi", "tùzi"), "tones-off");
  assert.equal(gradeTypedPinyin("tu zi", "tùzi"), "tones-off");
  assert.equal(gradeTypedPinyin("zi4tu", "tùzi"), "incorrect");
});

test("gradeTypedPinyin: separators and apostrophes are ignored for letters", () => {
  assert.equal(gradeTypedPinyin("dui4bu5qi3", "duì bu qǐ"), "correct");
  assert.equal(gradeTypedPinyin("dui4 bu qi3", "duì bu qǐ"), "tones-off");
});

// ── toneNumberForm ────────────────────────────────────────────────────────────

test("toneNumberForm renders tone numbers (neutral as 5)", () => {
  assert.equal(toneNumberForm("gǒu"), "gou3");
  assert.equal(toneNumberForm("tùzi"), "tu4zi5");
  assert.equal(toneNumberForm("duì bu qǐ"), "dui4bu5qi3");
});

// ── Dataset round-trip sweep ──────────────────────────────────────────────────

test("gradeTypedPinyin(toneNumberForm(p), p) === 'correct' for the first 50 dataset words", () => {
  const words = rawData.topics.flatMap((t) => t.items).slice(0, 50);
  assert.equal(words.length, 50);
  for (const item of words) {
    const typed = toneNumberForm(item.pinyin);
    assert.equal(
      gradeTypedPinyin(typed, item.pinyin),
      "correct",
      `${item.hanzi} (${item.pinyin}) → typed "${typed}"`,
    );
  }
});
