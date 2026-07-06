import test from "node:test";
import assert from "node:assert/strict";

import {
  HAPTICS_STORAGE_KEY,
  HAPTIC_PATTERNS,
  normalizeHapticsSetting,
  serializeHapticsSetting,
} from "../src/lib/haptics.ts";

test("normalizeHapticsSetting: only exact \"on\" enables", () => {
  assert.equal(normalizeHapticsSetting("on"), true);
});

test("normalizeHapticsSetting: default-off + garbage tolerance", () => {
  for (const value of ["off", null, "", "true", 1, undefined, {}]) {
    assert.equal(normalizeHapticsSetting(value), false);
  }
});

test("serializeHapticsSetting: maps boolean to on/off", () => {
  assert.equal(serializeHapticsSetting(true), "on");
  assert.equal(serializeHapticsSetting(false), "off");
});

test("round-trip: normalize(serialize(x)) === x", () => {
  assert.equal(normalizeHapticsSetting(serializeHapticsSetting(true)), true);
  assert.equal(normalizeHapticsSetting(serializeHapticsSetting(false)), false);
});

test("HAPTIC_PATTERNS: exactly correct and incorrect keys", () => {
  assert.deepEqual(Object.keys(HAPTIC_PATTERNS).sort(), ["correct", "incorrect"]);
});

test("HAPTIC_PATTERNS: every entry is a positive integer", () => {
  for (const pattern of Object.values(HAPTIC_PATTERNS)) {
    assert.ok(Array.isArray(pattern) && pattern.length > 0);
    for (const ms of pattern) {
      assert.ok(Number.isInteger(ms) && ms > 0, `expected positive integer, got ${ms}`);
    }
  }
});

test("HAPTIC_PATTERNS: the two patterns differ", () => {
  assert.notDeepEqual([...HAPTIC_PATTERNS.correct], [...HAPTIC_PATTERNS.incorrect]);
});

test("HAPTIC_PATTERNS: correct is a single short subtle pulse", () => {
  assert.equal(HAPTIC_PATTERNS.correct.length, 1);
  assert.ok(HAPTIC_PATTERNS.correct[0] <= 50);
});

test("HAPTICS_STORAGE_KEY is in the app's key namespace", () => {
  assert.ok(HAPTICS_STORAGE_KEY.startsWith("learn-10-mandarin-"));
});
