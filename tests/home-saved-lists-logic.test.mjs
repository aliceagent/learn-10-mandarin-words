import test from "node:test";
import assert from "node:assert/strict";

import { savedListsHomeSummary } from "../src/lib/home-saved-lists-logic.ts";

const topics = [
  { slug: "pets", titleEn: "Pets", titleCn: "宠物", category: "Animals", items: Array.from({ length: 10 }) },
  { slug: "fruit", titleEn: "Fruit", titleCn: "水果", category: "Food", items: Array.from({ length: 10 }) },
  { slug: "airport", titleEn: "Hotel to Airport", titleCn: "酒店到机场", category: "Transportation", items: Array.from({ length: 10 }) },
  { slug: "tea", titleEn: "Tea", titleCn: "茶", category: "Food", items: Array.from({ length: 10 }) },
];

test("savedListsHomeSummary is hidden when there are no valid saved lists", () => {
  assert.deepEqual(savedListsHomeSummary(topics, [], []), {
    hasSavedLists: false,
    visibleTopics: [],
    listCount: 0,
    wordCount: 0,
    remainingListCount: 0,
  });

  assert.equal(savedListsHomeSummary(topics, ["missing"], ["pets:狗"]).hasSavedLists, false);
});

test("savedListsHomeSummary preserves saved order and limits the home preview", () => {
  const summary = savedListsHomeSummary(topics, ["airport", "pets", "missing", "fruit", "tea"], ["pets:狗", "airport:航站楼"], 3);

  assert.equal(summary.hasSavedLists, true);
  assert.equal(summary.listCount, 4);
  assert.equal(summary.wordCount, 2);
  assert.equal(summary.remainingListCount, 1);
  assert.deepEqual(summary.visibleTopics.map((topic) => topic.slug), ["airport", "pets", "fruit"]);
});

test("savedListsHomeSummary tolerates bad limits", () => {
  const summary = savedListsHomeSummary(topics, ["pets", "fruit"], [], -1);

  assert.equal(summary.listCount, 2);
  assert.deepEqual(summary.visibleTopics, []);
  assert.equal(summary.remainingListCount, 2);
});
