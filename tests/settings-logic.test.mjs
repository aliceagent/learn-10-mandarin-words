import test from "node:test";
import assert from "node:assert/strict";

import {
  describeSpeechSupport,
  validateProgressFile,
  progressExportFilename,
  INVALID_PROGRESS_FILE_ERROR,
} from "../src/lib/settings-logic.ts";
import { emptyProgress, normalizeProgress } from "../src/lib/progress-logic.ts";

// ── describeSpeechSupport ─────────────────────────────────────────────────────

test("describeSpeechSupport returns distinct copy + tone for every SpeechSupport value", () => {
  const statuses = ["ready", "no-chinese-voice", "unsupported", "loading"];
  const results = statuses.map((s) => describeSpeechSupport(s));

  // Every branch yields a non-empty label + detail.
  for (const r of results) {
    assert.ok(r.label.length > 0, "label is non-empty");
    assert.ok(r.detail.length > 0, "detail is non-empty");
    assert.ok(["ok", "warn", "muted"].includes(r.tone), "tone is a known value");
  }

  // Labels are distinct across the four states (exhaustive, no accidental reuse).
  const labels = results.map((r) => r.label);
  assert.equal(new Set(labels).size, statuses.length, "labels are distinct");

  // Tones map as documented: ready→ok, no-chinese-voice→warn, others→muted.
  assert.equal(describeSpeechSupport("ready").tone, "ok");
  assert.equal(describeSpeechSupport("no-chinese-voice").tone, "warn");
  assert.equal(describeSpeechSupport("unsupported").tone, "muted");
  assert.equal(describeSpeechSupport("loading").tone, "muted");
});

// ── validateProgressFile ──────────────────────────────────────────────────────

test("validateProgressFile round-trips a real export (same goal + learned topics)", () => {
  const state = normalizeProgress({
    onboarding: { completed: true, dailyGoal: 20 },
    learnedTopics: ["colors", "numbers"],
  });
  const json = JSON.stringify(state, null, 2);
  const result = validateProgressFile(json);

  assert.equal(result.ok, true);
  assert.equal(result.state.onboarding.dailyGoal, 20);
  assert.deepEqual(result.state.learnedTopics, ["colors", "numbers"]);
});

test("validateProgressFile: parseable-but-empty JSON normalizes to an empty state, never throws", () => {
  // null / {} / [] are all valid JSON — normalizeProgress repairs them, matching
  // the existing import path's tolerance.
  for (const input of ["null", "{}", "[]"]) {
    const result = validateProgressFile(input);
    assert.equal(result.ok, true, `${input} → ok`);
    assert.deepEqual(result.state.learnedTopics, emptyProgress.learnedTopics);
    assert.equal(result.state.onboarding.dailyGoal, emptyProgress.onboarding.dailyGoal);
  }
});

test("validateProgressFile: unparseable input is a friendly error, never throws", () => {
  for (const input of ["", "not json", '{"learnedTopics": [', "{oops"]) {
    let result;
    assert.doesNotThrow(() => {
      result = validateProgressFile(input);
    });
    assert.equal(result.ok, false, `${JSON.stringify(input)} → not ok`);
    assert.equal(result.error, INVALID_PROGRESS_FILE_ERROR);
  }
});

// ── progressExportFilename ────────────────────────────────────────────────────

test("progressExportFilename embeds the day between the fixed prefix + .json", () => {
  assert.equal(progressExportFilename("2026-07-06"), "mandarin-progress-2026-07-06.json");
});
