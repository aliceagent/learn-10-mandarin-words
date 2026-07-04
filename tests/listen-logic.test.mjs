import test from "node:test";
import assert from "node:assert/strict";

import {
  WORD_GAP_MS,
  MIN_STEP_TIMEOUT_MS,
  PER_CHAR_TIMEOUT_MS,
  buildListenSteps,
  nextStepIndex,
  stepTimeoutMs,
  listenProgressLabel,
} from "../src/lib/listen-logic.ts";

// Minimal topic fixture: buildListenSteps only reads slug + items[].hanzi/pinyin/
// english, so the vocab items omit `sentences` for brevity.
function makeTopic(items) {
  return {
    slug: "animals",
    titleCn: "动物",
    titleEn: "Animals",
    category: "Everyday",
    categorySlug: "everyday",
    videoPath: "",
    items,
  };
}

const keyFor = (item) => `animals:${item.hanzi}`;

test("buildListenSteps returns one ordered step per word", () => {
  const topic = makeTopic([
    { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [] },
    { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [] },
    { hanzi: "鸟", pinyin: "niǎo", english: "bird", sentences: [] },
  ]);
  const steps = buildListenSteps(topic, keyFor);

  assert.equal(steps.length, 3);
  assert.deepEqual(
    steps.map((s) => s.text),
    ["狗", "猫", "鸟"],
  );
  assert.deepEqual(
    steps.map((s) => s.index),
    [0, 1, 2],
  );
  // text === hanzi, key === keyFor(item), pinyin/english carried through.
  assert.deepEqual(steps[0], { key: "animals:狗", text: "狗", pinyin: "gǒu", english: "dog", index: 0 });
});

test("buildListenSteps skips empty-hanzi items with continuous indices", () => {
  const topic = makeTopic([
    { hanzi: "狗", pinyin: "gǒu", english: "dog", sentences: [] },
    { hanzi: "", pinyin: "", english: "(blank)", sentences: [] },
    { hanzi: "猫", pinyin: "māo", english: "cat", sentences: [] },
  ]);
  const steps = buildListenSteps(topic, keyFor);

  assert.equal(steps.length, 2);
  assert.deepEqual(steps.map((s) => s.text), ["狗", "猫"]);
  // Index continuity is preserved (0,1) despite the skipped item.
  assert.deepEqual(steps.map((s) => s.index), [0, 1]);
});

test("nextStepIndex advances then finishes at the end", () => {
  assert.equal(nextStepIndex(0, 10), 1);
  assert.equal(nextStepIndex(8, 10), 9);
  assert.equal(nextStepIndex(9, 10), null);
  assert.equal(nextStepIndex(0, 1), null);
  assert.equal(nextStepIndex(0, 0), null);
});

test("stepTimeoutMs stays above the floor and grows with length", () => {
  assert.equal(stepTimeoutMs("狗"), MIN_STEP_TIMEOUT_MS + PER_CHAR_TIMEOUT_MS);
  assert.equal(stepTimeoutMs("狗"), 4500);
  assert.equal(stepTimeoutMs("你好"), 5000);
  assert.ok(stepTimeoutMs("") >= MIN_STEP_TIMEOUT_MS);
  assert.ok(stepTimeoutMs("很长的句子") > stepTimeoutMs("狗"));
});

test("listenProgressLabel is 1-based over the total", () => {
  assert.equal(listenProgressLabel(0, 10), "Playing 1 of 10");
  assert.equal(listenProgressLabel(2, 10), "Playing 3 of 10");
  assert.equal(listenProgressLabel(9, 10), "Playing 10 of 10");
});

test("timing constants document the drill contract", () => {
  assert.equal(WORD_GAP_MS, 900);
  assert.equal(MIN_STEP_TIMEOUT_MS, 4000);
  assert.equal(PER_CHAR_TIMEOUT_MS, 500);
});
