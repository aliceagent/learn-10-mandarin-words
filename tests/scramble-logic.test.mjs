import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  MAX_TILES,
  splitEnding,
  chunkSentence,
  buildScrambleCard,
  buildScrambleDeck,
  initialScrambleState,
  placeTile,
  returnTile,
  isComplete,
  checkArrangement,
} from "../src/lib/scramble-logic.ts";

// Fixtures mirroring the DOG/CAT/FISH style of tests/cloze-logic.test.mjs.
const DOG = {
  hanzi: "狗",
  pinyin: "gǒu",
  english: "dog",
  sentences: [
    { cn: "我有一只狗。", en: "I have a dog." },
    { cn: "那只狗很可爱。", en: "That dog is cute." },
  ],
};
const CAT = {
  hanzi: "猫",
  pinyin: "māo",
  english: "cat",
  sentences: [
    { cn: "我有一只猫。", en: "I have a cat." },
    { cn: "猫在睡觉。", en: "The cat is sleeping." },
  ],
};
const ITEMS = [DOG, CAT];

// Deterministic "shuffle" that preserves order, so card contents are testable.
const identity = (items) => [...items];
const keyFor = (item) => `pets:${item.hanzi}`;

// ── splitEnding ──────────────────────────────────────────────────────────────
test("splitEnding strips one trailing terminal-punctuation run", () => {
  assert.deepEqual(splitEnding("我有一只狗。"), { body: "我有一只狗", ending: "。" });
  assert.deepEqual(splitEnding("是你吗？"), { body: "是你吗", ending: "？" });
  assert.deepEqual(splitEnding("太好了！"), { body: "太好了", ending: "！" });
});

test("splitEnding leaves a sentence with no terminal punctuation unchanged", () => {
  assert.deepEqual(splitEnding("我有一只狗"), { body: "我有一只狗", ending: "" });
});

test("splitEnding keeps inner terminal marks in the body", () => {
  // Only the trailing run moves; the mid-sentence ？ stays in the body.
  assert.deepEqual(splitEnding("你冷不冷？我给你拿外套。"), {
    body: "你冷不冷？我给你拿外套",
    ending: "。",
  });
});

// ── chunkSentence ────────────────────────────────────────────────────────────
test("chunkSentence keeps the target hanzi atomic and joins back to the body", () => {
  const chunks = chunkSentence("我有一只狗", "狗", ["狗", "猫"]);
  assert.equal(chunks.join(""), "我有一只狗");
  assert.ok(chunks.includes("狗"), "target word is its own tile");
});

test("chunkSentence groups non-vocab runs into 2–3 char tiles", () => {
  // 我有一只 → [我有][一只]; 狗 atomic.
  assert.deepEqual(chunkSentence("我有一只狗", "狗", ["狗"]), ["我有", "一只", "狗"]);
});

test("chunkSentence merges a trailing single char into the previous group", () => {
  // 我有一 (3 chars, no vocab) → [我有][一] → merge → [我有一].
  assert.deepEqual(chunkSentence("我有一", "无", []), ["我有一"]);
});

test("chunkSentence attaches inner punctuation to the preceding chunk", () => {
  const chunks = chunkSentence("那只狗很可爱，真好", "狗", ["狗"]);
  assert.equal(chunks.join(""), "那只狗很可爱，真好");
  // No chunk starts with a punctuation mark.
  for (const c of chunks) {
    assert.ok(!/[。，、？！；：]/.test(c[0]), `chunk "${c}" must not start with punctuation`);
  }
  // The comma rides on the chunk before it.
  assert.ok(chunks.some((c) => c.endsWith("，")), "a chunk carries the trailing comma");
});

test("chunkSentence prefers the longest vocab match", () => {
  // Both 火车 and 火车站 are topic words; 火车站 must win as one atomic tile.
  const chunks = chunkSentence("我去火车站", "火车站", ["火车", "火车站"]);
  assert.ok(chunks.includes("火车站"), "longest match is atomic");
  assert.ok(!chunks.includes("火车"), "the shorter prefix is not split out");
  assert.equal(chunks.join(""), "我去火车站");
});

test("chunkSentence re-splits coarser when 2-char groups exceed MAX_TILES", () => {
  // 18 plain chars → nine 2-char tiles (> 8) → re-split at size 3 → six tiles.
  const body = "一二三四五六七八九十甲乙丙丁戊己庚辛";
  const chunks = chunkSentence(body, "无", []);
  assert.ok(chunks.length <= MAX_TILES, `got ${chunks.length} tiles`);
  assert.equal(chunks.join(""), body);
});

// ── buildScrambleCard ────────────────────────────────────────────────────────
test("buildScrambleCard: card contract with an identity shuffle", () => {
  const card = buildScrambleCard(DOG, ITEMS, keyFor, identity);
  assert.ok(card);
  // First sentence picked under identity shuffle.
  assert.equal(card.sentenceCn, "我有一只狗。");
  assert.equal(card.sentenceEn, "I have a dog.");
  assert.equal(card.body, "我有一只狗");
  assert.equal(card.ending, "。");
  assert.equal(card.hanzi, "狗");
  assert.equal(card.pinyin, "gǒu");
  assert.equal(card.english, "dog");
  assert.equal(card.key, "pets:狗");
  // Tiles are a permutation of the body's chunks and carry sequential post-shuffle
  // ids. (The joined text is rotated off the solved order — see the rotation test.)
  assert.deepEqual(
    [...card.tiles].map((t) => t.text).sort(),
    chunkSentence("我有一只狗", "狗", ["狗", "猫"]).sort(),
  );
  assert.deepEqual(card.tiles.map((t) => t.id), card.tiles.map((_, i) => i));
});

test("buildScrambleCard rotates when the shuffled order is already solved", () => {
  // Identity shuffle returns the solved order, so the card rotates by one to avoid
  // presenting a pre-solved sentence.
  const card = buildScrambleCard(DOG, ITEMS, keyFor, identity);
  assert.ok(card);
  assert.notEqual(card.tiles.map((t) => t.text).join(""), card.body);
  // Rotation preserves the multiset of tiles (still joins to body when reordered).
  assert.equal([...card.tiles].map((t) => t.text).sort().join("|"),
    chunkSentence(card.body, "狗", ["狗", "猫"]).sort().join("|"));
});

test("buildScrambleCard returns null for a sentence-less item", () => {
  const orphan = { hanzi: "龙", pinyin: "lóng", english: "dragon", sentences: [] };
  assert.equal(buildScrambleCard(orphan, ITEMS, keyFor, identity), null);
});

test("buildScrambleDeck builds one card per item", () => {
  const deck = buildScrambleDeck(ITEMS, ITEMS, keyFor, identity);
  assert.equal(deck.length, 2);
  assert.deepEqual(deck.map((c) => c.hanzi), ["狗", "猫"]);
});

// ── reducer ──────────────────────────────────────────────────────────────────
test("placeTile / returnTile round-trip and ignore no-ops", () => {
  const card = buildScrambleCard(DOG, ITEMS, keyFor, identity);
  let state = initialScrambleState();
  state = placeTile(state, card.tiles[0].id, card);
  assert.deepEqual(state.placedIds, [card.tiles[0].id]);
  // Placing the same tile again is a no-op (same reference).
  assert.equal(placeTile(state, card.tiles[0].id, card), state);
  // An unknown tile id is ignored.
  assert.equal(placeTile(state, 999, card), state);
  // Return puts it back.
  state = returnTile(state, card.tiles[0].id);
  assert.deepEqual(state.placedIds, []);
  // Returning an unplaced tile is a no-op.
  assert.equal(returnTile(state, card.tiles[0].id), state);
});

test("isComplete is true only when every tile is placed", () => {
  const card = buildScrambleCard(DOG, ITEMS, keyFor, identity);
  let state = initialScrambleState();
  for (const tile of card.tiles) {
    assert.equal(isComplete(state, card), false);
    state = placeTile(state, tile.id, card);
  }
  assert.equal(isComplete(state, card), true);
});

test("checkArrangement solves any arrangement whose text equals the body", () => {
  const card = buildScrambleCard(DOG, ITEMS, keyFor, identity);
  // Place tiles in the order that reconstructs the body (find each tile by text).
  const chunks = chunkSentence(card.body, "狗", ["狗", "猫"]);
  let state = initialScrambleState();
  const remaining = [...card.tiles];
  for (const text of chunks) {
    const idx = remaining.findIndex((t) => t.text === text);
    state = placeTile(state, remaining[idx].id, card);
    remaining.splice(idx, 1);
  }
  const result = checkArrangement(state, card);
  assert.equal(result.solved, true);
  assert.equal(result.correctPrefixTiles, card.tiles.length);
});

test("checkArrangement is join-equality — duplicate tiles can't cause a false wrong", () => {
  // A synthetic card with two identical "很" tiles; swapping them still solves.
  const card = {
    key: "k",
    hanzi: "很",
    pinyin: "hěn",
    english: "very",
    sentenceCn: "他很很好",
    sentenceEn: "test",
    body: "他很很好",
    ending: "",
    tiles: [
      { id: 0, text: "他" },
      { id: 1, text: "很" },
      { id: 2, text: "很" },
      { id: 3, text: "好" },
    ],
  };
  // Place with the two 很 tiles in swapped id order (2 before 1).
  let state = initialScrambleState();
  for (const id of [0, 2, 1, 3]) state = placeTile(state, id, card);
  const result = checkArrangement(state, card);
  assert.equal(result.solved, true, "swapped duplicate tiles still join to the body");
});

test("checkArrangement reports the correct prefix on a partial/wrong arrangement", () => {
  const card = {
    key: "k",
    hanzi: "x",
    pinyin: "x",
    english: "x",
    sentenceCn: "我有一只狗",
    sentenceEn: "test",
    body: "我有一只狗",
    ending: "",
    tiles: [
      { id: 0, text: "我有" },
      { id: 1, text: "一只" },
      { id: 2, text: "狗" },
    ],
  };
  // Correct first tile, wrong second → prefix of 1, not solved.
  let state = initialScrambleState();
  state = placeTile(state, 0, card); // 我有 ✓
  state = placeTile(state, 2, card); // 狗 ✗ (should be 一只)
  const result = checkArrangement(state, card);
  assert.equal(result.solved, false);
  assert.equal(result.correctPrefixTiles, 1);
});

// ── dataset invariants (every real sentence) ─────────────────────────────────
test("dataset: every sentence chunks cleanly and every topic deck is full", () => {
  for (const topic of rawData.topics) {
    const vocab = topic.items.map((i) => i.hanzi);
    for (const item of topic.items) {
      for (const sentence of item.sentences) {
        const { body } = splitEnding(sentence.cn);
        const chunks = chunkSentence(body, item.hanzi, vocab);
        assert.equal(chunks.join(""), body, `join invariant for "${sentence.cn}"`);
        assert.ok(
          chunks.length >= 2 && chunks.length <= MAX_TILES,
          `tile count ${chunks.length} in [2, ${MAX_TILES}] for "${sentence.cn}"`,
        );
        for (const chunk of chunks) {
          assert.ok(chunk.length > 0, `no empty chunk in "${sentence.cn}"`);
          assert.ok(
            !/[。，、？！；：]/.test(chunk[0]),
            `chunk "${chunk}" must not start with punctuation in "${sentence.cn}"`,
          );
        }
      }
    }
    // Every real topic yields a full 10-card deck (no dropped cards).
    const deck = buildScrambleDeck(
      topic.items,
      topic.items,
      (item) => `${topic.slug}:${item.hanzi}`,
      identity,
    );
    assert.equal(deck.length, topic.items.length, `full deck for topic ${topic.slug}`);
  }
});
