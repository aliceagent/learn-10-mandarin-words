import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import { normalizePinyin } from "../src/lib/highlight.ts";
import { searchWords } from "../src/lib/search-logic.ts";

const topics = rawData.topics;
const slugSet = new Set(topics.map((t) => t.slug));

// ── Synthetic fixtures ───────────────────────────────────────────────────────
// searchWords only reads slug/titleEn/category/categorySlug and each item's
// hanzi/pinyin/english, so minimal shapes are enough to pin down ranking.
const item = (hanzi, pinyin, english) => ({ hanzi, pinyin, english, sentences: [] });
const topic = (slug, categorySlug, items) => ({
  slug,
  titleEn: slug,
  titleCn: "标题",
  category: categorySlug,
  categorySlug,
  videoPath: "",
  items,
});

// Re-implementation of home-app.tsx's topic haystack predicate, so test #8 can
// prove the lockstep invariant against the exact same matching logic.
function topicMatchesHome(t, query) {
  const q = normalizePinyin(query.trim());
  if (!q) return false;
  const haystack = normalizePinyin(
    [t.titleEn, t.titleCn, t.category, ...t.items.flatMap((i) => [i.hanzi, i.pinyin, i.english])].join(" "),
  );
  return haystack.includes(q);
}

// ── 1. Empty / whitespace ────────────────────────────────────────────────────
test("empty and whitespace-only queries return []", () => {
  assert.deepEqual(searchWords(topics, ""), []);
  assert.deepEqual(searchWords(topics, "   "), []);
  assert.deepEqual(searchWords(topics, "\t\n"), []);
});

// ── 2. Diacritic tolerance ───────────────────────────────────────────────────
test("toneless pinyin query matches tone-marked words, same as the diacritic form", () => {
  const toneless = searchWords(topics, "gou");
  assert.ok(toneless.length > 0, "expected at least one 'gou' match in the dataset");
  // Every result genuinely contains the normalized query in one of its fields.
  for (const r of toneless) {
    const fields = [r.hanzi, r.pinyin, r.english].map(normalizePinyin);
    assert.ok(fields.some((f) => f.includes("gou")), `${r.key} should contain "gou"`);
  }
  // The diacritic form normalizes identically, so it returns the same words.
  const toned = searchWords(topics, "gǒu");
  assert.deepEqual(toned.map((r) => r.key), toneless.map((r) => r.key));
});

// ── 3. Hanzi ranking: exact before contains ──────────────────────────────────
test("hanzi query returns matching words with exact hanzi ranked before contains", () => {
  const fixture = [
    topic("t", "cat", [
      item("热狗", "re gou", "hot dog"), // contains 狗 → rank 1
      item("狗", "gou", "dog"), //          exact 狗   → rank 0
    ]),
  ];
  const results = searchWords(fixture, "狗");
  assert.deepEqual(results.map((r) => r.hanzi), ["狗", "热狗"]);
  assert.equal(results[0].rank, 0);
  assert.equal(results[1].rank, 1);
});

// ── 4. English matches rank after pinyin matches ─────────────────────────────
test("english substring matches rank below pinyin matches for the same query", () => {
  const fixture = [
    topic("t", "cat", [
      item("河", "he", "river"), //      pinyin prefix "he" → rank 2
      item("头", "tou", "the head"), //  english contains "he" → rank 4
    ]),
  ];
  const results = searchWords(fixture, "he");
  assert.deepEqual(results.map((r) => r.english), ["river", "the head"]);
  assert.equal(results[0].rank, 2);
  assert.equal(results[1].rank, 4);
});

// ── 5. Category filter ───────────────────────────────────────────────────────
test("categorySlug option restricts results to that category", () => {
  const cat = topics[0].categorySlug;
  // A query broad enough to match words across many categories.
  const scoped = searchWords(topics, "a", { categorySlug: cat });
  assert.ok(scoped.length > 0, "expected matches within the category");
  for (const r of scoped) assert.equal(r.categorySlug, cat);

  const unscoped = searchWords(topics, "a");
  const otherCats = unscoped.filter((r) => r.categorySlug !== cat);
  assert.ok(otherCats.length > 0, "unscoped search should span multiple categories");
});

// ── 6. Key format + topic existence ──────────────────────────────────────────
test("every result key is `${topicSlug}:${hanzi}` and its topic exists", () => {
  const results = searchWords(topics, "a");
  assert.ok(results.length > 0);
  for (const r of results) {
    assert.equal(r.key, `${r.topicSlug}:${r.hanzi}`);
    assert.ok(slugSet.has(r.topicSlug), `${r.topicSlug} is a real topic`);
  }
});

// ── 7. Dedupe + stable order within a rank ───────────────────────────────────
test("results have no duplicate keys and preserve dataset order within a rank", () => {
  const results = searchWords(topics, "a");
  const keys = results.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, "no duplicate keys");

  // Ranks are non-decreasing across the sorted list.
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].rank >= results[i - 1].rank, "ranks are non-decreasing");
  }

  // Same-rank English matches keep their insertion (dataset) order.
  const fixture = [
    topic("t", "cat", [
      item("一", "yi", "an apple"),
      item("二", "er", "a banana"),
      // pinyin deliberately free of "a" so this ties at rank 4 (english
      // contains) rather than rank 3 (pinyin contains, e.g. "san").
      item("三", "wu", "an avocado"),
    ]),
  ];
  const eng = searchWords(fixture, "a");
  assert.deepEqual(eng.map((r) => r.hanzi), ["一", "二", "三"]);
  assert.ok(eng.every((r) => r.rank === 4));
});

// ── 8. Lockstep invariant with the home topic filter ─────────────────────────
test("any word result's topic also passes the home-app topic haystack predicate", () => {
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
  for (const query of ["gou", "ni", "he", "水", "a", "food"]) {
    for (const r of searchWords(topics, query)) {
      const t = topicBySlug.get(r.topicSlug);
      assert.ok(t, `${r.topicSlug} resolves`);
      assert.ok(
        topicMatchesHome(t, query),
        `topic ${r.topicSlug} must match the home filter for "${query}"`,
      );
    }
  }
});
