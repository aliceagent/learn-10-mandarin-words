import test from "node:test";
import assert from "node:assert/strict";

import {
  toVideoMeta,
  buildPlan,
  isLocalMp4,
  isRemoteMp4,
} from "../scripts/map-videos.mjs";

test("isLocalMp4 / isRemoteMp4 classify sources", () => {
  assert.equal(isLocalMp4("/videos/ten-types-of-pets.mp4"), true);
  assert.equal(isLocalMp4("https://cdn.example.com/a.mp4"), false);
  assert.equal(isLocalMp4("/videos/Bad_Slug.mp4"), false);
  assert.equal(isRemoteMp4("https://cdn.example.com/a.mp4"), true);
  assert.equal(isRemoteMp4("/videos/ten-types-of-pets.mp4"), false);
});

test("toVideoMeta parses youtube, remote mp4, and local mp4 strings", () => {
  assert.deepEqual(toVideoMeta("dQw4w9WgXcQ"), { provider: "youtube", source: "dQw4w9WgXcQ" });
  assert.deepEqual(toVideoMeta("https://youtu.be/dQw4w9WgXcQ"), {
    provider: "youtube",
    source: "dQw4w9WgXcQ",
  });
  assert.deepEqual(toVideoMeta("https://cdn.example.com/x.mp4"), {
    provider: "mp4",
    source: "https://cdn.example.com/x.mp4",
  });
  assert.deepEqual(toVideoMeta("/videos/ten-types-of-fruit.mp4"), {
    provider: "mp4",
    source: "/videos/ten-types-of-fruit.mp4",
  });
});

test("toVideoMeta accepts object form with poster + captions", () => {
  const captions = [{ lang: "en", label: "English", src: "https://x/c.vtt" }];
  assert.deepEqual(
    toVideoMeta({ provider: "mp4", source: "/videos/a.mp4", poster: "https://x/p.jpg", captions }),
    { provider: "mp4", source: "/videos/a.mp4", poster: "https://x/p.jpg", captions }
  );
});

test("toVideoMeta rejects invalid entries", () => {
  assert.throws(() => toVideoMeta("not a valid source"), /neither a YouTube/);
  assert.throws(() => toVideoMeta({ provider: "vimeo", source: "x" }), /provider must be/);
  assert.throws(() => toVideoMeta({ provider: "mp4", source: "" }), /missing "source"/);
  assert.throws(() => toVideoMeta({ provider: "mp4", source: "/tmp/a.mp4" }), /must be an .mp4 URL/);
  assert.throws(() => toVideoMeta({ provider: "youtube", source: "too-short" }), /invalid YouTube/);
});

function fakeTopics(slugs) {
  return new Map(slugs.map((s) => [s, { slug: s, videoPath: `/videos/${s}.mp4` }]));
}

test("buildPlan promotes youtube + remote mp4 and keeps videoPath in sync", () => {
  const bySlug = fakeTopics(["ten-types-of-pets", "ten-types-of-drinks"]);
  const { changes, problems, warnings } = buildPlan(
    {
      "ten-types-of-pets": "dQw4w9WgXcQ",
      "ten-types-of-drinks": { provider: "mp4", source: "https://cdn.example.com/d.mp4" },
    },
    bySlug,
    { videoExists: () => false }
  );
  assert.equal(problems.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(changes.length, 2);
  assert.ok(changes.every((c) => c.setsVideoPath));
});

test("buildPlan skips missing local files with a warning, never a change", () => {
  const bySlug = fakeTopics(["ten-types-of-fruit"]);
  const { changes, warnings } = buildPlan(
    { "ten-types-of-fruit": { provider: "mp4", source: "/videos/ten-types-of-fruit.mp4" } },
    bySlug,
    { videoExists: () => false }
  );
  assert.equal(changes.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /not found under public\/videos/);
});

test("buildPlan promotes a local file that exists", () => {
  const bySlug = fakeTopics(["ten-types-of-fruit"]);
  const { changes, warnings } = buildPlan(
    { "ten-types-of-fruit": { provider: "mp4", source: "/videos/ten-types-of-fruit.mp4" } },
    bySlug,
    { videoExists: (src) => src === "/videos/ten-types-of-fruit.mp4" }
  );
  assert.equal(warnings.length, 0);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].setsVideoPath, true);
  assert.equal(changes[0].meta.source, "/videos/ten-types-of-fruit.mp4");
});

test("buildPlan reports unknown slugs and ignores _comment keys", () => {
  const bySlug = fakeTopics(["ten-types-of-pets"]);
  const { changes, problems } = buildPlan(
    { _comment: "template note", "no-such-topic": "dQw4w9WgXcQ" },
    bySlug,
    { videoExists: () => false }
  );
  assert.equal(changes.length, 0);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Unknown topic slug "no-such-topic"/);
});
