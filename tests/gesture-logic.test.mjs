import test from "node:test";
import assert from "node:assert/strict";

import { FLING_THRESHOLD_PX, flingIntent, dragTransform } from "../src/lib/gesture-logic.ts";

test("flingIntent classifies at the default threshold (inclusive boundaries)", () => {
  assert.equal(FLING_THRESHOLD_PX, 80);
  assert.equal(flingIntent(80), "easy");
  assert.equal(flingIntent(-80), "again");
  assert.equal(flingIntent(79), null);
  assert.equal(flingIntent(-79), null);
  assert.equal(flingIntent(0), null);
  assert.equal(flingIntent(500), "easy");
  assert.equal(flingIntent(-500), "again");
});

test("flingIntent honors a custom threshold", () => {
  assert.equal(flingIntent(40, 40), "easy");
  assert.equal(flingIntent(-40, 40), "again");
  assert.equal(flingIntent(39, 40), null);
  assert.equal(flingIntent(79, 120), null);
});

test("dragTransform formats translate + rotate and clamps rotation to ±12deg", () => {
  assert.equal(dragTransform(0), "translateX(0px) rotate(0deg)");
  // 200 * 0.06 = 12 exactly (at the clamp edge).
  assert.equal(dragTransform(200), "translateX(200px) rotate(12deg)");
  assert.equal(dragTransform(-200), "translateX(-200px) rotate(-12deg)");
  // 500 * 0.06 = 30 → clamped to 12.
  assert.equal(dragTransform(500), "translateX(500px) rotate(12deg)");
  assert.equal(dragTransform(-500), "translateX(-500px) rotate(-12deg)");
  // Sub-clamp value passes through.
  assert.equal(dragTransform(100), "translateX(100px) rotate(6deg)");
});
