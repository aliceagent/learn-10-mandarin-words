import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  MAX_CONNECTIONS_PER_CHAR,
  hanziChars,
  topicCharConnections,
} from "../src/lib/connections-logic.ts";

const topics = rawData.topics;

// ── Synthetic fixtures ───────────────────────────────────────────────────────
// topicCharConnections only reads slug/titleEn and each item's hanzi/pinyin/
// english, so minimal shapes are enough. Pinyin/english are unused by the logic
// but kept realistic.
const item = (hanzi, pinyin = "x", english = "x") => ({ hanzi, pinyin, english });
const topic = (slug, items) => ({ slug, titleEn: slug, titleCn: "标题", category: slug, categorySlug: slug, videoPath: "", items });

// ── 1. hanziChars: distinct CJK in order, punctuation/latin/space dropped ─────
test("hanziChars extracts distinct CJK chars in order and drops non-hanzi", () => {
  assert.deepEqual(hanziChars("谢谢！"), ["谢"]);
  assert.deepEqual(hanziChars("你好，世界"), ["你", "好", "世", "界"]);
  assert.deepEqual(hanziChars("A茶 B茶几"), ["茶", "几"]);
  assert.deepEqual(hanziChars("！？，。 abc 123"), []);
  assert.deepEqual(hanziChars(""), []);
});

// ── 2. Identical-hanzi words are never connections (self + cross-topic dupes) ──
test("identical-hanzi words are excluded and connections are deduped by hanzi", () => {
  const fixture = [
    topic("drinks", [item("奶茶", "nai cha", "milk tea"), item("绿茶", "lu cha", "green tea")]),
    topic("tea", [item("奶茶", "nai cha", "milk tea"), item("茶几", "cha ji", "tea table")]),
  ];
  const map = topicCharConnections(fixture, fixture[0]);

  // The 奶茶 card: 奶 has no other word; 茶 links to 绿茶, 茶几 — but never the
  // other topic's 奶茶 (identical hanzi), and each distinct hanzi appears once.
  const naicha = map["drinks:奶茶"];
  const teaGroup = naicha.find((g) => g.char === "茶");
  const hanziList = teaGroup.words.map((w) => w.hanzi);
  assert.ok(!hanziList.includes("奶茶"), "identical hanzi never a connection");
  assert.equal(new Set(hanziList).size, hanziList.length, "no duplicate hanzi");
  assert.deepEqual(hanziList.sort(), ["绿茶", "茶几"]);
});

// ── 3. Per-group cap with an accurate uncapped totalCount ─────────────────────
test("groups cap at MAX_CONNECTIONS_PER_CHAR while totalCount stays uncapped", () => {
  // 木 appears in 6 distinct words across two topics; the viewed word is one of
  // them, so there are 5 connections → words capped at 4, totalCount 5.
  const fixture = [
    topic("a", [item("木"), item("木头"), item("木马"), item("树木")]),
    topic("b", [item("木门"), item("木船")]),
  ];
  const map = topicCharConnections(fixture, fixture[0]);
  const group = map["a:木"].find((g) => g.char === "木");
  assert.equal(group.words.length, MAX_CONNECTIONS_PER_CHAR);
  assert.equal(group.words.length, 4);
  assert.equal(group.totalCount, 5);
});

// ── 4. Cross-topic connections sort before same-topic; order stable per half ──
test("cross-topic connections come first, dataset order preserved within each half", () => {
  const fixture = [
    topic("home", [item("茶"), item("绿茶"), item("红茶")]), // viewing 茶; same-topic: 绿茶, 红茶
    topic("away", [item("茶几"), item("茶馆")]), //                cross-topic: 茶几, 茶馆
  ];
  const map = topicCharConnections(fixture, fixture[0]);
  const group = map["home:茶"].find((g) => g.char === "茶");
  const flags = group.words.map((w) => w.sameTopic);
  // Cross-topic (false) precede same-topic (true).
  assert.deepEqual(
    group.words.map((w) => w.hanzi),
    ["茶几", "茶馆", "绿茶", "红茶"],
  );
  assert.deepEqual(flags, [false, false, true, true]);
});

// ── 5. Charless / connectionless words are omitted from the record ────────────
test("words with no shared-character connections are absent from the record", () => {
  const fixture = [
    topic("a", [item("茶"), item("绿茶")]), // 茶 shared; 绿 unique
    topic("b", [item("狗")]), //             nothing shared with topic a
  ];
  const map = topicCharConnections(fixture, fixture[1]);
  assert.deepEqual(Object.keys(map), [], "the lone 狗 word has no connections");

  const mapA = topicCharConnections(fixture, fixture[0]);
  // 绿茶 connects via 茶; the 绿 char has no other occurrence, so only a 茶 group.
  assert.deepEqual(
    mapA["a:绿茶"].map((g) => g.char),
    ["茶"],
  );
});

// ── 6. Record keys are canonical wordKeys (`slug:hanzi`) ──────────────────────
test("record keys are canonical `${slug}:${hanzi}` wordKeys", () => {
  const fixture = [topic("s", [item("茶"), item("绿茶")])];
  const map = topicCharConnections(fixture, fixture[0]);
  for (const key of Object.keys(map)) {
    const [slug, hanzi] = key.split(":");
    assert.equal(slug, "s");
    assert.ok(fixture[0].items.some((it) => it.hanzi === hanzi), `${hanzi} is a real item`);
  }
});

// ── Real-dataset invariants ──────────────────────────────────────────────────

// 7. Backlog scenario: ten-types-of-drinks 茶 links out to ten-types-of-tea.
test("the ten-types-of-drinks 茶 word has a rich 茶 group referencing ten-types-of-tea", () => {
  const drinks = topics.find((t) => t.slug === "ten-types-of-drinks");
  assert.ok(drinks, "ten-types-of-drinks exists");
  const map = topicCharConnections(topics, drinks);
  const teaWord = drinks.items.find((it) => it.hanzi === "茶");
  assert.ok(teaWord, "ten-types-of-drinks contains 茶");
  const group = map["ten-types-of-drinks:茶"].find((g) => g.char === "茶");
  assert.ok(group, "a 茶 connection group exists");
  assert.ok(group.totalCount >= 10, `expected ≥10 茶 connections, got ${group.totalCount}`);
  assert.ok(
    group.words.some((w) => w.topicSlug === "ten-types-of-tea"),
    "connections reach ten-types-of-tea",
  );
  assert.ok(group.words.length <= MAX_CONNECTIONS_PER_CHAR);
});

// 8. Every dataset item yields at least one CJK character.
test("hanziChars is non-empty for all dataset items", () => {
  let count = 0;
  for (const t of topics) {
    for (const it of t.items) {
      count += 1;
      assert.ok(hanziChars(it.hanzi).length > 0, `${t.slug}:${it.hanzi} has a CJK char`);
    }
  }
  assert.ok(count >= 1000, `sanity: expected ~1020 items, saw ${count}`);
});

// 9. Every connection references a real dataset word and no group exceeds the cap.
test("every connection maps to an existing (topicSlug, hanzi) and groups respect the cap", () => {
  const wordSet = new Set(topics.flatMap((t) => t.items.map((it) => `${t.slug}:${it.hanzi}`)));
  const slugSet = new Set(topics.map((t) => t.slug));
  for (const t of topics) {
    const map = topicCharConnections(topics, t);
    for (const [key, groups] of Object.entries(map)) {
      const currentHanzi = key.slice(key.indexOf(":") + 1);
      for (const group of groups) {
        assert.ok(group.words.length <= MAX_CONNECTIONS_PER_CHAR, "group within cap");
        assert.ok(group.totalCount >= group.words.length, "totalCount ≥ shown");
        const shownHanzi = group.words.map((w) => w.hanzi);
        assert.equal(new Set(shownHanzi).size, shownHanzi.length, "no duplicate hanzi in a group");
        for (const w of group.words) {
          assert.notEqual(w.hanzi, currentHanzi, "a word is never its own connection");
          assert.ok(w.hanzi.includes(group.char), "connection actually contains the shared char");
          assert.ok(slugSet.has(w.topicSlug), `${w.topicSlug} is a real topic`);
          assert.ok(wordSet.has(`${w.topicSlug}:${w.hanzi}`), `${w.topicSlug}:${w.hanzi} exists`);
        }
      }
    }
  }
});
