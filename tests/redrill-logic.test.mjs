import test from "node:test";
import assert from "node:assert/strict";

import { redrillEntries, buildRedrillDeck } from "../src/lib/redrill-logic.ts";

// Minimal Topic/VocabItem fixtures — only the fields the helpers read need to be
// present. wordKey is `slug:hanzi`, and each item's english/pinyin are derived
// from its hanzi so they stay distinct. Mirrors practice-logic.test.mjs.
function makeTopic(slug, hanziList, titleEn = slug) {
  return {
    slug,
    titleEn,
    items: hanziList.map((hanzi) => ({
      hanzi,
      pinyin: `${hanzi}-pinyin`,
      english: `${hanzi}-english`,
      sentences: [],
    })),
  };
}

const alpha = makeTopic("alpha", ["好", "坏", "空", "半"], "Alpha topic");
const beta = makeTopic("beta", ["日", "月", "水", "火", "木"], "Beta topic");
const TOPICS = [alpha, beta];

// Deterministic "shuffle" that preserves order, so card contents are testable.
const identity = (items) => [...items];

test("redrillEntries: resolves keys to items with the owning topic's full pool", () => {
  const entries = redrillEntries(TOPICS, ["beta:日", "alpha:好"]);
  assert.equal(entries.length, 2);

  const first = entries[0];
  assert.equal(first.key, "beta:日");
  assert.equal(first.topicSlug, "beta");
  assert.equal(first.topicTitle, "Beta topic");
  assert.equal(first.item.english, "日-english");
  // poolItems is the whole beta topic (5 words), for same-topic distractors.
  assert.equal(first.poolItems, beta.items);
  assert.equal(first.poolItems.length, 5);

  const second = entries[1];
  assert.equal(second.key, "alpha:好");
  assert.equal(second.poolItems, alpha.items);
});

test("redrillEntries: preserves input key order", () => {
  const entries = redrillEntries(TOPICS, ["alpha:半", "beta:水", "alpha:好"]);
  assert.deepEqual(
    entries.map((e) => e.key),
    ["alpha:半", "beta:水", "alpha:好"],
  );
});

test("redrillEntries: silently drops unresolvable keys", () => {
  const entries = redrillEntries(TOPICS, ["ghost:x", "beta:日", "alpha:nope"]);
  assert.deepEqual(
    entries.map((e) => e.key),
    ["beta:日"],
  );
});

test("redrillEntries: empty keys yield an empty deck", () => {
  assert.deepEqual(redrillEntries(TOPICS, []), []);
});

test("buildRedrillDeck: one card per entry, keyed and answered from the entry", () => {
  const entries = redrillEntries(TOPICS, ["beta:日", "alpha:好"]);
  const deck = buildRedrillDeck(entries, identity);
  assert.equal(deck.length, entries.length);
  deck.forEach((card, i) => {
    assert.equal(card.key, entries[i].key, "card key is the entry's wordKey");
    assert.equal(card.answer, entries[i].item.english, "answer is the entry's English");
    assert.equal(card.prompt, entries[i].item.hanzi, "prompt is the entry's hanzi");
    // hanzi-english mode carries the prompt's pinyin for the reveal.
    assert.equal(card.promptPinyin, entries[i].item.pinyin, "promptPinyin is set (hanzi-english)");
  });
});

test("buildRedrillDeck: 4 unique choices drawn only from the entry's own topic", () => {
  const entries = redrillEntries(TOPICS, ["beta:日", "alpha:好"]);
  const deck = buildRedrillDeck(entries, identity);
  deck.forEach((card, i) => {
    assert.equal(card.choices.length, 4);
    assert.equal(new Set(card.choices).size, 4, "choices are unique");
    assert.ok(card.choices.includes(card.answer));
    const poolEnglish = new Set(entries[i].poolItems.map((it) => it.english));
    for (const choice of card.choices) {
      assert.ok(poolEnglish.has(choice), `choice ${choice} is from the entry's topic`);
    }
  });
});

test("buildRedrillDeck: a single-entry deck still gets 3 distractors from its topic pool", () => {
  // A one-word drill (the common case) must still fill to 4 choices, drawn from
  // that word's own topic (beta has 5 words → 4 distinct distractors available).
  const entries = redrillEntries(TOPICS, ["beta:日"]);
  const deck = buildRedrillDeck(entries, identity);
  assert.equal(deck.length, 1);
  assert.equal(deck[0].choices.length, 4);
  assert.equal(new Set(deck[0].choices).size, 4);
});

test("buildRedrillDeck: an empty entry list yields an empty deck", () => {
  assert.deepEqual(buildRedrillDeck([], identity), []);
});
