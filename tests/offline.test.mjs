import test from "node:test";
import assert from "node:assert/strict";

import {
  VIDEO_CACHE,
  formatBytes,
  isLessonSaved,
  isOfflineCapable,
  listSavedLessons,
  removeLessonOffline,
  saveLessonOffline,
  savedLessonSize,
  supportsCacheStorage,
} from "../src/lib/offline.ts";

// ── Fake Cache Storage ──────────────────────────────────────────────────────
// A tiny in-memory stand-in for the browser Cache API so the helpers can be
// exercised without a service worker or real network.

function keyOf(req) {
  return typeof req === "string" ? req : req.url;
}

function makeFakeCaches() {
  const store = new Map(); // cacheName -> Map(url -> Response)
  const putSpy = [];
  const api = {
    open: async (name) => {
      if (!store.has(name)) store.set(name, new Map());
      const m = store.get(name);
      return {
        match: async (req) => m.get(keyOf(req)),
        put: async (req, res) => {
          putSpy.push({ cache: name, url: keyOf(req) });
          m.set(keyOf(req), res);
        },
        delete: async (req) => m.delete(keyOf(req)),
        keys: async () => [...m.keys()].map((u) => ({ url: u })),
      };
    },
    _store: store,
    _putSpy: putSpy,
  };
  return api;
}

function mp4Response(body = "video-bytes") {
  return new Response(body, {
    headers: { "Content-Type": "video/mp4", "Content-Length": String(body.length) },
  });
}

const URL_A = "https://cdn.example.com/lesson-a.mp4";
const URL_B = "https://cdn.example.com/lesson-b.mp4";

// ── formatBytes ─────────────────────────────────────────────────────────────

test("formatBytes renders human-readable sizes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.equal(formatBytes(5.5 * 1024 * 1024), "5.5 MB");
  assert.equal(formatBytes(15 * 1024 * 1024), "15 MB");
  assert.equal(formatBytes(3 * 1024 * 1024 * 1024), "3 GB");
});

test("formatBytes returns an em dash for invalid sizes", () => {
  assert.equal(formatBytes(-1), "—");
  assert.equal(formatBytes(NaN), "—");
  assert.equal(formatBytes(Infinity), "—");
});

// ── Capability detection ────────────────────────────────────────────────────

test("supportsCacheStorage / isOfflineCapable reflect injected deps", () => {
  const caches = makeFakeCaches();
  assert.equal(supportsCacheStorage({ caches }), true);
  assert.equal(supportsCacheStorage({ caches: undefined }), false);
  assert.equal(isOfflineCapable({ caches, fetch: async () => new Response("") }), true);
  // With no cache storage there's nowhere to save, so it's not capable.
  assert.equal(isOfflineCapable({ caches: undefined, fetch: async () => new Response("") }), false);
});

// ── save / isSaved / size / list / remove ───────────────────────────────────

test("saveLessonOffline stores the MP4 in the dedicated video cache", async () => {
  const caches = makeFakeCaches();
  const fetch = async (url, init) => {
    assert.equal(url, URL_A);
    assert.equal(init.mode, "cors");
    return mp4Response();
  };

  await saveLessonOffline(URL_A, { caches, fetch });

  assert.equal(await isLessonSaved(URL_A, { caches }), true);
  assert.equal(await isLessonSaved(URL_B, { caches }), false);
  assert.deepEqual([...caches._store.keys()], [VIDEO_CACHE]);
  assert.deepEqual(await listSavedLessons({ caches }), [URL_A]);
});

test("savedLessonSize reads the stored content length, null when absent", async () => {
  const caches = makeFakeCaches();
  const fetch = async () => mp4Response("0123456789");
  await saveLessonOffline(URL_A, { caches, fetch });

  assert.equal(await savedLessonSize(URL_A, { caches }), 10);
  assert.equal(await savedLessonSize(URL_B, { caches }), null);
});

test("savedLessonSize returns null for opaque saved videos with hidden bodies", async () => {
  const caches = makeFakeCaches();
  const opaque = {
    type: "opaque",
    headers: new Headers(),
    blob: async () => ({ size: 0 }),
  };
  const cache = await caches.open(VIDEO_CACHE);
  await cache.put(URL_A, opaque);

  assert.equal(await savedLessonSize(URL_A, { caches }), null);
});

test("opaque cached videos do not count as saved lessons", async () => {
  const caches = makeFakeCaches();
  const opaque = {
    type: "opaque",
    headers: new Headers(),
    blob: async () => ({ size: 0 }),
  };
  const cache = await caches.open(VIDEO_CACHE);
  await cache.put(URL_A, opaque);

  assert.equal(await isLessonSaved(URL_A, { caches }), false);
  assert.deepEqual(await listSavedLessons({ caches }), []);
  assert.equal(caches._store.get(VIDEO_CACHE).has(URL_A), false);
});

test("removeLessonOffline deletes a saved lesson", async () => {
  const caches = makeFakeCaches();
  await saveLessonOffline(URL_A, { caches, fetch: async () => mp4Response() });
  assert.equal(await isLessonSaved(URL_A, { caches }), true);

  assert.equal(await removeLessonOffline(URL_A, { caches }), true);
  assert.equal(await isLessonSaved(URL_A, { caches }), false);
  assert.equal(await removeLessonOffline(URL_A, { caches }), false); // already gone
});

test("saveLessonOffline also co-caches a same-origin page shell when asked", async () => {
  const caches = makeFakeCaches();
  const seen = [];
  const fetch = async (url) => {
    seen.push(url);
    return mp4Response();
  };
  await saveLessonOffline(URL_A, { caches, fetch, pageUrl: "/topics/demo" });

  // Video cache holds the MP4; app cache holds the page.
  assert.equal(caches._store.get(VIDEO_CACHE).has(URL_A), true);
  assert.equal(caches._store.get("learn10-v2").has("/topics/demo"), true);
  assert.deepEqual(seen, [URL_A, "/topics/demo"]);
});

// ── Error handling ──────────────────────────────────────────────────────────

test("saveLessonOffline rejects on a non-ok response and stores nothing", async () => {
  const caches = makeFakeCaches();
  const fetch = async () => new Response("nope", { status: 404 });
  await assert.rejects(() => saveLessonOffline(URL_A, { caches, fetch }), /HTTP 404/);
  assert.equal(caches._putSpy.length, 0);
});

test("saveLessonOffline rejects opaque no-CORS responses because they cannot reliably play offline", async () => {
  const caches = makeFakeCaches();
  const calls = [];
  const opaque = { ok: false, status: 0, type: "opaque", headers: new Headers() };
  const fetch = async (url, init = {}) => {
    calls.push({ url, mode: init.mode });
    if (init.mode === "cors") throw new TypeError("CORS blocked");
    assert.equal(init.mode, "no-cors");
    return opaque;
  };

  await assert.rejects(
    () => saveLessonOffline(URL_A, { caches, fetch }),
    /doesn't allow offline video saving/,
  );

  assert.deepEqual(calls, [
    { url: URL_A, mode: "cors" },
    { url: URL_A, mode: "no-cors" },
  ]);
  assert.equal(caches._putSpy.length, 0);
});

test("saveLessonOffline surfaces a friendly message on network failure", async () => {
  const caches = makeFakeCaches();
  const fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(() => saveLessonOffline(URL_A, { caches, fetch }), /Check your connection/);
});

test("saveLessonOffline maps a storage quota error to a friendly message", async () => {
  const fetch = async () => mp4Response();
  const caches = {
    open: async () => ({
      put: async () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
      match: async () => undefined,
    }),
  };
  await assert.rejects(() => saveLessonOffline(URL_A, { caches, fetch }), /Not enough space/);
});

test("read helpers stay safe when Cache Storage is unavailable", async () => {
  assert.equal(await isLessonSaved(URL_A, { caches: undefined }), false);
  assert.equal(await savedLessonSize(URL_A, { caches: undefined }), null);
  assert.deepEqual(await listSavedLessons({ caches: undefined }), []);
});
