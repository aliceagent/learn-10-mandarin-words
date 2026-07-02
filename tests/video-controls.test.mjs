import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_RATE,
  PLAYBACK_RATES,
  normalizeRate,
  rateLabel,
} from "../src/lib/video-controls.ts";

test("PLAYBACK_RATES holds the supported rates in order", () => {
  assert.deepEqual([...PLAYBACK_RATES], [0.5, 0.75, 1, 1.25, 1.5]);
  assert.equal(DEFAULT_RATE, 1);
});

test("normalizeRate returns valid rates unchanged", () => {
  for (const rate of PLAYBACK_RATES) {
    assert.equal(normalizeRate(rate), rate);
  }
});

test("normalizeRate coerces valid numeric strings (e.g. from localStorage)", () => {
  assert.equal(normalizeRate("0.75"), 0.75);
  assert.equal(normalizeRate("1"), 1);
  assert.equal(normalizeRate("1.5"), 1.5);
});

test("normalizeRate falls back to 1 for out-of-range values", () => {
  assert.equal(normalizeRate(0), 1);
  assert.equal(normalizeRate(2), 1);
  assert.equal(normalizeRate(-1), 1);
  assert.equal(normalizeRate(0.6), 1);
  assert.equal(normalizeRate(3.25), 1);
});

test("normalizeRate falls back to 1 for invalid/unknown values", () => {
  assert.equal(normalizeRate(undefined), 1);
  assert.equal(normalizeRate(null), 1);
  assert.equal(normalizeRate(""), 1);
  assert.equal(normalizeRate("fast"), 1);
  assert.equal(normalizeRate(NaN), 1);
  assert.equal(normalizeRate(Infinity), 1);
  assert.equal(normalizeRate({}), 1);
  assert.equal(normalizeRate([]), 1);
});

test("rateLabel formats a rate with a multiplication sign", () => {
  assert.equal(rateLabel(0.5), "0.5×");
  assert.equal(rateLabel(0.75), "0.75×");
  assert.equal(rateLabel(1), "1×");
  assert.equal(rateLabel(1.25), "1.25×");
  assert.equal(rateLabel(1.5), "1.5×");
});
