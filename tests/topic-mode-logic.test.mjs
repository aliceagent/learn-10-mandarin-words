import test from "node:test";
import assert from "node:assert/strict";

import {
  TOPIC_MODES,
  MODE_LABELS,
  RESUMABLE_QUIZ_MODES,
  DEFAULT_QUIZ_MODE,
  parseMode,
  parseQuizMode,
  modeQuery,
  topicModeHref,
  mobileTopicModeGroups,
} from "../src/lib/topic-mode-logic.ts";

// ── parseMode ────────────────────────────────────────────────────────────────

test("parseMode accepts every canonical mode id", () => {
  for (const m of TOPIC_MODES) {
    assert.equal(parseMode(m), m);
  }
});

test("parseMode returns null for absent / invalid / wrong-case input", () => {
  assert.equal(parseMode(""), null);
  assert.equal(parseMode("nope"), null);
  assert.equal(parseMode(undefined), null);
  assert.equal(parseMode(null), null);
  assert.equal(parseMode("Quiz"), null); // case sensitive
  assert.equal(parseMode("WORDS"), null);
  assert.equal(parseMode(" quiz"), null); // no trimming
});

// ── parseQuizMode ────────────────────────────────────────────────────────────

test("parseQuizMode accepts the four quiz codes, null otherwise", () => {
  for (const q of RESUMABLE_QUIZ_MODES) {
    assert.equal(parseQuizMode(q), q);
  }
  assert.equal(RESUMABLE_QUIZ_MODES.length, 4);
  assert.equal(parseQuizMode(""), null);
  assert.equal(parseQuizMode("nope"), null);
  assert.equal(parseQuizMode(undefined), null);
  assert.equal(parseQuizMode("Listening"), null); // case sensitive
});

// ── modeQuery ────────────────────────────────────────────────────────────────

test("modeQuery omits the mode when it equals the topic default", () => {
  assert.equal(modeQuery("words", null, { defaultMode: "words" }), "");
  assert.equal(modeQuery("phrasebook", null, { defaultMode: "phrasebook" }), "");
});

test("modeQuery encodes a non-default mode", () => {
  assert.equal(modeQuery("flashcards", null, { defaultMode: "words" }), "?m=flashcards");
  assert.equal(modeQuery("quiz"), "?m=quiz");
});

test("modeQuery encodes the quiz sub-mode only when non-default", () => {
  assert.equal(modeQuery("quiz", "english-hanzi"), "?m=quiz&q=english-hanzi");
  assert.equal(modeQuery("quiz", "listening"), "?m=quiz&q=listening");
  // The default quiz sub-mode is omitted so the URL stays canonical.
  assert.equal(modeQuery("quiz", DEFAULT_QUIZ_MODE), "?m=quiz");
  assert.equal(modeQuery("quiz", null), "?m=quiz");
});

test("modeQuery never emits q for non-quiz modes", () => {
  // A stray quizMode passed alongside a non-quiz mode is ignored.
  assert.equal(modeQuery("flashcards", "english-hanzi", { defaultMode: "words" }), "?m=flashcards");
});

// ── topicModeHref ────────────────────────────────────────────────────────────

test("topicModeHref builds mode deep-links", () => {
  assert.equal(topicModeHref("ten-types-of-tea", "flashcards"), "/topics/ten-types-of-tea?m=flashcards");
  assert.equal(topicModeHref("drinks", "quiz", "english-hanzi"), "/topics/drinks?m=quiz&q=english-hanzi");
});

test("topicModeHref falls back to a bare topic href without a mode", () => {
  assert.equal(topicModeHref("x"), "/topics/x");
  assert.equal(topicModeHref("x", null), "/topics/x");
});

// ── Mobile mode grouping ─────────────────────────────────────────────────────

test("mobileTopicModeGroups keeps the main repeated actions in the primary row", () => {
  assert.deepEqual(mobileTopicModeGroups({ isPhrasebook: false, speechAvailable: true }), {
    primary: ["words", "flashcards", "quiz"],
    advanced: ["typed", "match", "memory", "cloze", "scramble", "sentence-listen", "boss"],
  });
});

test("mobileTopicModeGroups includes phrasebook first and omits unavailable listening", () => {
  assert.deepEqual(mobileTopicModeGroups({ isPhrasebook: true, speechAvailable: false }), {
    primary: ["phrasebook", "words", "flashcards", "quiz"],
    advanced: ["typed", "match", "memory", "cloze", "scramble", "boss"],
  });
});

// ── Registry drift guards ────────────────────────────────────────────────────

test("TOPIC_MODES matches the tab order rendered in topic-app.tsx", () => {
  // Guards against the registry drifting out of sync with the mode tabs.
  assert.deepEqual([...TOPIC_MODES], [
    "phrasebook",
    "words",
    "flashcards",
    "quiz",
    "typed",
    "match",
    "memory",
    "cloze",
    "scramble",
    "sentence-listen",
    "boss",
  ]);
  assert.equal(TOPIC_MODES.length, 11);
});

test("MODE_LABELS has a human label for every mode and matches the tab labels", () => {
  for (const m of TOPIC_MODES) {
    assert.equal(typeof MODE_LABELS[m], "string");
    assert.ok(MODE_LABELS[m].length > 0);
  }
  // Labels must mirror the tab strip in topic-app.tsx exactly.
  assert.deepEqual(MODE_LABELS, {
    phrasebook: "Phrasebook",
    words: "Words",
    flashcards: "Cards",
    quiz: "Quiz",
    typed: "Type",
    match: "Match",
    memory: "Memory",
    cloze: "Sentences",
    scramble: "Scramble",
    "sentence-listen": "Listening",
    boss: "Boss",
  });
});
