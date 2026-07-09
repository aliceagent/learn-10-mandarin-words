// Page-context helpers for saving individual lesson MP4s for offline playback.
//
// These run in the browser (not the service worker). They fetch a lesson MP4 and
// store it in a dedicated Cache Storage bucket that the service worker then knows
// how to serve — including HTTP Range requests — while the app is offline. See
// public/sw.js for the read side and tests/sw-policy.test.mjs for the invariants.
//
// Design notes:
//   - Saving is ALWAYS user-initiated. Nothing here runs automatically and the
//     service worker never writes to this cache on its own, so videos stay
//     strictly opt-in (no accidental 100-MP4 precache).
//   - The dedicated cache name is separate from the app-shell cache so the
//     service worker's activate cleanup can preserve saved videos across
//     app updates while still evicting stale shell caches.
//   - Cache Storage / fetch are injectable so the logic is unit-testable with
//     fakes (see tests/offline.test.mjs); in the browser they default to the
//     real globals.

/** Dedicated Cache Storage bucket for user-saved lesson videos. */
export const VIDEO_CACHE = "learn10-videos-v1";

/** App-shell cache name — mirrors CACHE in public/sw.js. Only used for the
 *  optional, best-effort caching of the lesson page alongside its video. */
export const APP_CACHE = "learn10-v2";

// Minimal structural types so we can accept either the real CacheStorage or a
// test fake without pulling in the full DOM lib surface.
type CacheLike = {
  match(request: RequestInfo | URL): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
  delete(request: RequestInfo | URL): Promise<boolean>;
  keys(): Promise<readonly Request[]>;
};

type CacheStorageLike = {
  open(cacheName: string): Promise<CacheLike>;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type OfflineDeps = {
  caches?: CacheStorageLike;
  fetch?: FetchLike;
};

export type SaveOptions = OfflineDeps & {
  /** Optional same-origin lesson page URL to also cache into the app shell so
   *  the surrounding page renders offline. Best-effort; failures are ignored. */
  pageUrl?: string;
};

// ── Capability detection ──────────────────────────────────────────────────────

/** True when the Cache Storage API is usable in this environment. Guards the UI
 *  so save controls only appear where they can actually work (secure contexts). */
export function supportsCacheStorage(deps: OfflineDeps = {}): boolean {
  const c = deps.caches ?? (typeof caches !== "undefined" ? caches : undefined);
  return typeof c?.open === "function";
}

/** Whether saving a lesson offline is possible at all here — Cache Storage plus
 *  a way to fetch the media. */
export function isOfflineCapable(deps: OfflineDeps = {}): boolean {
  const f = deps.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  return supportsCacheStorage(deps) && typeof f === "function";
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** Human-readable byte size, e.g. 1536 → "1.5 KB", 1048576 → "1 MB". Returns an
 *  em dash for unknown/invalid sizes so callers can render it directly. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

// ── Shell asset extraction ────────────────────────────────────────────────────

/**
 * Pull the same-origin build-asset URLs a page needs to hydrate out of its HTML —
 * `/_next/static/…` scripts/links and any `.css` file referenced from a `src`/
 * `href` attribute. Regex-based (no DOM) so it runs unchanged in `node --test`.
 *
 * Cross-origin (`https://…`, `//…`), `data:` URIs, and inline sources are ignored;
 * duplicates are collapsed. Root-relative and relative paths are same-origin by
 * definition and kept as-is so they can be fetched against the current origin.
 */
export function extractShellAssetUrls(html: string): string[] {
  const urls = new Set<string>();
  const attr = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attr.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("data:")) continue;
    if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) continue; // cross-origin
    if (raw.startsWith("/_next/static") || /\.css(\?|$)/i.test(raw)) urls.add(raw);
  }
  return [...urls];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveCaches(deps: OfflineDeps): CacheStorageLike {
  const c = deps.caches ?? (typeof caches !== "undefined" ? caches : undefined);
  if (!c) throw new Error("Offline storage isn't available in this browser.");
  return c;
}

function resolveFetch(deps: OfflineDeps): FetchLike {
  const f = deps.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!f) throw new Error("Downloading isn't available in this browser.");
  return f;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a lesson MP4 and store it in the dedicated video cache for offline
 * playback. Rejects (with a user-readable message) when the download fails, the
 * host blocks cross-origin reads (opaque response), or storage is full.
 *
 * Only a real, readable, successful response is stored — never an opaque partial
 * — so the service worker can slice it for Range requests later.
 */
export async function saveLessonOffline(source: string, options: SaveOptions = {}): Promise<void> {
  const cachesApi = resolveCaches(options);
  const doFetch = resolveFetch(options);

  let res: Response;
  try {
    // Prefer CORS so we get a readable response with size/range support.
    res = await doFetch(source, { mode: "cors" });
  } catch {
    try {
      // One final probe distinguishes a CORS-blocked host from a true network
      // failure, but the opaque response itself is NOT stored: opaque MP4s cannot
      // be sliced for Range requests and fail offline playback in real browsers.
      res = await doFetch(source, { mode: "no-cors" });
    } catch {
      throw new Error("Couldn't reach the video. Check your connection and try again.");
    }
  }
  if (res.type === "opaque") {
    throw new Error("This video host doesn't allow offline video saving yet. You can still play it online.");
  }
  if (!res.ok) {
    throw new Error(`Download failed (HTTP ${res.status}). Try again later.`);
  }

  try {
    const cache = await cachesApi.open(VIDEO_CACHE);
    await cache.put(source, res);
  } catch (err) {
    // QuotaExceededError is the common failure once storage is full.
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new Error("Not enough space to save this video. Free up storage and try again.");
    }
    throw new Error("Couldn't save the video to offline storage.");
  }

  // Best-effort: also cache the lesson page so the surrounding UI renders offline.
  // Same-origin only, and never allowed to fail the video save.
  if (options.pageUrl) {
    try {
      await cachePageShell(options.pageUrl, { caches: cachesApi, fetch: doFetch });
    } catch {
      // Non-fatal — the video itself is already saved.
    }
  }
}

async function cachePageShell(pageUrl: string, deps: Required<OfflineDeps>): Promise<void> {
  // Absolute URLs must be verified same-origin; relative paths are same-origin by
  // definition and safe to cache directly.
  if (/^https?:\/\//i.test(pageUrl)) {
    if (typeof location === "undefined") return; // can't verify origin → skip
    try {
      if (new URL(pageUrl).origin !== location.origin) return;
    } catch {
      return;
    }
  }
  const res = await deps.fetch(pageUrl);
  if (!res.ok || res.type === "opaque") return;
  const cache = await deps.caches.open(APP_CACHE);
  // Read the HTML before caching (put() consumes the body stream) so we can also
  // co-cache the /_next/static chunks the page needs to actually hydrate offline
  // — otherwise a saved lesson can render as dead, un-interactive HTML.
  let html = "";
  try {
    html = await res.clone().text();
  } catch {
    html = ""; // can't read the body → cache the doc alone, still best-effort
  }
  await cache.put(pageUrl, res);
  await cacheShellAssets(html, deps.fetch, cache);
}

// Co-cache the build assets referenced by a page's HTML into the app-shell cache.
// Every asset is independent and best-effort: already-cached ones are skipped, and
// any fetch/put failure is swallowed so it can never fail the video save (nor the
// other assets). Only real, successful, same-origin (basic) responses are stored.
async function cacheShellAssets(html: string, doFetch: FetchLike, cache: CacheLike): Promise<void> {
  const assets = extractShellAssetUrls(html);
  await Promise.all(
    assets.map(async (assetUrl) => {
      try {
        if (await cache.match(assetUrl)) return; // already cached — don't re-fetch
        const res = await doFetch(assetUrl);
        if (res.ok && res.type === "basic") await cache.put(assetUrl, res);
      } catch {
        // Non-fatal — one missing chunk must not fail the save or its siblings.
      }
    })
  );
}

/** Remove a previously saved lesson from the video cache. Returns whether an
 *  entry was actually deleted. */
export async function removeLessonOffline(source: string, deps: OfflineDeps = {}): Promise<boolean> {
  const cache = await resolveCaches(deps).open(VIDEO_CACHE);
  return cache.delete(source);
}

/** Whether a lesson MP4 is currently saved for offline playback. */
export async function isLessonSaved(source: string, deps: OfflineDeps = {}): Promise<boolean> {
  if (!supportsCacheStorage(deps)) return false;
  const cache = await resolveCaches(deps).open(VIDEO_CACHE);
  const match = await cache.match(source);
  return Boolean(match && match.type !== "opaque");
}

/** Byte size of a saved lesson, or null when it isn't saved. Prefers the stored
 *  Content-Length header and falls back to reading the body. */
export async function savedLessonSize(source: string, deps: OfflineDeps = {}): Promise<number | null> {
  if (!supportsCacheStorage(deps)) return null;
  const cache = await resolveCaches(deps).open(VIDEO_CACHE);
  const res = await cache.match(source);
  if (!res) return null;
  if (res.type === "opaque") return null;
  const len = res.headers.get("content-length");
  if (len && Number.isFinite(Number(len))) return Number(len);
  try {
    const blob = await res.blob();
    return blob.size;
  } catch {
    return null;
  }
}

/** URLs of every lesson currently saved for offline playback. */
export async function listSavedLessons(deps: OfflineDeps = {}): Promise<string[]> {
  if (!supportsCacheStorage(deps)) return [];
  const cache = await resolveCaches(deps).open(VIDEO_CACHE);
  const requests = await cache.keys();
  const urls: string[] = [];
  for (const request of requests) {
    const cached = await cache.match(request);
    if (cached && cached.type !== "opaque") urls.push(request.url);
  }
  return urls;
}
