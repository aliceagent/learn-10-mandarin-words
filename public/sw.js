/*
 * Minimal offline shell for Learn 10 Mandarin Words. No build step, no deps.
 *
 * Strategy (conservative on purpose):
 *   - Navigations: network-first, fall back to cached page, then /offline.
 *   - Static build assets (/_next/static, icons, svg): stale-while-revalidate.
 *   - Media (videos/audio) and cross-origin requests: passthrough, never cached
 *     (keeps the cache small and avoids storing large future MP4s/audio).
 *
 * Video policy: lesson MP4s are hosted on GitHub Releases (github.com), which is
 * cross-origin, so they hit the cross-origin guard below and are never precached
 * or runtime-cached. Videos therefore need a live connection unless the browser
 * itself already cached a clip. Do NOT add MP4 URLs to PRECACHE_URLS — precaching
 * 100 remote videos would blow up storage and defeat the point of this shell.
 * (Guarded by tests/sw-policy.test.mjs.)
 *
 * Bump CACHE_VERSION to invalidate old caches on the next activate.
 */
const CACHE_VERSION = "v1";
const CACHE = `learn10-${CACHE_VERSION}`;

// App shell pages worth precaching so a cold offline launch still renders.
const PRECACHE_URLS = ["/", "/review", "/favorites", "/privacy", "/offline", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // best-effort; a missing page must not block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isMedia(url) {
  return /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?|$)/i.test(url.pathname) || url.pathname.startsWith("/videos/");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static") || /\.(svg|png|ico|webmanifest|css|js|woff2?)(\?|$)/i.test(url.pathname);
}

// Only cache real, successful, same-origin responses. Guards against storing
// 404/500 pages, redirects, or opaque partials and later serving them offline.
function isCacheable(res) {
  return res && res.ok && res.type === "basic";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin (YouTube, fonts CDN…)
  if (isMedia(url)) return; // never cache heavy media

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
