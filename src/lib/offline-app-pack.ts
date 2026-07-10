import { APP_CACHE, extractShellAssetUrls } from "./offline.ts";
import { isOfflineAppUrlSafe } from "./offline-app-manifest.ts";

type CacheLike = {
  match(request: RequestInfo | URL): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
};

type CacheStorageLike = {
  open(cacheName: string): Promise<CacheLike>;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type OfflineAppPackDeps = {
  caches?: CacheStorageLike;
  fetch?: FetchLike;
};

export type OfflineAppPackFailure = { url: string; message: string };

export type OfflineAppPackResult = {
  total: number;
  cached: number;
  failed: OfflineAppPackFailure[];
  skipped: number;
  cancelled: boolean;
  complete: boolean;
};

export type OfflineAppPackStatus = {
  state: "not-ready" | "partial" | "ready";
  total: number;
  cached: number;
  missing: string[];
};

export type PrepareAppOfflineOptions = OfflineAppPackDeps & {
  onProgress?: (progress: { done: number; total: number; current: string }) => void;
  shouldCancel?: () => boolean;
};

function resolveCaches(deps: OfflineAppPackDeps): CacheStorageLike {
  const c = deps.caches ?? (typeof caches !== "undefined" ? caches : undefined);
  if (!c) throw new Error("Offline storage isn't available in this browser.");
  return c;
}

function resolveFetch(deps: OfflineAppPackDeps): FetchLike {
  const f = deps.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!f) throw new Error("Downloading isn't available in this browser.");
  return f;
}

function safeUrls(urls: readonly string[]): string[] {
  return [...new Set(urls)].filter(isOfflineAppUrlSafe);
}

function responseIsUsable(res: Response): boolean {
  return res.ok && res.type !== "opaque";
}

async function cacheShellAssets(html: string, doFetch: FetchLike, cache: CacheLike): Promise<void> {
  for (const asset of extractShellAssetUrls(html)) {
    if (!isOfflineAppUrlSafe(asset)) continue;
    try {
      if (await cache.match(asset)) continue;
      const res = await doFetch(asset);
      if (responseIsUsable(res)) await cache.put(asset, res);
    } catch {
      // Asset caching is best-effort; the owning page result reports route status.
    }
  }
}

async function cacheAppUrl(url: string, doFetch: FetchLike, cache: CacheLike): Promise<void> {
  const res = await doFetch(url);
  if (!responseIsUsable(res)) {
    throw new Error(`HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    let html = "";
    try {
      html = await res.clone().text();
    } catch {
      html = "";
    }
    await cache.put(url, res);
    await cacheShellAssets(html, doFetch, cache);
    return;
  }

  await cache.put(url, res);
}

export async function prepareAppOffline(
  manifestUrls: readonly string[],
  options: PrepareAppOfflineOptions = {},
): Promise<OfflineAppPackResult> {
  const urls = safeUrls(manifestUrls);
  const cachesApi = resolveCaches(options);
  const doFetch = resolveFetch(options);
  const cache = await cachesApi.open(APP_CACHE);
  const failed: OfflineAppPackFailure[] = [];
  let cached = 0;
  let skipped = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (options.shouldCancel?.()) {
      skipped = urls.length - i;
      return { total: urls.length, cached, failed, skipped, cancelled: true, complete: false };
    }

    options.onProgress?.({ done: i, total: urls.length, current: url });
    try {
      await cacheAppUrl(url, doFetch, cache);
      cached++;
    } catch (err) {
      failed.push({ url, message: err instanceof Error ? err.message : "Couldn't cache this app page." });
    }
  }

  const retryFailures: OfflineAppPackFailure[] = [];
  for (const failure of failed) {
    try {
      await cacheAppUrl(failure.url, doFetch, cache);
      cached++;
    } catch (err) {
      retryFailures.push({
        url: failure.url,
        message: err instanceof Error ? err.message : failure.message,
      });
    }
  }

  return {
    total: urls.length,
    cached,
    failed: retryFailures,
    skipped,
    cancelled: false,
    complete: retryFailures.length === 0 && skipped === 0 && cached === urls.length,
  };
}

export async function appOfflineStatus(
  manifestUrls: readonly string[],
  deps: OfflineAppPackDeps = {},
): Promise<OfflineAppPackStatus> {
  const urls = safeUrls(manifestUrls);
  const cache = await resolveCaches(deps).open(APP_CACHE);
  const missing: string[] = [];

  for (const url of urls) {
    if (!(await cache.match(url))) missing.push(url);
  }

  const cached = urls.length - missing.length;
  const state = cached === 0 ? "not-ready" : missing.length === 0 ? "ready" : "partial";
  return { state, total: urls.length, cached, missing };
}
