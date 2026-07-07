import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGloss, glossSegments, glossesCollide } from "../src/lib/gloss.ts";

// ─── normalizeGloss ─────────────────────────────────────────────────────────

test("normalizeGloss: lowercases and strips parentheticals", () => {
  assert.equal(normalizeGloss("Steamed Bun (plain)"), "steamed bun");
  assert.equal(normalizeGloss("steamed bun"), "steamed bun");
});

test("normalizeGloss: strips punctuation but keeps spaces and hyphens", () => {
  assert.equal(normalizeGloss("sorry!"), "sorry");
  assert.equal(normalizeGloss("ice-cream"), "ice-cream");
  assert.equal(normalizeGloss("hot  dog"), "hot dog");
});

test("normalizeGloss: empty and whitespace/punctuation-only inputs normalize to empty", () => {
  assert.equal(normalizeGloss(""), "");
  assert.equal(normalizeGloss("   "), "");
  assert.equal(normalizeGloss("(...)"), "");
});

// ─── glossSegments ──────────────────────────────────────────────────────────

test("glossSegments: splits on slash and normalizes each sense", () => {
  assert.deepEqual(glossSegments("excuse me / sorry"), ["excuse me", "sorry"]);
});

test("glossSegments: splits on semicolons and commas too, dropping empties", () => {
  assert.deepEqual(glossSegments("run; to run, jog"), ["run", "to run", "jog"]);
  assert.deepEqual(glossSegments("sorry,,"), ["sorry"]);
});

test("glossSegments: a single-sense gloss yields one segment", () => {
  assert.deepEqual(glossSegments("steamed bun (plain)"), ["steamed bun"]);
});

test("glossSegments: an empty gloss yields no segments", () => {
  assert.deepEqual(glossSegments(""), []);
  assert.deepEqual(glossSegments("  ;  "), []);
});

// ─── glossesCollide ─────────────────────────────────────────────────────────

test("glossesCollide: parenthetical qualifier does not hide a shared core sense", () => {
  // Real dataset pair: 包子 "steamed bun" vs 馒头 "steamed bun (plain)".
  assert.equal(glossesCollide("steamed bun", "steamed bun (plain)"), true);
});

test("glossesCollide: a shared slash segment collides", () => {
  // Real dataset pair: 对不起 "sorry" vs 不好意思 "excuse me / sorry".
  assert.equal(glossesCollide("sorry", "excuse me / sorry"), true);
  assert.equal(glossesCollide("excuse me / sorry", "excuse me / sorry to bother you"), true);
});

test("glossesCollide: whole-segment equality only — 'hot' does not collide with 'hot dog'", () => {
  assert.equal(glossesCollide("hot", "hot dog"), false);
});

test("glossesCollide: distinct multi-word senses do not collide", () => {
  // "sorry" is a segment of the first but not the second (the second's only
  // sense is the longer phrase "excuse me / sorry to bother you").
  assert.equal(glossesCollide("sorry", "excuse me / sorry to bother you"), false);
  assert.equal(glossesCollide("dog", "cat"), false);
});

test("glossesCollide: case and punctuation are ignored", () => {
  assert.equal(glossesCollide("Sorry!", "sorry"), true);
});

test("glossesCollide: empty glosses never collide (not even with each other)", () => {
  assert.equal(glossesCollide("", ""), false);
  assert.equal(glossesCollide("", "sorry"), false);
  assert.equal(glossesCollide("sorry", "   "), false);
});
