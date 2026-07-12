#!/usr/bin/env node
// Validates src/data/topics.json for structural and content integrity.
// Run with: npm run validate:data
//
// Reports ERRORS (exit code 1) and WARNINGS (exit code 0 unless --strict).
// Does NOT mutate data. See README "Data validation" for the full rule list.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { collectQualityWarnings } from "./quality-lint.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../src/data/topics.json");
const PUBLIC_DIR = resolve(__dirname, "../public");

// Does a local "/videos/x.mp4" source have a real file under public/videos/?
function localVideoExists(src) {
  return MP4_PATH.test(src) && existsSync(resolve(PUBLIC_DIR, src.replace(/^\//, "")));
}

const EXPECTED_TOPICS = 108;
const EXPECTED_ITEMS_PER_TOPIC = 10;

// Tone-mark vowels (marks tones 1–4). Their absence implies a neutral tone.
const TONE_MARKS = /[āáǎàēéěèêīíǐìōóǒòūúǔùǖǘǚǜ]/;
// A plausible pinyin syllable body: latin letters, tone-marked vowels, ü, apostrophes, spaces, hyphens.
const PINYIN_SHAPE = /^[a-zA-Zāáǎàēéěèêīíǐìōóǒòūúǔùǖǘǚǜü'· -]+$/;
// Accept a leading "/videos/…​.mp4" path, a bare 11-char YouTube id, or a full http(s) url.
const MP4_PATH = /^\/videos\/[a-z0-9-]+\.mp4$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const HTTP_URL = /^https?:\/\/.+/;

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validVideoPath(v) {
  return MP4_PATH.test(v) || YT_ID.test(v) || HTTP_URL.test(v);
}

let raw;
try {
  raw = readFileSync(DATA_PATH, "utf8");
} catch (e) {
  console.error(`✖ Could not read ${DATA_PATH}: ${e.message}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`✖ topics.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

// ── Top-level shape ──────────────────────────────────────────────────────────
if (!data || typeof data !== "object" || Array.isArray(data)) {
  console.error("✖ Root must be an object with { categories, topics }.");
  process.exit(1);
}
if (!Array.isArray(data.categories)) err("`categories` must be an array.");
if (!Array.isArray(data.topics)) err("`topics` must be an array.");

if (errors.length) {
  report();
  process.exit(1);
}

const categories = data.categories;
const topics = data.topics;

// ── Category checks ──────────────────────────────────────────────────────────
const categorySlugs = new Set();
for (const [i, cat] of categories.entries()) {
  const where = `categories[${i}]`;
  if (!isNonEmptyString(cat.name)) err(`${where}.name is empty.`);
  if (!isNonEmptyString(cat.slug)) err(`${where}.slug is empty.`);
  if (!Array.isArray(cat.topics)) err(`${where}.topics must be an array.`);
  if (cat.slug) {
    if (categorySlugs.has(cat.slug)) err(`Duplicate category slug "${cat.slug}".`);
    categorySlugs.add(cat.slug);
  }
}

// ── Topic count ──────────────────────────────────────────────────────────────
if (topics.length !== EXPECTED_TOPICS) {
  err(`Expected exactly ${EXPECTED_TOPICS} topics, found ${topics.length}.`);
}

// ── Topic checks ─────────────────────────────────────────────────────────────
const topicSlugs = new Set();
const topicSlugToCategorySlug = new Map();

for (const [i, topic] of topics.entries()) {
  const label = topic?.slug ? `topic "${topic.slug}"` : `topics[${i}]`;

  for (const field of ["slug", "titleCn", "titleEn", "category", "categorySlug", "videoPath"]) {
    if (!isNonEmptyString(topic?.[field])) err(`${label}: field "${field}" is missing or empty.`);
  }

  if (topic?.slug) {
    if (topicSlugs.has(topic.slug)) err(`Duplicate topic slug "${topic.slug}".`);
    topicSlugs.add(topic.slug);
    topicSlugToCategorySlug.set(topic.slug, topic.categorySlug);
  }

  if (topic?.categorySlug && !categorySlugs.has(topic.categorySlug)) {
    err(`${label}: categorySlug "${topic.categorySlug}" has no matching category.`);
  }

  if (topic?.videoPath && !validVideoPath(topic.videoPath)) {
    warn(`${label}: videoPath "${topic.videoPath}" is not a /videos/*.mp4 path, YouTube id, or http(s) URL.`);
  }

  // If a topic has been mapped to a local video (via scripts/map-videos.mjs),
  // check the file is actually present. Warning only — CI stays green when the
  // generated MP4s aren't committed. `--strict` escalates warnings to failures.
  const videoSource = topic?.video?.provider === "mp4" ? topic.video.source : null;
  if (videoSource && MP4_PATH.test(videoSource) && !localVideoExists(videoSource)) {
    warn(`${label}: local video "${videoSource}" has no file under public/videos/.`);
  }

  // ── Items ──
  if (!Array.isArray(topic?.items)) {
    err(`${label}: "items" must be an array.`);
    continue;
  }
  if (topic.items.length !== EXPECTED_ITEMS_PER_TOPIC) {
    err(`${label}: expected ${EXPECTED_ITEMS_PER_TOPIC} items, found ${topic.items.length}.`);
  }

  const hanziSeen = new Set();
  for (const [j, item] of topic.items.entries()) {
    const il = `${label} item[${j}]`;

    for (const field of ["hanzi", "pinyin", "english"]) {
      if (!isNonEmptyString(item?.[field])) err(`${il}: field "${field}" is missing or empty.`);
    }

    // Unique word key (hanzi) within a topic.
    if (isNonEmptyString(item?.hanzi)) {
      if (hanziSeen.has(item.hanzi)) err(`${il}: duplicate hanzi "${item.hanzi}" within topic.`);
      hanziSeen.add(item.hanzi);
    }

    // Pinyin shape + tone-mark heuristic.
    if (isNonEmptyString(item?.pinyin)) {
      if (!PINYIN_SHAPE.test(item.pinyin)) {
        warn(`${il}: pinyin "${item.pinyin}" contains unexpected characters.`);
      } else if (!TONE_MARKS.test(item.pinyin)) {
        // No tone marks — acceptable only for a genuinely neutral-tone syllable.
        warn(`${il}: pinyin "${item.pinyin}" has no tone marks (only valid if fully neutral tone).`);
      }
    }

    // Sentences.
    if (!Array.isArray(item?.sentences) || item.sentences.length === 0) {
      err(`${il}: "sentences" must be a non-empty array.`);
      continue;
    }
    for (const [k, s] of item.sentences.entries()) {
      const sl = `${il} sentence[${k}]`;
      if (!isNonEmptyString(s?.cn)) err(`${sl}: "cn" is missing or empty.`);
      if (!isNonEmptyString(s?.en)) err(`${sl}: "en" is missing or empty.`);
      // Example CN sentence should contain the target hanzi it teaches.
      if (isNonEmptyString(s?.cn) && isNonEmptyString(item?.hanzi) && !s.cn.includes(item.hanzi)) {
        warn(`${sl}: CN sentence does not contain target hanzi "${item.hanzi}".`);
      }
    }
  }
}

// ── Cross-reference categories ↔ topics ──────────────────────────────────────
const referencedFromCategories = new Set();
for (const [i, cat] of categories.entries()) {
  if (!Array.isArray(cat.topics)) continue;
  const seenInCat = new Set();
  for (const slug of cat.topics) {
    if (seenInCat.has(slug)) err(`categories[${i}] ("${cat.slug}") lists topic "${slug}" more than once.`);
    seenInCat.add(slug);
    referencedFromCategories.add(slug);
    if (!topicSlugs.has(slug)) {
      err(`categories[${i}] ("${cat.slug}") references unknown topic "${slug}".`);
    } else if (topicSlugToCategorySlug.get(slug) !== cat.slug) {
      err(`Topic "${slug}" is listed under category "${cat.slug}" but its categorySlug is "${topicSlugToCategorySlug.get(slug)}".`);
    }
  }
}
for (const slug of topicSlugs) {
  if (!referencedFromCategories.has(slug)) {
    warn(`Topic "${slug}" is not listed in any category's topics array.`);
  }
}

// ── Content-quality lint ─────────────────────────────────────────────────────
// Heuristic checks for awkward/malformed generated text (bad articles,
// truncated sentences, duplicate labels, CN/EN punctuation drift). These are
// warnings by default and never fail `npm run validate:data`; pass
// `--strict-quality` (or `--strict`) to make them blocking. See scripts/quality-lint.mjs.
const qualityWarnings = collectQualityWarnings(topics);

// ── Report ───────────────────────────────────────────────────────────────────
function report() {
  const totalItems = topics.reduce((n, t) => n + (Array.isArray(t?.items) ? t.items.length : 0), 0);
  console.log(`\nData validation — ${DATA_PATH}`);
  console.log(`  categories: ${categories.length}  topics: ${topics.length}  words: ${totalItems}\n`);

  if (warnings.length) {
    console.log(`⚠ ${warnings.length} structural warning(s):`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
    console.log("");
  }
  if (qualityWarnings.length) {
    console.log(`⚠ ${qualityWarnings.length} content-quality warning(s):`);
    for (const w of qualityWarnings) console.log(`  ⚠ ${w}`);
    console.log("");
  }
  if (errors.length) {
    console.log(`✖ ${errors.length} error(s):`);
    for (const e of errors) console.log(`  ✖ ${e}`);
    console.log("");
  }
  const totalWarnings = warnings.length + qualityWarnings.length;
  if (!errors.length && !totalWarnings) {
    console.log("✓ All checks passed.\n");
  } else if (!errors.length) {
    console.log("✓ No blocking errors.\n");
  }
}

report();

// `--strict` fails on any warning; `--strict-quality` fails only on the
// content-quality lint findings (leaving pre-existing structural warnings green).
const strict = process.argv.includes("--strict");
const strictQuality = strict || process.argv.includes("--strict-quality");
const blocking =
  errors.length ||
  (strict && warnings.length) ||
  (strictQuality && qualityWarnings.length);
process.exit(blocking ? 1 : 0);
