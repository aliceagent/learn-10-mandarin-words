import test from "node:test";
import assert from "node:assert/strict";

import { resolvePracticeShortcut } from "../src/lib/shortcut-logic.ts";

// A permissive baseline context: question phase, 4 choices, no guards tripped.
// Individual tests override just the fields they care about.
function baseCtx(overrides = {}) {
  return {
    phase: "question",
    choiceCount: 4,
    hasModifier: false,
    repeat: false,
    targetIsEditable: false,
    targetIsButton: false,
    ...overrides,
  };
}

test("digits map to 0-based choose in the question phase", () => {
  assert.deepEqual(resolvePracticeShortcut("1", baseCtx()), { type: "choose", index: 0 });
  assert.deepEqual(resolvePracticeShortcut("2", baseCtx()), { type: "choose", index: 1 });
  assert.deepEqual(resolvePracticeShortcut("4", baseCtx()), { type: "choose", index: 3 });
});

test("digits beyond choiceCount return null", () => {
  assert.equal(resolvePracticeShortcut("4", baseCtx({ choiceCount: 3 })), null);
  assert.equal(resolvePracticeShortcut("9", baseCtx({ choiceCount: 4 })), null);
});

test("digits return null in answered and done phases", () => {
  assert.equal(resolvePracticeShortcut("1", baseCtx({ phase: "answered" })), null);
  assert.equal(resolvePracticeShortcut("1", baseCtx({ phase: "done" })), null);
});

test("Enter and ArrowRight advance only in the answered phase", () => {
  assert.deepEqual(resolvePracticeShortcut("Enter", baseCtx({ phase: "answered" })), { type: "next" });
  assert.deepEqual(resolvePracticeShortcut("ArrowRight", baseCtx({ phase: "answered" })), { type: "next" });
  for (const key of ["Enter", "ArrowRight"]) {
    assert.equal(resolvePracticeShortcut(key, baseCtx({ phase: "question" })), null);
    assert.equal(resolvePracticeShortcut(key, baseCtx({ phase: "done" })), null);
  }
});

test("Enter is suppressed on a button target, but ArrowRight is not", () => {
  // A focused button already fires a native click on Enter — don't double-fire.
  assert.equal(
    resolvePracticeShortcut("Enter", baseCtx({ phase: "answered", targetIsButton: true })),
    null,
  );
  // ArrowRight has no native button action, so it stays live on buttons.
  assert.deepEqual(
    resolvePracticeShortcut("ArrowRight", baseCtx({ phase: "answered", targetIsButton: true })),
    { type: "next" },
  );
});

test("p/P pronounce in question and answered, but not done", () => {
  for (const key of ["p", "P"]) {
    assert.deepEqual(resolvePracticeShortcut(key, baseCtx({ phase: "question" })), { type: "speak" });
    assert.deepEqual(resolvePracticeShortcut(key, baseCtx({ phase: "answered" })), { type: "speak" });
    assert.equal(resolvePracticeShortcut(key, baseCtx({ phase: "done" })), null);
  }
});

test("r/R restart only in the done phase", () => {
  for (const key of ["r", "R"]) {
    assert.deepEqual(resolvePracticeShortcut(key, baseCtx({ phase: "done" })), { type: "again" });
    assert.equal(resolvePracticeShortcut(key, baseCtx({ phase: "question" })), null);
    assert.equal(resolvePracticeShortcut(key, baseCtx({ phase: "answered" })), null);
  }
});

test("universal guards short-circuit every bound key to null", () => {
  // A representative bound key for each guard, across the phases where it'd fire.
  const guarded = [
    ["1", { phase: "question" }],
    ["Enter", { phase: "answered" }],
    ["ArrowRight", { phase: "answered" }],
    ["p", { phase: "question" }],
    ["r", { phase: "done" }],
  ];
  for (const [key, phase] of guarded) {
    assert.equal(resolvePracticeShortcut(key, baseCtx({ ...phase, hasModifier: true })), null);
    assert.equal(resolvePracticeShortcut(key, baseCtx({ ...phase, repeat: true })), null);
    assert.equal(resolvePracticeShortcut(key, baseCtx({ ...phase, targetIsEditable: true })), null);
  }
});

test("unbound keys resolve to null in every phase", () => {
  for (const phase of ["question", "answered", "done"]) {
    for (const key of ["a", "0", "Escape", " "]) {
      assert.equal(resolvePracticeShortcut(key, baseCtx({ phase })), null);
    }
  }
});
