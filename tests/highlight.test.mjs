import test from "node:test";
import assert from "node:assert/strict";

import { splitHighlight, normalizePinyin } from "../src/lib/highlight.ts";

// Every test also asserts the invariant that segments rejoin to the source,
// proving highlighting never mutates or drops characters.
function joined(segments) {
  return segments.map((s) => s.text).join("");
}
function matchedText(segments) {
  return segments
    .filter((s) => s.match)
    .map((s) => s.text)
    .join("");
}

test("ASCII match highlights the matched span, case-insensitively", () => {
  const segs = splitHighlight("Ten types of Dogs", "dog");
  assert.equal(joined(segs), "Ten types of Dogs");
  assert.equal(matchedText(segs), "Dog"); // original casing preserved
  assert.ok(segs.some((s) => s.match));
});

test("Chinese character match highlights the hanzi", () => {
  const segs = splitHighlight("狗和猫", "狗");
  assert.equal(joined(segs), "狗和猫");
  assert.equal(matchedText(segs), "狗");
});

test("no match returns a single unmatched segment", () => {
  const segs = splitHighlight("cat", "dog");
  assert.deepEqual(segs, [{ text: "cat", match: false }]);
  assert.equal(matchedText(segs), "");
});

test("empty or whitespace query leaves text untouched", () => {
  assert.deepEqual(splitHighlight("hello", ""), [{ text: "hello", match: false }]);
  assert.deepEqual(splitHighlight("hello", "   "), [{ text: "hello", match: false }]);
  assert.deepEqual(splitHighlight("", "dog"), []);
});

test("pinyin match is diacritic-tolerant and highlights the toned original", () => {
  // Query without tone marks matches tone-marked source, keeping the marks.
  const segs = splitHighlight("gǒu", "gou");
  assert.equal(joined(segs), "gǒu");
  assert.equal(matchedText(segs), "gǒu");

  // Multi-syllable, space-separated pinyin: query spans one syllable.
  const phrase = splitHighlight("nǐ hǎo", "hao");
  assert.equal(joined(phrase), "nǐ hǎo");
  assert.equal(matchedText(phrase), "hǎo");
});

test("all occurrences of the query are highlighted", () => {
  // A gap keeps the two matches in separate segments (adjacent ones merge).
  const segs = splitHighlight("ma ma", "ma");
  assert.equal(joined(segs), "ma ma");
  assert.equal(matchedText(segs), "mama");
  assert.equal(segs.filter((s) => s.match).length, 2);
});

test("normalizePinyin strips tone marks and lowercases", () => {
  assert.equal(normalizePinyin("Gǒu"), "gou");
  assert.equal(normalizePinyin("NǏ HǍO"), "ni hao");
});
