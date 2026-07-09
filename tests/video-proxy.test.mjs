import test from "node:test";
import assert from "node:assert/strict";

import { githubReleaseAssetUrl, proxyVideoResponseHeaders } from "../src/lib/video-proxy.ts";

test("githubReleaseAssetUrl only builds safe project release MP4 URLs", () => {
  assert.equal(
    githubReleaseAssetUrl("mandarin-videos-2026-07-03-gap", "ten-types-of-furniture.mp4"),
    "https://github.com/aliceagent/learn-10-mandarin-words/releases/download/mandarin-videos-2026-07-03-gap/ten-types-of-furniture.mp4",
  );
  assert.equal(githubReleaseAssetUrl("../bad", "ten-types-of-furniture.mp4"), null);
  assert.equal(githubReleaseAssetUrl("tag", "not-video.txt"), null);
  assert.equal(githubReleaseAssetUrl("tag", "../x.mp4"), null);
});

test("proxyVideoResponseHeaders preserves range metadata and forces video/mp4", () => {
  const upstream = new Response("body", {
    status: 206,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": "100",
      "content-range": "bytes 0-99/5282498",
      "accept-ranges": "bytes",
      etag: "abc",
    },
  });

  const headers = proxyVideoResponseHeaders(upstream);
  assert.equal(headers.get("content-type"), "video/mp4");
  assert.equal(headers.get("content-length"), "100");
  assert.equal(headers.get("content-range"), "bytes 0-99/5282498");
  assert.equal(headers.get("accept-ranges"), "bytes");
  assert.equal(headers.get("etag"), "abc");
});
