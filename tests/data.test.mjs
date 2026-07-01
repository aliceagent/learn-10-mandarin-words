import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  allWords,
  getTopic,
  nextRecommendedTopic,
  recommendedPath,
  STARTER_SLUGS,
  wordKey,
} from "../src/lib/data-logic.ts";

const topics = rawData.topics;

test("dataset has exactly 100 topics and 1000 words", () => {
  assert.equal(topics.length, 100);
  assert.equal(allWords(topics).length, 1000);
});

test("allWords annotates each word with its topic + category", () => {
  const words = allWords(topics);
  const first = words[0];
  const topic = topics[0];
  assert.equal(first.topicSlug, topic.slug);
  assert.equal(first.topicTitle, topic.titleEn);
  assert.equal(first.category, topic.category);
  // Ten words per topic, so global count is topics * 10.
  assert.equal(words.length, topics.length * 10);
});

test("getTopic finds a real slug and returns undefined otherwise", () => {
  const known = topics[0].slug;
  assert.equal(getTopic(topics, known)?.slug, known);
  assert.equal(getTopic(topics, "no-such-topic-slug"), undefined);
});

test("wordKey is topic.slug + ':' + hanzi", () => {
  const topic = topics[0];
  const item = topic.items[0];
  assert.equal(wordKey(topic, item), `${topic.slug}:${item.hanzi}`);
});

test("recommendedPath returns the starter slugs when present", () => {
  const path = recommendedPath(topics);
  const slugs = path.map((t) => t.slug);
  // Every starter slug that exists in data should appear, in order.
  const expected = STARTER_SLUGS.filter((s) => getTopic(topics, s));
  assert.deepEqual(slugs, expected);
  assert.ok(path.length >= 3);
});

test("recommendedPath falls back to first 6 topics when starters are missing", () => {
  // Synthetic topics with none of the starter slugs -> data-order fallback.
  const synthetic = Array.from({ length: 8 }, (_, i) => ({
    slug: `topic-${i}`,
    items: [],
  }));
  const path = recommendedPath(synthetic);
  assert.equal(path.length, 6);
  assert.deepEqual(path.map((t) => t.slug), ["topic-0", "topic-1", "topic-2", "topic-3", "topic-4", "topic-5"]);
});

test("nextRecommendedTopic skips learned recommended topics", () => {
  const path = recommendedPath(topics);
  const learned = [path[0].slug];
  assert.equal(nextRecommendedTopic(topics, learned).slug, path[1].slug);
});

test("nextRecommendedTopic falls back to first unlearned topic overall", () => {
  // Learn every recommended topic; the next pick is the first unlearned in data.
  const learned = recommendedPath(topics).map((t) => t.slug);
  const next = nextRecommendedTopic(topics, learned);
  assert.ok(!learned.includes(next.slug));
  const firstUnlearned = topics.find((t) => !learned.includes(t.slug));
  assert.equal(next.slug, firstUnlearned.slug);
});

test("nextRecommendedTopic falls back to topic 1 when everything is learned", () => {
  const learned = topics.map((t) => t.slug);
  assert.equal(nextRecommendedTopic(topics, learned).slug, topics[0].slug);
});
