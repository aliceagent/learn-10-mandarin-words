import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  TONE_PAIRS_SESSION_SIZE,
  buildTonePairGroups,
  buildTonePairSession,
  pairBase,
  resultMessage,
} from "../src/lib/tone-pairs-logic.ts";
import { patternKey } from "../src/lib/tone-trainer-logic.ts";
import { tonesOf } from "../src/lib/pinyin.ts";
import { getTopic } from "../src/lib/data-logic.ts";

// Deterministic "shuffle" that preserves order, so targets/options are testable.
const identity = (items) => [...items];

// Build a throwaway topic from bare {hanzi,pinyin,english} rows.
function topic(slug, titleEn, rows) {
  return {
    slug,
    titleCn: slug,
    titleEn,
    category: "Test",
    categorySlug: "test",
    videoPath: "",
    items: rows.map((r) => ({ ...r, sentences: [] })),
  };
}

test("pairBase strips tones, separators, and case but preserves ü", () => {
  assert.equal(pairBase("shū"), "shu");
  assert.equal(pairBase("shù"), "shu");
  assert.equal(pairBase("qì chē"), "qiche");
  assert.equal(pairBase("qíchē"), "qiche");
  assert.equal(pairBase("Bāo·zi"), "baozi");
  // ü is preserved, so lǘ and lù do NOT share a base.
  assert.notEqual(pairBase("lǘ"), pairBase("lù"));
  assert.equal(pairBase("lǘ"), "lü");
  assert.equal(pairBase("lù"), "lu");
});

test("two words with base 'shu' and distinct tones/English form one group", () => {
  const groups = buildTonePairGroups([
    topic("t", "Test", [
      { hanzi: "书", pinyin: "shū", english: "book" },
      { hanzi: "树", pinyin: "shù", english: "tree" },
    ]),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].base, "shu");
  assert.equal(groups[0].words.length, 2);
  assert.deepEqual(groups[0].words.map((w) => w.hanzi).sort(), ["书", "树"]);
  // Each member carries the derived fields.
  const book = groups[0].words.find((w) => w.hanzi === "书");
  assert.deepEqual(book.tones, [1]);
  assert.equal(book.key, "t:书");
  assert.equal(book.topicSlug, "t");
  assert.equal(book.topicTitle, "Test");
});

test("lǘ (donkey) and lù (deer) do NOT group — ü ≠ u", () => {
  const groups = buildTonePairGroups([
    topic("t", "Test", [
      { hanzi: "驴", pinyin: "lǘ", english: "donkey" },
      { hanzi: "鹿", pinyin: "lù", english: "deer" },
    ]),
  ]);
  assert.equal(groups.length, 0);
});

test("the same hanzi across two topics collapses to one member", () => {
  const groups = buildTonePairGroups([
    topic("a", "A", [{ hanzi: "书", pinyin: "shū", english: "book" }]),
    topic("b", "B", [
      { hanzi: "书", pinyin: "shū", english: "book" }, // duplicate hanzi
      { hanzi: "树", pinyin: "shù", english: "tree" },
    ]),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].words.length, 2);
  // First occurrence wins: 书 keeps topic "a"'s identity.
  const book = groups[0].words.find((w) => w.hanzi === "书");
  assert.equal(book.key, "a:书");
});

test("a same-English group (two 'star' words) is excluded", () => {
  const groups = buildTonePairGroups([
    topic("t", "Test", [
      { hanzi: "星星", pinyin: "xīngxing", english: "star" },
      { hanzi: "星形", pinyin: "xīngxíng", english: "star" },
    ]),
  ]);
  assert.equal(groups.length, 0);
});

test("a bucket whose two words share a tone pattern is excluded", () => {
  const groups = buildTonePairGroups([
    topic("t", "Test", [
      { hanzi: "妈", pinyin: "mā", english: "mother" },
      { hanzi: "抹", pinyin: "mā", english: "to wipe" }, // same tone [1]
    ]),
  ]);
  assert.equal(groups.length, 0);
});

test("buildTonePairSession respects the limit and targets are inside options", () => {
  const groups = buildTonePairGroups([
    topic("t", "Test", [
      { hanzi: "书", pinyin: "shū", english: "book" },
      { hanzi: "树", pinyin: "shù", english: "tree" },
      { hanzi: "刀", pinyin: "dāo", english: "knife" },
      { hanzi: "岛", pinyin: "dǎo", english: "island" },
      { hanzi: "鱼", pinyin: "yú", english: "fish" },
      { hanzi: "玉", pinyin: "yù", english: "jade" },
    ]),
  ]);
  assert.equal(groups.length, 3);
  const rounds = buildTonePairSession(groups, identity, 2);
  assert.equal(rounds.length, 2);
  for (const round of rounds) {
    // target ∈ options; options are exactly the group's members.
    assert.ok(round.options.includes(round.target));
    assert.equal(round.options.length, 2);
    const keys = round.options.map((w) => w.key);
    assert.equal(new Set(keys).size, keys.length, "option keys are unique");
    // Every option shares the round's base.
    for (const opt of round.options) assert.equal(pairBase(opt.pinyin), round.base);
    // With identity shuffle, the target is the first option.
    assert.equal(round.target, round.options[0]);
  }
});

test("buildTonePairSession defaults limit to TONE_PAIRS_SESSION_SIZE", () => {
  assert.equal(TONE_PAIRS_SESSION_SIZE, 10);
  const rounds = buildTonePairSession([], identity);
  assert.equal(rounds.length, 0);
});

test("resultMessage varies by score band", () => {
  assert.match(resultMessage(10, 10), /Perfect/);
  assert.match(resultMessage(9, 10), /Sharp ears/);
  assert.match(resultMessage(4, 10), /tricky/);
  assert.match(resultMessage(0, 0), /tricky/);
});

// ── Dataset invariants (the real topics.json) ─────────────────────────────────

test("the real dataset yields a meaningfully populated set of tone pairs", () => {
  const groups = buildTonePairGroups(rawData.topics);
  assert.ok(groups.length >= 5, `expected ≥5 groups, got ${groups.length}`);

  // Groups are sorted by base and each base is unique.
  const bases = groups.map((g) => g.base);
  assert.deepEqual(bases, [...bases].sort());
  assert.equal(new Set(bases).size, bases.length);

  for (const group of groups) {
    assert.ok(group.words.length >= 2);
    const patterns = new Set();
    const glosses = new Set();
    for (const word of group.words) {
      // Shared base.
      assert.equal(pairBase(word.pinyin), group.base);
      // Derived tones match the pinyin.
      assert.deepEqual(word.tones, tonesOf(word.pinyin));
      // Pairwise-distinct tone pattern and English.
      const pk = patternKey(word.tones);
      const eng = word.english.toLowerCase();
      assert.ok(!patterns.has(pk), `duplicate tone pattern in ${group.base}`);
      assert.ok(!glosses.has(eng), `duplicate gloss in ${group.base}`);
      patterns.add(pk);
      glosses.add(eng);
      // Every key resolves to a real topic + hanzi.
      const [slug, hanzi] = [word.topicSlug, word.hanzi];
      const t = getTopic(rawData.topics, slug);
      assert.ok(t, `topic ${slug} exists`);
      assert.ok(t.items.some((it) => it.hanzi === hanzi), `${hanzi} lives in ${slug}`);
      assert.equal(word.key, `${slug}:${hanzi}`);
    }
  }
});

test("the 'shu' minimal pair (书/树) exists in the real dataset", () => {
  const groups = buildTonePairGroups(rawData.topics);
  const shu = groups.find((g) => g.base === "shu");
  assert.ok(shu, "'shu' group exists");
  const hanzi = shu.words.map((w) => w.hanzi);
  assert.ok(hanzi.includes("书"));
  assert.ok(hanzi.includes("树"));
});

test("no 'star' (星星/星形) group survives filtering in the real dataset", () => {
  const groups = buildTonePairGroups(rawData.topics);
  const xing = groups.find((g) => g.base === "xingxing");
  assert.equal(xing, undefined);
});
