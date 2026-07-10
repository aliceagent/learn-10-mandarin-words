import test from "node:test";
import assert from "node:assert/strict";

import { APP_CACHE } from "../src/lib/offline.ts";
import {
  appOfflineStatus,
  prepareAppOffline,
} from "../src/lib/offline-app-pack.ts";

function keyOf(req) {
  return typeof req === "string" ? req : req.url;
}

function makeFakeCaches() {
  const store = new Map();
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

function htmlResponse(body) {
  return new Response(body, { headers: { "Content-Type": "text/html" } });
}

function assetResponse(body = "asset") {
  return new Response(body, { headers: { "Content-Type": "application/javascript" } });
}

test("prepareAppOffline caches app routes and same-origin shell assets", async () => {
  const caches = makeFakeCaches();
  const fetched = [];
  const fetch = async (url) => {
    fetched.push(url);
    if (url === "/lesson") {
      return htmlResponse(`<!doctype html><script src="/_next/static/chunks/app.js"></script><link href="/_next/static/media/font.woff2" rel="preload">`);
    }
    if (url === "/search-index.json") return new Response("[]", { headers: { "Content-Type": "application/json" } });
    if (url.startsWith("/_next/static/")) return assetResponse();
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await prepareAppOffline(["/lesson", "/search-index.json"], { caches, fetch });

  assert.deepEqual(result, { total: 2, cached: 2, failed: [], skipped: 0, cancelled: false, complete: true });
  assert.deepEqual(fetched, [
    "/lesson",
    "/_next/static/chunks/app.js",
    "/_next/static/media/font.woff2",
    "/search-index.json",
  ]);
  assert.equal(caches._store.get(APP_CACHE).has("/lesson"), true);
  assert.equal(caches._store.get(APP_CACHE).has("/search-index.json"), true);
  assert.equal(caches._store.get(APP_CACHE).has("/_next/static/chunks/app.js"), true);
  assert.equal(caches._store.get(APP_CACHE).has("/_next/static/media/font.woff2"), true);
});

test("prepareAppOffline skips unsafe media/proxy/external URLs and never caches them", async () => {
  const caches = makeFakeCaches();
  const fetched = [];
  const result = await prepareAppOffline([
    "/safe",
    "/videos/a.mp4",
    "/video-proxy/github-releases/tag/a.mp4",
    "https://example.com/app",
  ], {
    caches,
    fetch: async (url) => {
      fetched.push(url);
      return htmlResponse("<main>ok</main>");
    },
  });

  assert.equal(result.total, 1);
  assert.equal(result.cached, 1);
  assert.deepEqual(fetched, ["/safe"]);
  assert.deepEqual([...caches._store.get(APP_CACHE).keys()], ["/safe"]);
});

test("prepareAppOffline retries transient route failures once", async () => {
  const caches = makeFakeCaches();
  const attempts = new Map();
  const result = await prepareAppOffline(["/flaky"], {
    caches,
    fetch: async (url) => {
      attempts.set(url, (attempts.get(url) ?? 0) + 1);
      if (attempts.get(url) === 1) throw new TypeError("transient production miss");
      return htmlResponse("ok after retry");
    },
  });

  assert.deepEqual(result, { total: 1, cached: 1, failed: [], skipped: 0, cancelled: false, complete: true });
  assert.equal(attempts.get("/flaky"), 2);
  assert.equal(caches._store.get(APP_CACHE).has("/flaky"), true);
});

test("prepareAppOffline records failures and continues", async () => {
  const caches = makeFakeCaches();
  const result = await prepareAppOffline(["/ok", "/missing", "/bad-network"], {
    caches,
    fetch: async (url) => {
      if (url === "/ok") return htmlResponse("ok");
      if (url === "/missing") return new Response("missing", { status: 404 });
      throw new TypeError("offline");
    },
  });

  assert.equal(result.cached, 1);
  assert.equal(result.complete, false);
  assert.deepEqual(result.failed.map((f) => f.url), ["/missing", "/bad-network"]);
  assert.match(result.failed[0].message, /HTTP 404/);
  assert.match(result.failed[1].message, /offline/);
});

test("prepareAppOffline honours cancellation between routes", async () => {
  const caches = makeFakeCaches();
  let checks = 0;
  const result = await prepareAppOffline(["/one", "/two", "/three"], {
    caches,
    fetch: async (url) => htmlResponse(url),
    shouldCancel: () => ++checks > 2,
  });

  assert.deepEqual(result, { total: 3, cached: 2, failed: [], skipped: 1, cancelled: true, complete: false });
  assert.deepEqual([...caches._store.get(APP_CACHE).keys()], ["/one", "/two"]);
});

test("appOfflineStatus reports not-ready, partial, and ready from Cache Storage", async () => {
  const caches = makeFakeCaches();
  assert.deepEqual(await appOfflineStatus(["/one", "/two"], { caches }), {
    state: "not-ready",
    total: 2,
    cached: 0,
    missing: ["/one", "/two"],
  });

  const cache = await caches.open(APP_CACHE);
  await cache.put("/one", htmlResponse("one"));
  assert.deepEqual(await appOfflineStatus(["/one", "/two"], { caches }), {
    state: "partial",
    total: 2,
    cached: 1,
    missing: ["/two"],
  });

  await cache.put("/two", htmlResponse("two"));
  assert.deepEqual(await appOfflineStatus(["/one", "/two"], { caches }), {
    state: "ready",
    total: 2,
    cached: 2,
    missing: [],
  });
});
