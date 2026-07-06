import test from "node:test";
import assert from "node:assert/strict";

import {
  COMEBACK_DECK_SIZE,
  LAPSE_THRESHOLD_DAYS,
  comebackDeck,
  daysSinceLastStudy,
  isLapsed,
  lastStudiedDay,
} from "../src/lib/comeback-logic.ts";
import { MASTERED_INTERVAL_DAYS } from "../src/lib/progress-logic.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Minimal structural topics (slug + titleEn + items with hanzi/pinyin/english),
// exactly what comebackDeck reads. Two topics so wordKeys are distinct per topic.
const topics = [
  {
    slug: "a",
    titleEn: "Topic A",
    items: [
      { hanzi: "书", pinyin: "shū", english: "book" },
      { hanzi: "树", pinyin: "shù", english: "tree" },
      { hanzi: "人", pinyin: "rén", english: "person" },
    ],
  },
  {
    slug: "b",
    titleEn: "Topic B",
    items: [
      { hanzi: "水", pinyin: "shuǐ", english: "water" },
      { hanzi: "火", pinyin: "huǒ", english: "fire" },
      { hanzi: "山", pinyin: "shān", english: "mountain" },
    ],
  },
];

// Build a flashcard stat with only the fields comebackDeck reads meaningfully.
function stat({ intervalDays = 1, reviewCount = 1, lapses = 0, dueAt = "2099-01-01T00:00:00.000Z" } = {}) {
  return { intervalDays, ease: 2.5, dueAt, reviewCount, lapses };
}

// ── lastStudiedDay ────────────────────────────────────────────────────────────

test("lastStudiedDay: empty is null; picks the max; drops malformed entries", () => {
  assert.equal(lastStudiedDay([]), null);
  assert.equal(lastStudiedDay(["2026-06-01", "2026-07-06", "2026-06-30"]), "2026-07-06");
  // Order-independent (unsorted input) and malformed strings ignored.
  assert.equal(lastStudiedDay(["not-a-date", "2026-01-05", "???"]), "2026-01-05");
  assert.equal(lastStudiedDay(["nope", ""]), null);
});

// ── daysSinceLastStudy ────────────────────────────────────────────────────────

test("daysSinceLastStudy: exact whole-day math against an injectable today", () => {
  assert.equal(daysSinceLastStudy(["2026-06-29"], "2026-07-06"), 7);
  assert.equal(daysSinceLastStudy(["2026-07-06"], "2026-07-06"), 0);
  assert.equal(daysSinceLastStudy(["2026-07-05"], "2026-07-06"), 1);
});

test("daysSinceLastStudy: never studied is null; a future-dated entry clamps to 0", () => {
  assert.equal(daysSinceLastStudy([], "2026-07-06"), null);
  assert.equal(daysSinceLastStudy(["garbage"], "2026-07-06"), null);
  assert.equal(daysSinceLastStudy(["2026-07-20"], "2026-07-06"), 0);
});

// ── isLapsed ──────────────────────────────────────────────────────────────────

test("isLapsed: boundary at exactly LAPSE_THRESHOLD_DAYS", () => {
  assert.equal(LAPSE_THRESHOLD_DAYS, 7);
  // 6 days away → not lapsed; exactly 7 → lapsed; 30 → lapsed.
  assert.equal(isLapsed(["2026-06-30"], "2026-07-06"), false); // 6 days
  assert.equal(isLapsed(["2026-06-29"], "2026-07-06"), true); // 7 days
  assert.equal(isLapsed(["2026-06-06"], "2026-07-06"), true); // 30 days
});

test("isLapsed: never-studied and empty are never lapsed", () => {
  assert.equal(isLapsed([], "2026-07-06"), false);
  assert.equal(isLapsed(["not-a-day"], "2026-07-06"), false);
});

// ── comebackDeck ──────────────────────────────────────────────────────────────

test("comebackDeck: mastered-only when enough exist, strongest-first with stable tiebreak", () => {
  const stats = {
    "a:书": stat({ intervalDays: 30 }),
    "a:树": stat({ intervalDays: 10 }),
    "a:人": stat({ intervalDays: 8 }),
    "b:水": stat({ intervalDays: 8 }), // ties a:人 on interval → key ascending wins
    "b:火": stat({ intervalDays: 20 }),
  };
  const deck = comebackDeck(topics, stats);
  assert.equal(deck.length, COMEBACK_DECK_SIZE);
  assert.deepEqual(
    deck.map((c) => c.key),
    ["a:书", "b:火", "a:树", "a:人", "b:水"],
  );
  // Emits full DueCard display records off the topic/item + stat.
  assert.equal(deck[0].hanzi, "书");
  assert.equal(deck[0].pinyin, "shū");
  assert.equal(deck[0].english, "book");
  assert.equal(deck[0].topicSlug, "a");
  assert.equal(deck[0].topicTitle, "Topic A");
  assert.equal(deck[0].intervalDays, 30);
  assert.equal(deck[0].lapses, 0);
});

test("comebackDeck: tops up with studied-but-unmastered words when mastered < limit", () => {
  const stats = {
    "a:书": stat({ intervalDays: 30 }), // mastered
    "a:树": stat({ intervalDays: 3, reviewCount: 4 }), // studied, not mastered
    "a:人": stat({ intervalDays: 1, reviewCount: 2 }), // studied, not mastered
    "b:水": stat({ intervalDays: 0, reviewCount: 0 }), // never actually reviewed → excluded
  };
  const deck = comebackDeck(topics, stats);
  // Mastered first, then studied by interval desc; the reviewCount 0 word is out.
  assert.deepEqual(
    deck.map((c) => c.key),
    ["a:书", "a:树", "a:人"],
  );
});

test("comebackDeck: mastered words come first regardless of dueAt (ignores due date)", () => {
  const stats = {
    // Mastered but not due for a month — still included, and still first.
    "a:书": stat({ intervalDays: MASTERED_INTERVAL_DAYS, dueAt: "2099-12-31T00:00:00.000Z" }),
    "a:树": stat({ intervalDays: 2, reviewCount: 5, dueAt: "2000-01-01T00:00:00.000Z" }),
  };
  const deck = comebackDeck(topics, stats);
  assert.deepEqual(deck.map((c) => c.key), ["a:书", "a:树"]);
});

test("comebackDeck: empty when nothing studied, and tolerates missing stats", () => {
  assert.deepEqual(comebackDeck(topics, {}), []);
  // Only one word has a stat; the rest are simply absent — no throw.
  const deck = comebackDeck(topics, { "b:山": stat({ intervalDays: 12 }) });
  assert.deepEqual(deck.map((c) => c.key), ["b:山"]);
});

test("comebackDeck: respects a custom limit", () => {
  const stats = {
    "a:书": stat({ intervalDays: 30 }),
    "a:树": stat({ intervalDays: 20 }),
    "a:人": stat({ intervalDays: 10 }),
  };
  assert.equal(comebackDeck(topics, stats, 2).length, 2);
  assert.deepEqual(comebackDeck(topics, stats, 2).map((c) => c.key), ["a:书", "a:树"]);
  assert.deepEqual(comebackDeck(topics, stats, 0), []);
});
