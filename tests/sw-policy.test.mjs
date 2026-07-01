import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Guardrail for Sprint 10's offline/video policy: the service worker must stay
// conservative and MUST NOT precache the 100 GitHub-hosted lesson MP4s. These
// tests read the real sw.js and topics.json so a regression (e.g. someone adds
// a video URL to the precache list, or drops the cross-origin/media guards)
// fails CI instead of silently shipping a bloated, broken offline cache.

const swPath = fileURLToPath(new URL("../public/sw.js", import.meta.url));
const topicsPath = fileURLToPath(new URL("../src/data/topics.json", import.meta.url));

const sw = readFileSync(swPath, "utf8");
const topics = JSON.parse(readFileSync(topicsPath, "utf8")).topics;

// Pull the PRECACHE_URLS = [ ... ] array literal out of the source and parse it.
function precacheUrls(source) {
  const m = source.match(/PRECACHE_URLS\s*=\s*(\[[^\]]*\])/);
  assert.ok(m, "sw.js should declare a PRECACHE_URLS array");
  return JSON.parse(m[1]);
}

test("PRECACHE_URLS contains no media files", () => {
  for (const url of precacheUrls(sw)) {
    assert.doesNotMatch(url, /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?|$)/i, `precached media: ${url}`);
  }
});

test("PRECACHE_URLS is same-origin only (no remote video hosts)", () => {
  for (const url of precacheUrls(sw)) {
    assert.doesNotMatch(url, /^https?:\/\//i, `precached cross-origin URL: ${url}`);
  }
});

test("no real lesson video source URL appears anywhere in sw.js", () => {
  const sources = topics.map((t) => t.video?.source).filter(Boolean);
  assert.ok(sources.length >= 100, "expected the dataset to carry the GitHub Release MP4 URLs");
  for (const source of sources) {
    assert.ok(!sw.includes(source), `sw.js must not reference video URL: ${source}`);
  }
});

test("sw.js keeps the cross-origin and media passthrough guards", () => {
  // Cross-origin requests bail before caching (GitHub Releases live on github.com).
  assert.match(sw, /url\.origin\s*!==\s*self\.location\.origin/);
  // Same-origin media is never cached either.
  assert.match(sw, /if\s*\(\s*isMedia\(url\)\s*\)\s*return/);
});
