import test from "node:test";
import assert from "node:assert/strict";

import {
  githubReleaseProxyUrl,
  downloadableMp4Url,
  hasPlayableVideo,
  remoteMp4,
  resolveSource,
  youtubeId,
} from "../src/lib/video.ts";

test("youtubeId parses watch, youtu.be, and embed URLs", () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("youtubeId accepts a bare 11-char id and rejects other strings", () => {
  assert.equal(youtubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("too-short"), null);
  assert.equal(youtubeId("/videos/ten-types-of-pets.mp4"), null);
  assert.equal(youtubeId("https://example.com/clip.mp4"), null);
});

test("remoteMp4 detects http/https mp4 URLs only", () => {
  assert.equal(remoteMp4("https://cdn.example.com/a.mp4"), true);
  assert.equal(remoteMp4("http://example.com/a.mp4"), true);
  assert.equal(remoteMp4("https://example.com/a.mp4?token=abc"), true);
  assert.equal(remoteMp4("/videos/ten-types-of-pets.mp4"), false);
  assert.equal(remoteMp4("https://youtu.be/dQw4w9WgXcQ"), false);
});

test("resolveSource prefers explicit youtube metadata", () => {
  const r = resolveSource("/videos/x.mp4", { provider: "youtube", source: "dQw4w9WgXcQ" });
  assert.deepEqual(r, { kind: "youtube", id: "dQw4w9WgXcQ" });
});

test("resolveSource prefers explicit mp4 metadata with poster + captions", () => {
  const captions = [{ lang: "en", label: "English", src: "/c.vtt" }];
  const r = resolveSource("/videos/x.mp4", {
    provider: "mp4",
    source: "https://cdn.example.com/x.mp4",
    poster: "/p.jpg",
    captions,
  });
  assert.deepEqual(r, {
    kind: "mp4",
    src: "https://cdn.example.com/x.mp4",
    poster: "/p.jpg",
    captions,
  });
});

test("githubReleaseProxyUrl maps project release videos to a same-origin Vercel proxy", () => {
  assert.equal(
    githubReleaseProxyUrl(
      "https://github.com/aliceagent/learn-10-mandarin-words/releases/download/mandarin-videos-2026-07-03-gap/ten-types-of-furniture.mp4",
    ),
    "/video-proxy/github-releases/mandarin-videos-2026-07-03-gap/ten-types-of-furniture.mp4",
  );
  assert.equal(githubReleaseProxyUrl("https://cdn.example.com/x.mp4"), null);
  assert.equal(githubReleaseProxyUrl("not a url"), null);
});

test("resolveSource rewrites GitHub Release MP4s through the same-origin proxy", () => {
  const captions = [{ lang: "en", label: "English", src: "/c.vtt" }];
  const r = resolveSource("/videos/x.mp4", {
    provider: "mp4",
    source: "https://github.com/aliceagent/learn-10-mandarin-words/releases/download/tag-one/x.mp4",
    poster: "/p.jpg",
    captions,
  });
  assert.deepEqual(r, {
    kind: "mp4",
    src: "/video-proxy/github-releases/tag-one/x.mp4",
    poster: "/p.jpg",
    captions,
  });
});

test("resolveSource returns placeholder for a bare local /videos path", () => {
  assert.deepEqual(resolveSource("/videos/ten-types-of-pets.mp4"), { kind: "placeholder" });
  assert.deepEqual(resolveSource("/videos/ten-types-of-pets.mp4", { provider: "none" }), {
    kind: "placeholder",
  });
});

test("hasPlayableVideo is true for MP4/YouTube topics and false for placeholders", () => {
  assert.equal(
    hasPlayableVideo({ videoPath: "https://cdn.example.com/x.mp4" }),
    true
  );
  assert.equal(
    hasPlayableVideo({
      videoPath: "/videos/x.mp4",
      video: { provider: "youtube", source: "dQw4w9WgXcQ" },
    }),
    true
  );
  assert.equal(hasPlayableVideo({ videoPath: "/videos/ten-types-of-pets.mp4" }), false);
  assert.equal(
    hasPlayableVideo({ videoPath: "/videos/x.mp4", video: { provider: "none" } }),
    false
  );
});

test("downloadableMp4Url returns MP4 URLs only (null for YouTube/placeholder)", () => {
  assert.equal(
    downloadableMp4Url({ videoPath: "https://cdn.example.com/x.mp4" }),
    "https://cdn.example.com/x.mp4"
  );
  assert.equal(
    downloadableMp4Url({
      videoPath: "/videos/x.mp4",
      video: { provider: "mp4", source: "https://cdn.example.com/y.mp4" },
    }),
    "https://cdn.example.com/y.mp4"
  );
  assert.equal(
    downloadableMp4Url({
      videoPath: "/videos/x.mp4",
      video: {
        provider: "mp4",
        source: "https://github.com/aliceagent/learn-10-mandarin-words/releases/download/tag-one/y.mp4",
      },
    }),
    "/video-proxy/github-releases/tag-one/y.mp4"
  );
  assert.equal(
    downloadableMp4Url({
      videoPath: "/videos/x.mp4",
      video: { provider: "youtube", source: "dQw4w9WgXcQ" },
    }),
    null
  );
  assert.equal(downloadableMp4Url({ videoPath: "/videos/ten-types-of-pets.mp4" }), null);
});

test("resolveSource falls back to interpreting the legacy videoPath", () => {
  assert.deepEqual(resolveSource("https://youtu.be/dQw4w9WgXcQ"), {
    kind: "youtube",
    id: "dQw4w9WgXcQ",
  });
  assert.deepEqual(resolveSource("https://cdn.example.com/x.mp4"), {
    kind: "mp4",
    src: "https://cdn.example.com/x.mp4",
    poster: undefined,
    captions: undefined,
  });
});
