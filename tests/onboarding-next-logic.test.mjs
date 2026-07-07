import test from "node:test";
import assert from "node:assert/strict";

import { onboardingNext } from "../src/lib/onboarding-next-logic.ts";

// Fixtures: onboardingNext reads slug/titleEn/titleCn (picker) and categorySlug
// (resolveResumeTarget's default-mode check). Use the real STARTER_SLUGS so
// recommendedPath — and therefore starterLessons — resolves them in curated
// order: pets → tropical-fruit → drinks → vegetables → weather → vehicles.
function makeTopic(slug, categorySlug = "drinks") {
  return { slug, titleEn: `${slug}-en`, titleCn: `${slug}-cn`, categorySlug };
}
const STARTERS = [
  "ten-types-of-pets",
  "ten-types-of-tropical-fruit",
  "ten-types-of-drinks",
  "ten-types-of-vegetables",
  "ten-types-of-weather",
  "ten-types-of-vehicles",
];
const topics = STARTERS.map((slug) => makeTopic(slug));

test("empty progress → pick of `limit` starters with bare topic hrefs", () => {
  const next = onboardingNext(topics, { learnedTopics: [], lastActivity: null });
  assert.equal(next.kind, "pick");
  assert.equal(next.lessons.length, 3);
  assert.deepEqual(
    next.lessons.map((l) => l.slug),
    STARTERS.slice(0, 3),
  );
  assert.deepEqual(next.lessons[0], {
    slug: "ten-types-of-pets",
    titleEn: "ten-types-of-pets-en",
    titleCn: "ten-types-of-pets-cn",
    href: "/topics/ten-types-of-pets",
  });
});

test("limit is honoured", () => {
  const next = onboardingNext(topics, { learnedTopics: [], lastActivity: null }, 2);
  assert.equal(next.kind, "pick");
  assert.deepEqual(
    next.lessons.map((l) => l.slug),
    STARTERS.slice(0, 2),
  );
});

test("learned topics but no lastActivity → still pick, skipping learned", () => {
  const next = onboardingNext(topics, {
    learnedTopics: ["ten-types-of-pets"],
    lastActivity: null,
  });
  assert.equal(next.kind, "pick");
  const slugs = next.lessons.map((l) => l.slug);
  assert.ok(!slugs.includes("ten-types-of-pets"));
  assert.deepEqual(slugs, [
    "ten-types-of-tropical-fruit",
    "ten-types-of-drinks",
    "ten-types-of-vegetables",
  ]);
});

test("resolvable lastActivity → resume (returning-user precedence), even with no learned lists", () => {
  const next = onboardingNext(topics, {
    learnedTopics: [],
    lastActivity: {
      topicSlug: "ten-types-of-drinks",
      mode: "quiz",
      quizMode: "english-hanzi",
      updatedAt: "2026-07-06T10:00:00.000Z",
    },
  });
  assert.equal(next.kind, "resume");
  assert.equal(next.href, "/topics/ten-types-of-drinks?m=quiz&q=english-hanzi");
  assert.equal(next.label, "Resume: ten-types-of-drinks-en");
});

test("lastActivity default mode → bare topic href in resume", () => {
  const next = onboardingNext(topics, {
    learnedTopics: [],
    lastActivity: {
      topicSlug: "ten-types-of-drinks",
      mode: "words",
      updatedAt: "2026-07-06T10:00:00.000Z",
    },
  });
  assert.equal(next.kind, "resume");
  assert.equal(next.href, "/topics/ten-types-of-drinks");
});

test("lastActivity slug dropped from dataset → falls back to pick", () => {
  const next = onboardingNext(topics, {
    learnedTopics: [],
    lastActivity: {
      topicSlug: "ten-types-of-gone",
      mode: "flashcards",
      updatedAt: "2026-07-06T10:00:00.000Z",
    },
  });
  assert.equal(next.kind, "pick");
  assert.equal(next.lessons.length, 3);
});

test("empty dataset with no activity → pick with an empty lessons list", () => {
  const next = onboardingNext([], { learnedTopics: [], lastActivity: null });
  assert.equal(next.kind, "pick");
  assert.deepEqual(next.lessons, []);
});
