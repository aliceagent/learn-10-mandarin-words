#!/usr/bin/env node
// Maps real videos (generated MP4s or YouTube IDs) into src/data/topics.json.
// Run with: npm run map:videos [path/to/video-map.json]
//
// The map is a JSON object keyed by topic slug. Each value is either:
//   - a string  → auto-detected as a YouTube id/URL or an .mp4 URL, or
//   - an object → { provider, source, poster?, captions? } (see types.ts VideoMeta).
//
// Example: scripts/videos.example.json
//
// This writes a `video` metadata object onto each matched topic and, for remote
// sources, updates `videoPath` too. Local "/videos/*.mp4" placeholders are left
// untouched unless you map them. Nothing here invents URLs — it only applies the
// mapping you supply. Re-run `npm run validate:data` afterwards.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../src/data/topics.json");
const mapArg = process.argv[2] ?? resolve(__dirname, "../video-map.json");
const MAP_PATH = resolve(process.cwd(), mapArg);

const YT_URL_OR_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$/;
const MP4_URL = /^https?:\/\/.+\.mp4(\?|$)/i;

function usage(msg) {
  if (msg) console.error(`\n${msg}`);
  console.error(`
Usage: npm run map:videos [path/to/video-map.json]

The map file is JSON keyed by topic slug, e.g.:

{
  "ten-types-of-pets":   "dQw4w9WgXcQ",
  "ten-types-of-drinks": { "provider": "mp4", "source": "https://cdn.example.com/drinks.mp4", "poster": "https://cdn.example.com/drinks.jpg" }
}

See scripts/videos.example.json for a template.
`);
}

if (!existsSync(MAP_PATH)) {
  usage(`No map file found at ${MAP_PATH}. Nothing to do.`);
  process.exit(0); // no-op, not an error — keeps CI green when unused
}

let map;
try {
  map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
} catch (e) {
  usage(`Could not parse map file: ${e.message}`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const bySlug = new Map(data.topics.map((t) => [t.slug, t]));

// Normalize a map entry into a VideoMeta object (or throw with a reason).
function toVideoMeta(entry) {
  if (typeof entry === "string") {
    const s = entry.trim();
    const yt = s.match(YT_URL_OR_ID);
    if (yt) return { provider: "youtube", source: yt[1] || yt[2] };
    if (MP4_URL.test(s)) return { provider: "mp4", source: s };
    throw new Error(`string "${s}" is neither a YouTube id/URL nor an .mp4 URL`);
  }
  if (entry && typeof entry === "object") {
    const { provider, source, poster, captions } = entry;
    if (provider !== "youtube" && provider !== "mp4") throw new Error(`provider must be "youtube" or "mp4"`);
    if (typeof source !== "string" || !source.trim()) throw new Error(`missing "source"`);
    if (provider === "youtube" && !YT_URL_OR_ID.test(source)) throw new Error(`invalid YouTube source "${source}"`);
    const meta = { provider, source: source.trim() };
    if (poster) meta.poster = String(poster);
    if (Array.isArray(captions)) meta.captions = captions;
    return meta;
  }
  throw new Error("entry must be a string or an object");
}

let applied = 0;
const problems = [];

for (const [slug, entry] of Object.entries(map)) {
  const topic = bySlug.get(slug);
  if (!topic) {
    problems.push(`Unknown topic slug "${slug}" — skipped.`);
    continue;
  }
  try {
    const meta = toVideoMeta(entry);
    topic.video = meta;
    // Keep the legacy videoPath useful for remote sources.
    if (meta.provider === "youtube" || MP4_URL.test(meta.source)) topic.videoPath = meta.source;
    applied++;
  } catch (e) {
    problems.push(`"${slug}": ${e.message}`);
  }
}

if (problems.length) {
  console.error(`\n⚠ ${problems.length} issue(s):`);
  for (const p of problems) console.error(`  ⚠ ${p}`);
}

if (applied > 0) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`\n✓ Mapped ${applied} video(s) into topics.json. Run "npm run validate:data" to verify.`);
} else {
  console.log("\nNo videos mapped.");
}

process.exit(problems.length && applied === 0 ? 1 : 0);
