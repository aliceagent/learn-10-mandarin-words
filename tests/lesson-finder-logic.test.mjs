import test from "node:test";
import assert from "node:assert/strict";

import { categoryChips, starterLessons } from "../src/lib/lesson-finder-logic.ts";

// ── categoryChips ─────────────────────────────────────────────────────────────

function makeCategory(name, slug, topicCount) {
  return { name, slug, topics: Array.from({ length: topicCount }, (_, i) => `${slug}-${i}`) };
}

test("categoryChips returns one chip per category, in dataset order, with count + href", () => {
  const categories = [
    makeCategory("Food & Drink", "food-and-drink", 3),
    makeCategory("Animals", "animals-and-living-things", 5),
  ];
  assert.deepEqual(categoryChips(categories), [
    { name: "Food & Drink", slug: "food-and-drink", href: "/categories/food-and-drink", count: 3 },
    { name: "Animals", slug: "animals-and-living-things", href: "/categories/animals-and-living-things", count: 5 },
  ]);
});

test("categoryChips on an empty dataset → []", () => {
  assert.deepEqual(categoryChips([]), []);
});

// ── starterLessons ────────────────────────────────────────────────────────────

// Use real STARTER_SLUGS so recommendedPath resolves them in curated order:
// pets → tropical-fruit → drinks → vegetables → weather → vehicles.
function makeTopic(slug) {
  return { slug, titleEn: `${slug}-en`, titleCn: `${slug}-cn` };
}
const STARTERS = [
  "ten-types-of-pets",
  "ten-types-of-tropical-fruit",
  "ten-types-of-drinks",
  "ten-types-of-vegetables",
  "ten-types-of-weather",
  "ten-types-of-vehicles",
];
const topics = STARTERS.map(makeTopic);

test("starterLessons returns the curated path in order when nothing is learned", () => {
  assert.deepEqual(
    starterLessons(topics, []).map((t) => t.slug),
    STARTERS,
  );
});

test("starterLessons respects the limit", () => {
  assert.deepEqual(
    starterLessons(topics, [], 3).map((t) => t.slug),
    STARTERS.slice(0, 3),
  );
});

test("starterLessons skips already-learned topics", () => {
  const learned = ["ten-types-of-drinks"];
  const slugs = starterLessons(topics, learned, 3).map((t) => t.slug);
  assert.ok(!slugs.includes("ten-types-of-drinks"));
  // First three unlearned, in path order.
  assert.deepEqual(slugs, [
    "ten-types-of-pets",
    "ten-types-of-tropical-fruit",
    "ten-types-of-vegetables",
  ]);
});

test("starterLessons tops up from the path head when most are learned — no duplicates, full limit", () => {
  // Only two unlearned remain, but limit is 6: fall back to the learned starters.
  const learned = [
    "ten-types-of-drinks",
    "ten-types-of-vegetables",
    "ten-types-of-weather",
    "ten-types-of-vehicles",
  ];
  const result = starterLessons(topics, learned, 6);
  const slugs = result.map((t) => t.slug);
  assert.equal(slugs.length, 6);
  assert.equal(new Set(slugs).size, 6, "no duplicate starters");
  // Unlearned come first (path order), then learned top-ups from the head.
  assert.deepEqual(slugs, [
    "ten-types-of-pets",
    "ten-types-of-tropical-fruit",
    "ten-types-of-drinks",
    "ten-types-of-vegetables",
    "ten-types-of-weather",
    "ten-types-of-vehicles",
  ]);
});

test("starterLessons never exceeds the path size", () => {
  // Path has 6 topics; asking for 10 yields at most 6.
  assert.equal(starterLessons(topics, [], 10).length, 6);
});

test("starterLessons on an empty dataset → []", () => {
  assert.deepEqual(starterLessons([], []), []);
});
