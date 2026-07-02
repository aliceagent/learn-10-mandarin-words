import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Guardrail for the offline/video policy. The service worker must stay
// conservative and MUST NOT precache or auto-cache the 100 GitHub-hosted lesson
// MP4s. Videos are cached ONLY when a learner explicitly saves one (Sprint 7),
// into a dedicated video cache that the SW then serves — including Range
// requests. These tests read the real sw.js (and topics.json) so a regression
// (someone adds a video URL to precache, drops the cross-origin guard, or starts
// auto-caching media) fails CI instead of shipping a bloated/broken cache.

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

// ── Static-source invariants (unchanged policy) ─────────────────────────────

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

test("sw.js keeps the cross-origin guard for non-media requests", () => {
  // Cross-origin requests still bail before caching (fonts, YouTube, etc.).
  assert.match(sw, /url\.origin\s*!==\s*self\.location\.origin/);
});

// ── New opt-in cache invariants ─────────────────────────────────────────────

test("sw declares a dedicated video cache, separate from the app shell cache", () => {
  const m = sw.match(/VIDEO_CACHE\s*=\s*"([^"]+)"/);
  assert.ok(m, "sw.js should declare a VIDEO_CACHE constant");
  assert.match(m[1], /videos/, "video cache name should be clearly video-scoped");
  assert.notEqual(m[1], "learn10-v1", "video cache must not reuse the app-shell cache name");
});

// ── Behavioural tests ────────────────────────────────────────────────────────
// Load sw.js in a sandbox with a fake `self`/`caches`/`fetch`, capturing the
// registered event handlers and the internal helpers so we can assert real
// behaviour rather than string patterns.

function loadSw({ cachesObj, fetchImpl, origin = "https://app.example" } = {}) {
  const handlers = {};
  const selfObj = {
    addEventListener: (type, fn) => {
      handlers[type] = fn;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    location: { origin },
  };
  const factory = new Function(
    "self",
    "caches",
    "fetch",
    `${sw}\nreturn { parseRange, buildRangeResponse, serveMedia };`,
  );
  const exported = factory(selfObj, cachesObj ?? { open: async () => ({}) }, fetchImpl);
  return { handlers, ...exported };
}

// Minimal request stand-in — the SW only reads url/method/mode and the Range header.
function fakeRequest(url, { range, method = "GET", mode } = {}) {
  return {
    url,
    method,
    mode,
    headers: { get: (h) => (h.toLowerCase() === "range" && range ? range : null) },
  };
}

function dispatchFetch(handler, request) {
  let responsePromise;
  handler({ request, respondWith: (p) => (responsePromise = p) });
  return responsePromise;
}

test("a saved video is served from the video cache, with Range support", async () => {
  const url = "https://github.com/org/repo/releases/download/v1/lesson.mp4";
  const full = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const videoCache = {
    match: async (u) =>
      u === url ? new Response(full, { headers: { "Content-Type": "video/mp4" } }) : undefined,
  };
  const cachesObj = {
    open: async (name) => (name === "learn10-videos-v1" ? videoCache : { match: async () => undefined }),
  };
  const fetchImpl = async () => {
    throw new Error("network must not be used for a saved video");
  };

  const { handlers } = loadSw({ cachesObj, fetchImpl });
  const res = await dispatchFetch(handlers.fetch, fakeRequest(url, { range: "bytes=2-5" }));

  assert.equal(res.status, 206);
  assert.equal(res.headers.get("Content-Range"), "bytes 2-5/10");
  assert.equal(res.headers.get("Accept-Ranges"), "bytes");
  const body = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...body], [2, 3, 4, 5]);
});

test("a saved video without a Range header returns the full cached response", async () => {
  const url = "https://github.com/org/repo/releases/download/v1/lesson.mp4";
  const stored = new Response("full-body", { headers: { "Content-Type": "video/mp4" } });
  const cachesObj = {
    open: async () => ({ match: async (u) => (u === url ? stored : undefined) }),
  };
  const { handlers } = loadSw({ cachesObj, fetchImpl: async () => new Response("net") });
  const res = await dispatchFetch(handlers.fetch, fakeRequest(url));
  assert.equal(res, stored);
});

test("an unsaved video passes through to the network and is never cached", async () => {
  const url = "https://github.com/org/repo/releases/download/v1/other.mp4";
  let putCount = 0;
  const cachesObj = {
    open: async () => ({
      match: async () => undefined,
      put: async () => {
        putCount++;
      },
    }),
  };
  const networkRes = new Response("streamed");
  const { handlers } = loadSw({ cachesObj, fetchImpl: async () => networkRes });

  const res = await dispatchFetch(handlers.fetch, fakeRequest(url));
  assert.equal(res, networkRes, "unsaved media should come straight from the network");
  assert.equal(putCount, 0, "the service worker must never auto-cache media");
});

test("cross-origin non-media requests are ignored (no respondWith)", async () => {
  const { handlers } = loadSw({});
  const out = dispatchFetch(
    handlers.fetch,
    fakeRequest("https://fonts.example.com/font.woff2"),
  );
  assert.equal(out, undefined, "cross-origin non-media should fall through to the browser");
});

test("activate cleanup deletes stale caches but preserves app + video caches", async () => {
  const deleted = [];
  const cachesObj = {
    open: async () => ({}),
    keys: async () => ["learn10-v1", "learn10-videos-v1", "learn10-old", "misc-cache"],
    delete: async (k) => {
      deleted.push(k);
      return true;
    },
  };
  const { handlers } = loadSw({ cachesObj });

  let waited;
  handlers.activate({ waitUntil: (p) => (waited = p) });
  await waited;

  assert.deepEqual(deleted.sort(), ["learn10-old", "misc-cache"]);
});

// ── parseRange unit tests ────────────────────────────────────────────────────

test("parseRange handles closed, open-ended, suffix, clamped, and invalid ranges", () => {
  const { parseRange } = loadSw({});
  assert.deepEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=0-", 1000), { start: 0, end: 999 });
  assert.deepEqual(parseRange("bytes=500-", 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=990-5000", 1000), { start: 990, end: 999 }); // clamped to size
  assert.equal(parseRange("bytes=1000-2000", 1000), null); // start at/after EOF
  assert.equal(parseRange("bytes=50-10", 1000), null); // start > end
  assert.equal(parseRange("bytes=abc", 1000), null);
  assert.equal(parseRange("kilobytes=0-1", 1000), null);
  assert.equal(parseRange("", 1000), null);
  assert.equal(parseRange(null, 1000), null);
});

test("buildRangeResponse returns 416 for an unsatisfiable range", async () => {
  const { buildRangeResponse } = loadSw({});
  const res = await buildRangeResponse(new Response(new Uint8Array([1, 2, 3])), "bytes=100-200");
  assert.equal(res.status, 416);
  assert.equal(res.headers.get("Content-Range"), "bytes */3");
});
