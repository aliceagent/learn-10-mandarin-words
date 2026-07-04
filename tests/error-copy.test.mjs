import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import { tonesOf } from "../src/lib/pinyin.ts";
import {
  ERROR_WORD,
  NOT_FOUND_COPY,
  LESSON_NOT_FOUND_COPY,
  CATEGORY_NOT_FOUND_COPY,
  ERROR_COPY,
} from "../src/lib/error-copy.ts";

test("ERROR_WORD is real vocabulary from the dataset", () => {
  const topic = rawData.topics.find((t) => t.slug === ERROR_WORD.topicSlug);
  assert.ok(topic, `topic ${ERROR_WORD.topicSlug} exists in the dataset`);
  const item = topic.items.find((i) => i.hanzi === ERROR_WORD.hanzi);
  assert.ok(item, `${ERROR_WORD.hanzi} exists in ${ERROR_WORD.topicSlug}`);
  assert.equal(item.pinyin, ERROR_WORD.pinyin);
  assert.equal(item.english, ERROR_WORD.english);
});

test("ERROR_WORD pinyin aligns one tone per hanzi", () => {
  assert.equal(tonesOf(ERROR_WORD.pinyin).length, [...ERROR_WORD.hanzi].length);
});

test("every copy object has non-empty title and body", () => {
  for (const copy of [NOT_FOUND_COPY, LESSON_NOT_FOUND_COPY, CATEGORY_NOT_FOUND_COPY, ERROR_COPY]) {
    assert.ok(copy.title.trim().length > 0, "title is non-empty");
    assert.ok(copy.body.trim().length > 0, "body is non-empty");
  }
});

test("404 and error copy reassure that progress is safe", () => {
  // Guards the reassurance from being silently edited away.
  assert.match(NOT_FOUND_COPY.body, /progress/i);
  assert.match(NOT_FOUND_COPY.body, /safe|device/i);
  assert.match(ERROR_COPY.body, /progress|browser/i);
});
