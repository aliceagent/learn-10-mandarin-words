#!/usr/bin/env node
// Maps real videos (generated MP4s or YouTube IDs) into src/data/topics.json.
// Run with: npm run map:videos [path/to/video-map.json] [--dry-run]
//
// The map is a JSON object keyed by topic slug. Each value is either:
//   - a string  → auto-detected as a YouTube id/URL, a remote .mp4 URL, or a
//                 local "/videos/<slug>.mp4" path, or
//   - an object → { provider, source, poster?, captions? } (see types.ts VideoMeta).
//
// Sources may be:
//   - YouTube:      "dQw4w9WgXcQ" or a youtube.com/youtu.be URL
//   - Remote MP4:   "https://cdn.example.com/clip.mp4"
//   - Local MP4:    { "provider": "mp4", "source": "/videos/<slug>.mp4" }
//                   — accepted only if the file exists under public/videos/.
//
// Flags:
//   --dry-run   Report what would change without writing topics.json.
//
// Example: scripts/videos.example.json
//
// This writes a `video` metadata object onto each matched topic and updates
// `videoPath` too. Local sources are promoted only when the file is present;
// a missing local file is warned about and skipped (never written as a broken
// path). Nothing here invents URLs — it only applies the mapping you supply.
// Re-run `npm run validate:data` afterwards.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../src/data/topics.json");
const PUBLIC_DIR = resolve(__dirname, "../public");

const YT_URL_OR_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$/;
const MP4_URL = /^https?:\/\/.+\.mp4(\?|$)/i;
// A local, in-repo video path served from public/videos/ (mirrors validate-data.mjs).
const LOCAL_MP4 = /^\/videos\/[a-z0-9-]+\.mp4$/;

export function isLocalMp4(source) {
  return typeof source === "string" && LOCAL_MP4.test(source);
}

export function isRemoteMp4(source) {
  return typeof source === "string" && MP4_URL.test(source);
}

// Does a local "/videos/x.mp4" source exist under public/videos/?
// Injectable for tests; defaults to a real filesystem check under PUBLIC_DIR.
export function localVideoExists(source, publicDir = PUBLIC_DIR) {
  if (!isLocalMp4(source)) return false;
  return existsSync(resolve(publicDir, source.replace(/^\//, "")));
}

// Normalize a map entry into a VideoMeta object (or throw with a reason).
// Does NOT touch the filesystem — locality is resolved later by buildPlan.
export function toVideoMeta(entry) {
  if (typeof entry === "string") {
    const s = entry.trim();
    const yt = s.match(YT_URL_OR_ID);
    if (yt) return { provider: "youtube", source: yt[1] || yt[2] };
    if (MP4_URL.test(s)) return { provider: "mp4", source: s };
    if (LOCAL_MP4.test(s)) return { provider: "mp4", source: s };
    throw new Error(`string "${s}" is neither a YouTube id/URL, an .mp4 URL, nor a /videos/*.mp4 path`);
  }
  if (entry && typeof entry === "object") {
    const { provider, source, poster, captions } = entry;
    if (provider !== "youtube" && provider !== "mp4") throw new Error(`provider must be "youtube" or "mp4"`);
    if (typeof source !== "string" || !source.trim()) throw new Error(`missing "source"`);
    if (provider === "youtube" && !YT_URL_OR_ID.test(source)) throw new Error(`invalid YouTube source "${source}"`);
    if (provider === "mp4" && !MP4_URL.test(source.trim()) && !LOCAL_MP4.test(source.trim())) {
      throw new Error(`mp4 source "${source}" must be an .mp4 URL or a /videos/*.mp4 path`);
    }
    const meta = { provider, source: source.trim() };
    if (poster) meta.poster = String(poster);
    if (Array.isArray(captions)) meta.captions = captions;
    return meta;
  }
  throw new Error("entry must be a string or an object");
}

// Build a plan from a raw map + topic lookup without mutating anything.
// Returns { changes, problems, warnings }. `videoExists` is injectable so this
// stays pure and testable. Missing local files become warnings + skips, never
// changes, so a broken path can never be written.
export function buildPlan(map, bySlug, { videoExists = localVideoExists } = {}) {
  const changes = [];
  const problems = [];
  const warnings = [];

  for (const [slug, entry] of Object.entries(map)) {
    if (slug.startsWith("_")) continue; // template/comment keys like "_comment"
    const topic = bySlug.get(slug);
    if (!topic) {
      problems.push(`Unknown topic slug "${slug}" — skipped.`);
      continue;
    }
    let meta;
    try {
      meta = toVideoMeta(entry);
    } catch (e) {
      problems.push(`"${slug}": ${e.message}`);
      continue;
    }
    if (meta.provider === "mp4" && isLocalMp4(meta.source) && !videoExists(meta.source)) {
      warnings.push(`"${slug}": local file ${meta.source} not found under public/videos/ — skipped.`);
      continue;
    }
    // videoPath stays the single playback source of truth; keep it in sync for
    // youtube, remote mp4, and existing local mp4 sources.
    const setsVideoPath =
      meta.provider === "youtube" || isRemoteMp4(meta.source) || isLocalMp4(meta.source);
    changes.push({ slug, meta, setsVideoPath });
  }
  return { changes, problems, warnings };
}

function usage(msg) {
  if (msg) console.error(`\n${msg}`);
  console.error(`
Usage: npm run map:videos [path/to/video-map.json] [--dry-run]

  --dry-run   Report what would change without writing topics.json.

The map file is JSON keyed by topic slug, e.g.:

{
  "ten-types-of-pets":   "dQw4w9WgXcQ",
  "ten-types-of-drinks": { "provider": "mp4", "source": "https://cdn.example.com/drinks.mp4", "poster": "https://cdn.example.com/drinks.jpg" },
  "ten-types-of-fruit":  { "provider": "mp4", "source": "/videos/ten-types-of-fruit.mp4" }
}

See scripts/videos.example.json for a template.
`);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  const mapArg = positional[0] ?? resolve(__dirname, "../video-map.json");
  const MAP_PATH = resolve(process.cwd(), mapArg);

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
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    usage("Map file must be a JSON object keyed by topic slug.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const bySlug = new Map(data.topics.map((t) => [t.slug, t]));

  const { changes, problems, warnings } = buildPlan(map, bySlug);

  if (warnings.length) {
    console.error(`\n⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) console.error(`  ⚠ ${w}`);
  }
  if (problems.length) {
    console.error(`\n⚠ ${problems.length} issue(s):`);
    for (const p of problems) console.error(`  ⚠ ${p}`);
  }

  if (dryRun) {
    console.log(`\n[dry-run] Would map ${changes.length} video(s) into topics.json:`);
    for (const c of changes) {
      console.log(`  • ${c.slug} → ${c.meta.provider}:${c.meta.source}`);
    }
    console.log(`\n[dry-run] No files were written. Re-run without --dry-run to apply.`);
    process.exit(0); // a dry-run of a parseable map is always a success
  }

  for (const c of changes) {
    const topic = bySlug.get(c.slug);
    topic.video = c.meta;
    if (c.setsVideoPath) topic.videoPath = c.meta.source;
  }

  if (changes.length > 0) {
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`\n✓ Mapped ${changes.length} video(s) into topics.json. Run "npm run validate:data" to verify.`);
  } else {
    console.log("\nNo videos mapped.");
  }

  process.exit(problems.length && changes.length === 0 ? 1 : 0);
}

// Only run the CLI when invoked directly, so tests can import the helpers.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
