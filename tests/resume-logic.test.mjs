import test from "node:test";
import assert from "node:assert/strict";

import { resolveResumeTarget } from "../src/lib/resume-logic.ts";

// Minimal topic fixtures: resolveResumeTarget only reads slug/titleEn/titleCn and
// categorySlug (to know a topic's default mode). A missing categorySlug means a
// normal, non-phrasebook topic whose default mode is "words".
function makeTopic(slug, titleEn = slug, titleCn = `${slug}-cn`, categorySlug = "drinks") {
  return { slug, titleEn, titleCn, categorySlug };
}

const drinks = makeTopic("ten-types-of-drinks", "Drinks", "饮料");
const phrases = makeTopic("hotel-to-airport", "Hotel to airport", "去机场", "useful-phrases");
const topics = [drinks, phrases];

function activity(overrides = {}) {
  return {
    topicSlug: "ten-types-of-drinks",
    mode: "words",
    updatedAt: "2026-07-06T10:00:00.000Z",
    ...overrides,
  };
}

test("empty dataset yields null", () => {
  assert.equal(resolveResumeTarget([], activity()), null);
});

test("null / undefined lastActivity yields null", () => {
  assert.equal(resolveResumeTarget(topics, null), null);
  assert.equal(resolveResumeTarget(topics, undefined), null);
});

test("unknown slug (dataset drift) yields null", () => {
  assert.equal(resolveResumeTarget(topics, activity({ topicSlug: "gone" })), null);
});

test("quiz activity deep-links with the sub-mode and spells out the label", () => {
  const target = resolveResumeTarget(
    topics,
    activity({ mode: "quiz", quizMode: "english-hanzi" }),
  );
  assert.deepEqual(target, {
    slug: "ten-types-of-drinks",
    href: "/topics/ten-types-of-drinks?m=quiz&q=english-hanzi",
    topicTitleEn: "Drinks",
    topicTitleCn: "饮料",
    modeLabel: "Quiz · English → Hanzi",
  });
});

test("quiz activity in the default sub-mode omits q from the href", () => {
  const target = resolveResumeTarget(topics, activity({ mode: "quiz", quizMode: "hanzi-english" }));
  assert.equal(target.href, "/topics/ten-types-of-drinks?m=quiz");
  assert.equal(target.modeLabel, "Quiz · Hanzi → English");
});

test("the topic default mode (words) yields a bare canonical href", () => {
  const target = resolveResumeTarget(topics, activity({ mode: "words" }));
  assert.equal(target.href, "/topics/ten-types-of-drinks");
  assert.equal(target.modeLabel, "Words");
});

test("flashcards deep-links via ?m and uses the flashcards label", () => {
  const target = resolveResumeTarget(topics, activity({ mode: "flashcards" }));
  assert.equal(target.href, "/topics/ten-types-of-drinks?m=flashcards");
  assert.equal(target.modeLabel, "Cards");
});

test("phrasebook is the default for a Useful-Phrases topic, so its href is bare", () => {
  const target = resolveResumeTarget(
    topics,
    activity({ topicSlug: "hotel-to-airport", mode: "phrasebook" }),
  );
  assert.equal(target.href, "/topics/hotel-to-airport");
  assert.equal(target.modeLabel, "Phrasebook");
});

test("non-default mode on a phrasebook topic keeps the m param", () => {
  // On a phrasebook topic the default is "phrasebook", so resuming "words" is
  // NOT the default and must stay addressable.
  const target = resolveResumeTarget(
    topics,
    activity({ topicSlug: "hotel-to-airport", mode: "words" }),
  );
  assert.equal(target.href, "/topics/hotel-to-airport?m=words");
});

test("a stray quizMode on a non-quiz mode is ignored in the label", () => {
  const target = resolveResumeTarget(
    topics,
    activity({ mode: "flashcards", quizMode: "english-hanzi" }),
  );
  assert.equal(target.modeLabel, "Cards");
  assert.equal(target.href, "/topics/ten-types-of-drinks?m=flashcards");
});
