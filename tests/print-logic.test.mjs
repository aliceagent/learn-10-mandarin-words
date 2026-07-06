import test from "node:test";
import assert from "node:assert/strict";

import { cheatSheetMetaLine, cheatSheetSourceUrl, cheatSheetTitle } from "../src/lib/print-logic.ts";
import { SITE_NAME, absoluteUrl } from "../src/lib/seo.ts";

// A minimal item fixture — only the fields the helpers read matter here.
function items(n) {
  return Array.from({ length: n }, (_, i) => ({
    hanzi: `字${i}`,
    pinyin: "zì",
    english: `word ${i}`,
    sentences: [],
  }));
}

const TEN_WORD_TOPIC = {
  slug: "ten-types-of-pets",
  titleEn: "Ten Types of Pets",
  titleCn: "十种宠物",
  category: "Animals & Living Things",
  items: items(10),
};

const THREE_WORD_TOPIC = {
  slug: "three-quick-greetings",
  titleEn: "Three Quick Greetings",
  titleCn: "三个问候",
  category: "Useful Phrases",
  items: items(3),
};

// ─── cheatSheetTitle ──────────────────────────────────────────────────────────

test("cheatSheetTitle joins English and Chinese titles with the middle-dot separator", () => {
  const title = cheatSheetTitle(TEN_WORD_TOPIC);
  assert.equal(title, "Ten Types of Pets · 十种宠物");
  assert.ok(title.includes(TEN_WORD_TOPIC.titleEn));
  assert.ok(title.includes(TEN_WORD_TOPIC.titleCn));
  assert.ok(title.includes(" · "));
});

// ─── cheatSheetMetaLine ───────────────────────────────────────────────────────

test("cheatSheetMetaLine reports the real item count, category, and site name", () => {
  const line = cheatSheetMetaLine(TEN_WORD_TOPIC);
  assert.equal(line, "10 words · Animals & Living Things · Learn 10 Mandarin Words");
  assert.ok(line.includes(SITE_NAME));
  assert.ok(line.includes(TEN_WORD_TOPIC.category));
});

test("cheatSheetMetaLine count is not hardcoded (3-item fixture)", () => {
  const line = cheatSheetMetaLine(THREE_WORD_TOPIC);
  assert.ok(line.startsWith("3 words · "));
  assert.ok(line.includes("Useful Phrases"));
  assert.ok(line.includes(SITE_NAME));
});

test("cheatSheetMetaLine uses the singular 'word' for a one-item topic", () => {
  const line = cheatSheetMetaLine({ items: items(1), category: "Solo" });
  assert.ok(line.startsWith("1 word · "));
});

// ─── cheatSheetSourceUrl ──────────────────────────────────────────────────────

test("cheatSheetSourceUrl returns an absolute URL ending in /topics/{slug}", () => {
  const url = cheatSheetSourceUrl(TEN_WORD_TOPIC);
  assert.equal(url, absoluteUrl("/topics/ten-types-of-pets"));
  assert.ok(url.endsWith("/topics/ten-types-of-pets"));
  assert.ok(/^https?:\/\//.test(url));
});
