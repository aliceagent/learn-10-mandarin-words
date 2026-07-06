import type { Topic } from "./types";
import { SITE_NAME, absoluteUrl } from "./seo.ts";

// Pure, DOM-free text builders for the printable topic cheat sheet (Sprint 19).
// Everything here derives from data already in `topics.json` — no new content —
// so it can be unit-tested directly under `node --test` (see
// tests/print-logic.test.mjs) and reused by the server-rendered sheet component.

/** Middle dot used to join the sheet's title and meta segments. */
const SEPARATOR = " · ";

/** Sheet heading: English title and Chinese title on one line, e.g. "Ten Types of Pets · 十种宠物". */
export function cheatSheetTitle(topic: Pick<Topic, "titleEn" | "titleCn">): string {
  return `${topic.titleEn}${SEPARATOR}${topic.titleCn}`;
}

/**
 * Sheet sub-line: real word count (never hardcoded — read from `items.length`),
 * category, and the site name, e.g. "10 words · Animals & Living Things · Learn 10 Mandarin Words".
 */
export function cheatSheetMetaLine(topic: Pick<Topic, "items" | "category">): string {
  const count = topic.items.length;
  const words = `${count} word${count === 1 ? "" : "s"}`;
  return [words, topic.category, SITE_NAME].join(SEPARATOR);
}

/** Absolute URL of the topic page, for the sheet's footer source line. */
export function cheatSheetSourceUrl(topic: Pick<Topic, "slug">): string {
  return absoluteUrl(`/topics/${topic.slug}`);
}
