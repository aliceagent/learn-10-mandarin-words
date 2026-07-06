/*
 * Minimal offline shell for Learn 10 Mandarin Words. No build step, no deps.
 *
 * Strategy (conservative on purpose):
 *   - Navigations: network-first, fall back to cached page, then /offline.
 *   - RSC payloads (App Router client-side <Link> navigations — same-origin GETs
 *     carrying an `_rsc` search param or an `RSC` header): network-first, cached
 *     into the app shell on success, served from cache offline. On a total miss
 *     we REJECT rather than synthesize a response, so Next's own hard-navigation
 *     fallback kicks in and the cached HTML (from the navigation handler) serves
 *     the page. Without this branch, offline in-app navigation silently fails.
 *   - Static build assets (/_next/static, icons, svg): stale-while-revalidate.
 *   - Media (videos/audio) and cross-origin requests: passthrough, never cached
 *     AUTOMATICALLY (keeps the cache small and avoids storing large future MP4s).
 *
 * Video policy: lesson MP4s are hosted on GitHub Releases (github.com), which is
 * cross-origin, so they are never precached or runtime-cached automatically. Do
 * NOT add MP4 URLs to PRECACHE_URLS — precaching 100 remote videos would blow up
 * storage and defeat the point of this shell. (Guarded by tests/sw-policy.test.mjs.)
 *
 * Opt-in exception (Sprint 7): a learner can explicitly save one lesson via the
 * page (see src/lib/offline.ts), which stores the MP4 in a DEDICATED video cache.
 * When a request URL is already present in that cache we serve it from there,
 * including HTTP Range requests so seeking works offline. The service worker
 * itself NEVER writes to the video cache — saving is only ever user-initiated.
 *
 * Update flow (Sprint 26 — consent-based): install NO LONGER calls skipWaiting(),
 * so a freshly installed worker parks in the `waiting` state instead of taking
 * over a running client mid-session (which risks running old JS against a new
 * worker). The page (src/components/pwa-register.tsx + src/lib/sw-update.ts)
 * detects the waiting worker and shows an "Update available" toast; only when the
 * learner taps Refresh does the page post a { type: "SKIP_WAITING" } message,
 * which the handler below turns into skipWaiting(). activate still calls
 * clients.claim() so the newly activated worker controls the reloaded page at
 * once. If the learner dismisses the toast, the waiting worker activates on its
 * own once every tab is closed — nobody is left on a stale version.
 *
 * Bump CACHE_VERSION to invalidate old caches on the next activate.
 */
const CACHE_VERSION = "v2";
const CACHE = `learn10-${CACHE_VERSION}`;

// Dedicated bucket for user-saved lesson videos. Kept separate from the app
// shell cache so activate cleanup can preserve saved videos across app updates.
// Must stay in sync with VIDEO_CACHE in src/lib/offline.ts.
const VIDEO_CACHE = "learn10-videos-v1";

// App shell pages worth precaching so a cold offline launch still renders.
const PRECACHE_URLS = ["/", "/daily", "/review", "/favorites", "/privacy", "/offline", "/icon.svg"];

self.addEventListener("install", (event) => {
  // NOTE: intentionally NO skipWaiting() here — a new worker waits for consent
  // (see the header comment and the "message" handler below) instead of taking
  // over a running client mid-session.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // best-effort; a missing page must not block install
  );
});

// Consent-based activation: the page posts { type: "SKIP_WAITING" } when the
// learner taps "Refresh" in the update toast. Only then does the waiting worker
// take over; activate's clients.claim() then controls the page for the reload.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Delete every stale cache EXCEPT the current app shell and the dedicated
      // video cache — saved lessons must survive app updates.
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k !== VIDEO_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isMedia(url) {
  return /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?|$)/i.test(url.pathname) || url.pathname.startsWith("/videos/");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static") || /\.(svg|png|ico|webmanifest|css|js|woff2?)(\?|$)/i.test(url.pathname);
}

// React Server Component payloads: the App Router fetches these on client-side
// <Link> navigations. They're same-origin GETs that carry either the `_rsc`
// cache-busting search param or an `RSC` request header — neither a navigation
// nor a static asset, so they'd otherwise slip through uncached and fail offline.
function isRscRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.searchParams.has("_rsc")) return true;
  return Boolean(request.headers.get("RSC") || request.headers.get("rsc"));
}

// Network-first so fresh payloads win when online; cache each success keyed by the
// FULL URL (the `_rsc` value is build-specific, so the search string matters).
// Offline, serve a cached payload if we have one; on a total miss REJECT — never a
// synthetic 200 — so Next's hard-navigation fallback takes over and the cached
// HTML from the navigation handler renders the page.
async function serveRsc(request) {
  try {
    const res = await fetch(request);
    if (isCacheable(res)) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(request.url, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request.url);
    if (cached) return cached;
    throw err; // no cache entry → let Next fall back to a hard navigation
  }
}

// Only cache real, successful, same-origin responses. Guards against storing
// 404/500 pages, redirects, or opaque partials and later serving them offline.
function isCacheable(res) {
  return res && res.ok && res.type === "basic";
}

// Parse a single HTTP Range header ("bytes=start-end") against a known total
// size. Returns { start, end } (inclusive) or null when unsatisfiable/invalid.
// Exported for tests via the sw.js source (see tests/sw-policy.test.mjs).
function parseRange(header, size) {
  if (typeof header !== "string") return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  if (startStr === "" && endStr === "") return null;

  let start;
  let end;
  if (startStr === "") {
    // Suffix form: last N bytes.
    const suffix = parseInt(endStr, 10);
    if (!suffix) return null;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === "" ? size - 1 : parseInt(endStr, 10);
  }

  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start > end || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

// Build a 206 Partial Content response by slicing a full cached response, or a
// 416 when the requested range can't be satisfied.
async function buildRangeResponse(cached, rangeHeader) {
  const buffer = await cached.arrayBuffer();
  const total = buffer.byteLength;
  const range = parseRange(rangeHeader, total);

  if (!range) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" },
    });
  }

  const chunk = buffer.slice(range.start, range.end + 1);
  const headers = new Headers(cached.headers);
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${total}`);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(chunk.byteLength));
  if (!headers.get("Content-Type")) headers.set("Content-Type", "video/mp4");

  return new Response(chunk, { status: 206, statusText: "Partial Content", headers });
}

// Media handler. Serves a saved lesson from the dedicated video cache (with Range
// support) and otherwise passes straight through to the network. NEVER writes to
// any cache here — saving is exclusively a user action via src/lib/offline.ts.
async function serveMedia(request) {
  const cache = await caches.open(VIDEO_CACHE);
  // Match by URL string so a request carrying a Range header still hits the
  // stored full response.
  const cached = await cache.match(request.url);
  if (!cached) return fetch(request); // unsaved video → normal network passthrough

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) return buildRangeResponse(cached, rangeHeader);
  return cached;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Media (same- or cross-origin): opt-in cache lookup first, else passthrough.
  // Handled before the cross-origin guard because lesson MP4s live on github.com.
  if (isMedia(url)) {
    event.respondWith(serveMedia(request));
    return;
  }

  if (url.origin !== self.location.origin) return; // ignore cross-origin (YouTube, fonts CDN…)

  // Navigations → network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline")))
    );
    return;
  }

  // RSC payloads (client-side <Link> navigations) → network-first, cache fallback.
  if (isRscRequest(request, url)) {
    event.respondWith(serveRsc(request));
    return;
  }

  // Static assets → stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (isCacheable(res)) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
