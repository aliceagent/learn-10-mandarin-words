import test from "node:test";
import assert from "node:assert/strict";

import {
  SHARE_CARD_COLORS,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  buildShareText,
  scoreEmojiBar,
  scoreFraction,
  shareTitle,
  wrapText,
} from "../src/lib/share-card-logic.ts";

// Fixture words with tone-marked pinyin, so "hanzi followed by pinyin" is
// verifiable in the text snippet.
const WORDS = [
  { hanzi: "狗", pinyin: "gǒu", english: "dog" },
  { hanzi: "猫", pinyin: "māo", english: "cat" },
  { hanzi: "鱼", pinyin: "yú", english: "fish" },
];

const HOST = "learn-10-mandarin-words.vercel.app";

// ─── Layout constants ─────────────────────────────────────────────────────────

test("card is a 1080×1350 (4:5) portrait", () => {
  assert.equal(SHARE_CARD_WIDTH, 1080);
  assert.equal(SHARE_CARD_HEIGHT, 1350);
  assert.equal(SHARE_CARD_HEIGHT / SHARE_CARD_WIDTH, 1.25);
});

test("tone palette has five colors matching globals.css", () => {
  assert.deepEqual(SHARE_CARD_COLORS.tone, ["#f87171", "#4ade80", "#60a5fa", "#c084fc", "#94a3b8"]);
});

// ─── scoreEmojiBar ────────────────────────────────────────────────────────────

test("scoreEmojiBar: none / all / mixed", () => {
  assert.equal(scoreEmojiBar(0, 5), "🟥🟥🟥🟥🟥");
  assert.equal(scoreEmojiBar(5, 5), "🟩🟩🟩🟩🟩");
  assert.equal(scoreEmojiBar(8, 10), "🟩🟩🟩🟩🟩🟩🟩🟩🟥🟥");
});

test("scoreEmojiBar: never emits for a non-positive total", () => {
  assert.equal(scoreEmojiBar(0, 0), "");
  assert.equal(scoreEmojiBar(3, 0), "");
  assert.equal(scoreEmojiBar(1, -4), "");
});

test("scoreEmojiBar: caps at maxSquares and suffixes the true total", () => {
  const bar = scoreEmojiBar(15, 20); // default cap 10 → proportional 15/20 = 7.5 → 8 greens
  const squares = [...bar].filter((ch) => ch === "🟩" || ch === "🟥");
  assert.equal(squares.length, 10);
  assert.equal(squares.filter((ch) => ch === "🟩").length, 8);
  assert.match(bar, /×20$/);
});

test("scoreEmojiBar: honors a custom maxSquares", () => {
  assert.equal(scoreEmojiBar(2, 4, 4), "🟩🟩🟥🟥");
  // score clamped to total so a corrupt over-count can't add tiles
  assert.equal(scoreEmojiBar(99, 4, 4), "🟩🟩🟩🟩");
});

// ─── scoreFraction ────────────────────────────────────────────────────────────

test("scoreFraction: practice is score/total; review is (total-again)/total", () => {
  assert.equal(scoreFraction({ kind: "practice", score: 8, total: 10, missed: [] }), 0.8);
  assert.equal(scoreFraction({ kind: "practice", score: 0, total: 0, missed: [] }), 0);
  assert.equal(
    scoreFraction({ kind: "review", total: 10, counts: { again: 2, hard: 0, good: 6, easy: 2 }, toughest: [] }),
    0.8,
  );
  // stats has no single fraction
  assert.equal(scoreFraction({ kind: "stats", streak: 5, reviewedWords: 3, totalWords: 100, learnedTopics: 1, daysStudied: 5 }), 0);
});

// ─── shareTitle tiers ─────────────────────────────────────────────────────────

test("shareTitle: practice tier boundaries (perfect / exactly 80% / below)", () => {
  assert.equal(shareTitle({ kind: "practice", score: 10, total: 10, missed: [] }), "Perfect round! 🎉");
  assert.equal(shareTitle({ kind: "practice", score: 8, total: 10, missed: [] }), "So close to perfect 💪");
  assert.equal(shareTitle({ kind: "practice", score: 5, total: 10, missed: [] }), "Reps in — keep going 🌱");
  assert.equal(shareTitle({ kind: "practice", score: 0, total: 10, missed: [] }), "Reps in — keep going 🌱");
});

test("shareTitle: review tier boundaries via the Again tally", () => {
  const perfect = { kind: "review", total: 6, counts: { again: 0, hard: 1, good: 4, easy: 1 }, toughest: [] };
  const almost = { kind: "review", total: 10, counts: { again: 2, hard: 0, good: 8, easy: 0 }, toughest: [] };
  const rough = { kind: "review", total: 10, counts: { again: 5, hard: 0, good: 5, easy: 0 }, toughest: [] };
  assert.equal(shareTitle(perfect), "Perfect round! 🎉");
  assert.equal(shareTitle(almost), "So close to perfect 💪");
  assert.equal(shareTitle(rough), "Reps in — keep going 🌱");
});

test("shareTitle: stats is streak-led, with a words-reviewed fallback at streak 0", () => {
  assert.equal(
    shareTitle({ kind: "stats", streak: 7, reviewedWords: 40, totalWords: 100, learnedTopics: 3, daysStudied: 9 }),
    "🔥 7-day streak",
  );
  assert.equal(
    shareTitle({ kind: "stats", streak: 0, reviewedWords: 12, totalWords: 100, learnedTopics: 1, daysStudied: 2 }),
    "12 words reviewed",
  );
});

// ─── buildShareText ───────────────────────────────────────────────────────────

test("buildShareText: practice snippet carries score, host, and pinyin after every hanzi", () => {
  const text = buildShareText({ kind: "practice", score: 8, total: 10, missed: WORDS }, HOST);
  assert.match(text, /8\/10 tricky words/);
  assert.ok(text.includes("🟩"));
  assert.ok(text.endsWith(HOST));
  assert.doesNotMatch(text, /undefined|NaN/);
  // Each featured hanzi line pairs the hanzi with its pinyin.
  for (const w of WORDS) assert.match(text, new RegExp(`${w.hanzi} ${w.pinyin} — ${w.english}`));
});

test("buildShareText: review snippet reports the grade tally and host", () => {
  const text = buildShareText(
    { kind: "review", total: 12, counts: { again: 3, hard: 2, good: 5, easy: 2 }, toughest: WORDS.slice(0, 2) },
    HOST,
  );
  assert.match(text, /Reviewed 12 cards/);
  assert.match(text, /3 again · 2 hard · 5 good · 2 easy/);
  assert.ok(text.endsWith(HOST));
  assert.doesNotMatch(text, /undefined|NaN/);
  assert.match(text, /猫 māo — cat/);
});

test("buildShareText: stats snippet carries streak, totals, and host", () => {
  const text = buildShareText(
    { kind: "stats", streak: 5, reviewedWords: 40, totalWords: 100, learnedTopics: 3, daysStudied: 9 },
    HOST,
  );
  assert.match(text, /🔥 5-day streak/);
  assert.match(text, /40\/100 words reviewed · 3 topics · 9 days studied/);
  assert.ok(text.endsWith(HOST));
  assert.doesNotMatch(text, /undefined|NaN/);
});

test("buildShareText: corrupt numeric fields never leak undefined/NaN", () => {
  const text = buildShareText(
    // Intentionally malformed values to exercise the coercion guards.
    { kind: "practice", score: Number.NaN, total: undefined, missed: [] },
    HOST,
  );
  assert.doesNotMatch(text, /undefined|NaN/);
  assert.ok(text.endsWith(HOST));
});

// ─── wrapText ─────────────────────────────────────────────────────────────────

// A deterministic fake measurer: 10px per character.
const measure = (s) => s.length * 10;

test("wrapText: empty / whitespace-only yields no lines", () => {
  assert.deepEqual(wrapText("", 100, measure), []);
  assert.deepEqual(wrapText("   ", 100, measure), []);
});

test("wrapText: greedily packs words and never exceeds width where it can", () => {
  const lines = wrapText("the quick brown fox jumps", 100, measure);
  // No packed line (more than one word) exceeds the width.
  for (const line of lines) {
    if (line.includes(" ")) assert.ok(measure(line) <= 100, `"${line}" over width`);
  }
  // Nothing is dropped: joining back yields the original words.
  assert.equal(lines.join(" "), "the quick brown fox jumps");
});

test("wrapText: a single word wider than the line still gets its own line", () => {
  const lines = wrapText("supercalifragilistic", 50, measure);
  assert.deepEqual(lines, ["supercalifragilistic"]);
});

test("wrapText: collapses runs of whitespace between words", () => {
  const lines = wrapText("a\n\nb   c", 1000, measure);
  assert.deepEqual(lines, ["a b c"]);
});
