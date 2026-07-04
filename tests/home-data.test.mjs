import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  datasetSummary,
  nextRecommendedTopic,
  toTopicSummary,
  wordKey,
} from "../src/lib/data-logic.ts";
import { hasPlayableVideo } from "../src/lib/video.ts";

const topics = rawData.topics;
const summaries = topics.map(toTopicSummary);

test("toTopicSummary strips example sentences but keeps hanzi/pinyin/english", () => {
  const topic = topics[0];
  const summary = toTopicSummary(topic);
  assert.equal(summary.items.length, topic.items.length);
  for (let i = 0; i < topic.items.length; i++) {
    const item = summary.items[i];
    assert.ok(!("sentences" in item), "summary item must not carry sentences");
    assert.equal(item.hanzi, topic.items[i].hanzi);
    assert.equal(item.pinyin, topic.items[i].pinyin);
    assert.equal(item.english, topic.items[i].english);
  }
});

test("toTopicSummary preserves every topic-level field", () => {
  for (const topic of topics) {
    const summary = toTopicSummary(topic);
    assert.equal(summary.slug, topic.slug);
    assert.equal(summary.titleEn, topic.titleEn);
    assert.equal(summary.titleCn, topic.titleCn);
    assert.equal(summary.category, topic.category);
    assert.equal(summary.categorySlug, topic.categorySlug);
    assert.equal(summary.videoPath, topic.videoPath);
    assert.deepEqual(summary.video, topic.video);
  }
});

test("hasPlayableVideo parity across all 102 topics", () => {
  for (const topic of topics) {
    assert.equal(hasPlayableVideo(toTopicSummary(topic)), hasPlayableVideo(topic));
  }
});

test("summaries cover the whole dataset (102 topics, 1020 items)", () => {
  assert.equal(summaries.length, 102);
  assert.equal(summaries.reduce((n, t) => n + t.items.length, 0), 1020);
});

test("datasetSummary is identical for slim and full topics", () => {
  assert.deepEqual(datasetSummary(summaries), datasetSummary(topics));
});

test("nextRecommendedTopic returns the same slug on slim and full topics", () => {
  assert.equal(
    nextRecommendedTopic(summaries, []).slug,
    nextRecommendedTopic(topics, []).slug,
  );
  // With a partially-learned list, both paths must still agree.
  const learned = [topics[0].slug, topics[1].slug];
  assert.equal(
    nextRecommendedTopic(summaries, learned).slug,
    nextRecommendedTopic(topics, learned).slug,
  );
});

test("wordKey format is unchanged for summary items", () => {
  const topic = topics[0];
  const summary = summaries[0];
  assert.equal(wordKey(summary, summary.items[0]), wordKey(topic, topic.items[0]));
});

test("serialized slim home payload is far smaller than the full dataset", () => {
  const slim = Buffer.byteLength(
    JSON.stringify({ categories: rawData.categories, topics: summaries }),
  );
  const full = Buffer.byteLength(
    JSON.stringify({ categories: rawData.categories, topics }),
  );
  assert.ok(slim < 160_000, `slim payload ${slim} should be < 160000 bytes`);
  assert.ok(slim < full / 2, `slim payload ${slim} should be < half of full ${full}`);
});
