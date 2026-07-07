import test from "node:test";
import assert from "node:assert/strict";

import { primaryCta } from "../src/lib/home-cta-logic.ts";

// primaryCta reads slug/titleEn/titleCn/categorySlug (the last two so a resume
// target can compute a topic's own default mode). A missing categorySlug means a
// normal, non-phrasebook topic whose default mode is "words".
function makeTopic(slug, titleEn = slug, titleCn = `${slug}-cn`, categorySlug = "drinks") {
  return { slug, titleEn, titleCn, categorySlug };
}

// Use real starter slugs so recommendedPath / nextRecommendedTopic resolve them
// in curated order (the head of the path is "ten-types-of-drinks").
const drinks = makeTopic("ten-types-of-drinks", "Drinks", "饮料");
const fruit = makeTopic("ten-types-of-tropical-fruit", "Tropical fruit", "热带水果");
const topics = [drinks, fruit];

function activity(overrides = {}) {
  return {
    topicSlug: "ten-types-of-drinks",
    mode: "words",
    updatedAt: "2026-07-06T10:00:00.000Z",
    ...overrides,
  };
}

test("empty progress → start, pointing at the first recommended lesson", () => {
  const cta = primaryCta(topics, { learnedTopics: [], lastActivity: null });
  assert.equal(cta.kind, "start");
  assert.equal(cta.href, "/topics/ten-types-of-drinks");
  assert.equal(cta.label, "Start your first lesson");
  assert.equal(cta.sub, "10 words, one short video, then practice");
});

test("learned topics but no lastActivity → continue via nextRecommendedTopic", () => {
  const cta = primaryCta(topics, {
    learnedTopics: ["ten-types-of-drinks"],
    lastActivity: null,
  });
  assert.equal(cta.kind, "continue");
  // Drinks is learned, so the next recommended lesson is the fruit list.
  assert.equal(cta.href, "/topics/ten-types-of-tropical-fruit");
  assert.equal(cta.label, "Continue: Tropical fruit");
  assert.equal(cta.sub, "1 list learned · keep going");
});

test("continue sub pluralizes lists correctly", () => {
  const cta = primaryCta(topics, {
    learnedTopics: ["ten-types-of-drinks", "ten-types-of-tropical-fruit"],
    lastActivity: null,
  });
  assert.equal(cta.kind, "continue");
  assert.equal(cta.sub, "2 lists learned · keep going");
});

test("resolvable lastActivity → resume, regardless of learned count (precedence)", () => {
  const cta = primaryCta(topics, {
    learnedTopics: [],
    lastActivity: activity({ mode: "quiz", quizMode: "english-hanzi" }),
  });
  assert.equal(cta.kind, "resume");
  assert.equal(cta.href, "/topics/ten-types-of-drinks?m=quiz&q=english-hanzi");
  assert.equal(cta.label, "Resume: Drinks");
  assert.equal(cta.sub, "Quiz · English → Hanzi · one tap back in");
});

test("resume outranks continue even when topics are learned", () => {
  const cta = primaryCta(topics, {
    learnedTopics: ["ten-types-of-drinks", "ten-types-of-tropical-fruit"],
    lastActivity: activity({ mode: "flashcards" }),
  });
  assert.equal(cta.kind, "resume");
  assert.equal(cta.href, "/topics/ten-types-of-drinks?m=flashcards");
  assert.equal(cta.sub, "Cards · one tap back in");
});

test("lastActivity slug dropped from dataset → never a broken href, falls through", () => {
  // Drift: the recorded slug no longer exists. With learned progress → continue.
  const continueCta = primaryCta(topics, {
    learnedTopics: ["ten-types-of-drinks"],
    lastActivity: activity({ topicSlug: "gone-forever" }),
  });
  assert.equal(continueCta.kind, "continue");
  assert.equal(continueCta.href, "/topics/ten-types-of-tropical-fruit");

  // Drift with no learned progress → start (still a valid href).
  const startCta = primaryCta(topics, {
    learnedTopics: [],
    lastActivity: activity({ topicSlug: "gone-forever" }),
  });
  assert.equal(startCta.kind, "start");
  assert.equal(startCta.href, "/topics/ten-types-of-drinks");
});

test("resume target on the topic default mode yields a bare canonical href", () => {
  const cta = primaryCta(topics, {
    learnedTopics: [],
    lastActivity: activity({ mode: "words" }),
  });
  assert.equal(cta.kind, "resume");
  assert.equal(cta.href, "/topics/ten-types-of-drinks");
  assert.equal(cta.sub, "Words · one tap back in");
});
