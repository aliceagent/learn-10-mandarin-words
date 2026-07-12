import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  CORE_OFFLINE_ASSETS,
  CORE_OFFLINE_ROUTES,
  isOfflineAppUrlSafe,
  offlineAppManifestUrls,
} from "../src/lib/offline-app-manifest.ts";

const topicsPath = fileURLToPath(new URL("../src/data/topics.json", import.meta.url));
const data = JSON.parse(readFileSync(topicsPath, "utf8"));

test("CORE_OFFLINE_ROUTES covers every top-level app surface needed for offline study", () => {
  assert.deepEqual(CORE_OFFLINE_ROUTES, [
    "/",
    "/path",
    "/review",
    "/practice",
    "/favorites",
    "/stats",
    "/settings",
    "/offline",
    "/daily",
    "/comeback",
    "/duel",
    "/lightning",
    "/tone-pairs",
    "/privacy",
  ]);
});

test("CORE_OFFLINE_ASSETS includes metadata and icon assets, not media", () => {
  assert.deepEqual(CORE_OFFLINE_ASSETS, [
    "/search-index.json",
    "/manifest.webmanifest",
    "/icon.svg",
    "/icon-maskable.svg",
    "/favicon.ico",
  ]);
  for (const url of CORE_OFFLINE_ASSETS) {
    assert.doesNotMatch(url, /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?|$)/i);
  }
});

test("offlineAppManifestUrls includes every category and topic route exactly once", () => {
  const urls = offlineAppManifestUrls(data);
  const set = new Set(urls);

  assert.equal(set.size, urls.length, "offline manifest must not contain duplicates");

  for (const category of data.categories) {
    assert.ok(set.has(`/categories/${category.slug}`), `missing category ${category.slug}`);
  }
  for (const topic of data.topics) {
    assert.ok(set.has(`/topics/${topic.slug}`), `missing topic ${topic.slug}`);
  }

  assert.equal(data.categories.length, 14);
  assert.equal(data.topics.length, 108);
  assert.equal(urls.length, CORE_OFFLINE_ROUTES.length + CORE_OFFLINE_ASSETS.length + data.categories.length + data.topics.length);
});

test("offlineAppManifestUrls excludes videos, proxy endpoints, external URLs, and unsafe paths", () => {
  const urls = offlineAppManifestUrls(data);
  for (const url of urls) {
    assert.equal(isOfflineAppUrlSafe(url), true, `unsafe manifest URL: ${url}`);
    assert.doesNotMatch(url, /^https?:\/\//i, `external URL included: ${url}`);
    assert.doesNotMatch(url, /\/video-proxy\//, `video proxy URL included: ${url}`);
    assert.doesNotMatch(url, /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?|$)/i, `media URL included: ${url}`);
  }

  assert.equal(isOfflineAppUrlSafe("https://example.com/x"), false);
  assert.equal(isOfflineAppUrlSafe("/video-proxy/github-releases/tag/file.mp4"), false);
  assert.equal(isOfflineAppUrlSafe("/videos/demo.mp4"), false);
  assert.equal(isOfflineAppUrlSafe("javascript:alert(1)"), false);
});
