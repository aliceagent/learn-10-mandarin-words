import test from "node:test";
import assert from "node:assert/strict";

import { categoryOfflinePlan, saveLessonsOffline } from "../src/lib/bulk-offline.ts";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Minimal topic shapes — categoryOfflinePlan only reads slug + video fields.
// An mp4 topic carries explicit provider metadata; YouTube and placeholder
// topics must be filtered out of the plan.

function mp4Topic(slug, url) {
  return { slug, videoPath: `/videos/${slug}.mp4`, video: { provider: "mp4", source: url } };
}
function youtubeTopic(slug) {
  return { slug, videoPath: "https://youtu.be/abcdefghijk", video: { provider: "youtube", source: "https://youtu.be/abcdefghijk" } };
}
function placeholderTopic(slug) {
  return { slug, videoPath: `/videos/${slug}.mp4`, video: { provider: "none", source: "" } };
}

const URL_A = "https://cdn.example.com/a.mp4";
const URL_B = "https://cdn.example.com/b.mp4";
const URL_C = "https://cdn.example.com/c.mp4";

// ── categoryOfflinePlan ─────────────────────────────────────────────────────

test("categoryOfflinePlan keeps only downloadable MP4s, skipping YouTube/placeholder", () => {
  const topics = [
    mp4Topic("a", URL_A),
    youtubeTopic("yt"),
    placeholderTopic("soon"),
    mp4Topic("b", URL_B),
  ];
  const plan = categoryOfflinePlan(topics, new Set());
  assert.deepEqual(
    plan.map((p) => p.slug),
    ["a", "b"],
  );
});

test("categoryOfflinePlan drops already-saved URLs", () => {
  const topics = [mp4Topic("a", URL_A), mp4Topic("b", URL_B), mp4Topic("c", URL_C)];
  const plan = categoryOfflinePlan(topics, new Set([URL_B]));
  assert.deepEqual(
    plan.map((p) => p.url),
    [URL_A, URL_C],
  );
});

test("categoryOfflinePlan builds a /topics/<slug> pageUrl for each item", () => {
  const plan = categoryOfflinePlan([mp4Topic("ten-types-of-pets", URL_A)], new Set());
  assert.deepEqual(plan[0], {
    url: URL_A,
    slug: "ten-types-of-pets",
    pageUrl: "/topics/ten-types-of-pets",
  });
});

// ── saveLessonsOffline ──────────────────────────────────────────────────────

function items(...urls) {
  return urls.map((url, i) => ({ url, slug: `s${i}`, pageUrl: `/topics/s${i}` }));
}

test("saveLessonsOffline saves every item sequentially and reports progress", async () => {
  const order = [];
  const progress = [];
  const result = await saveLessonsOffline(items(URL_A, URL_B, URL_C), {
    saveOne: async (url) => {
      order.push(url);
    },
    onProgress: (p) => progress.push({ done: p.done, total: p.total, url: p.current.url }),
  });

  assert.deepEqual(order, [URL_A, URL_B, URL_C]); // in order
  assert.deepEqual(result, { saved: 3, failed: [], skipped: 0, cancelled: false });
  assert.deepEqual(progress, [
    { done: 0, total: 3, url: URL_A },
    { done: 1, total: 3, url: URL_B },
    { done: 2, total: 3, url: URL_C },
  ]);
});

test("saveLessonsOffline passes the item pageUrl through to saveOne", async () => {
  const seen = [];
  await saveLessonsOffline(items(URL_A), {
    saveOne: async (url, options) => {
      seen.push({ url, pageUrl: options.pageUrl });
    },
  });
  assert.deepEqual(seen, [{ url: URL_A, pageUrl: "/topics/s0" }]);
});

test("saveLessonsOffline records one failure and continues", async () => {
  const result = await saveLessonsOffline(items(URL_A, URL_B, URL_C), {
    saveOne: async (url) => {
      if (url === URL_B) throw new Error("Download failed (HTTP 500). Try again later.");
    },
  });

  assert.equal(result.saved, 2); // A and C
  assert.equal(result.skipped, 0);
  assert.equal(result.cancelled, false);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].item.url, URL_B);
  assert.match(result.failed[0].message, /HTTP 500/);
});

test("saveLessonsOffline stops after 2 consecutive failures, counting the rest as skipped", async () => {
  const attempted = [];
  const result = await saveLessonsOffline(items(URL_A, URL_B, URL_C), {
    saveOne: async (url) => {
      attempted.push(url);
      if (url !== URL_A) throw new Error("Not enough space to save this video.");
    },
  });

  // A saved; B and C fail consecutively, but C is the last item so the run
  // simply ends — nothing is left to skip.
  assert.deepEqual(attempted, [URL_A, URL_B, URL_C]);
  assert.equal(result.saved, 1);
  assert.equal(result.failed.length, 2);
  assert.equal(result.skipped, 0); // C was the last item, nothing left
  assert.equal(result.cancelled, false);
});

test("two consecutive failures stop the run and skip remaining items", async () => {
  const attempted = [];
  const result = await saveLessonsOffline(items(URL_A, URL_B, URL_C), {
    saveOne: async (url) => {
      attempted.push(url);
      if (url === URL_A || url === URL_B) throw new Error("quota full");
    },
  });

  assert.deepEqual(attempted, [URL_A, URL_B]); // C never attempted
  assert.equal(result.saved, 0);
  assert.equal(result.failed.length, 2);
  assert.equal(result.skipped, 1); // C skipped
  assert.equal(result.cancelled, false);
});

test("a single failure between successes does not stop the run", async () => {
  const result = await saveLessonsOffline(items(URL_A, URL_B, URL_C), {
    saveOne: async (url) => {
      if (url === URL_A) throw new Error("blip");
      // B and C succeed — the failure counter resets after B.
    },
  });
  assert.equal(result.saved, 2);
  assert.equal(result.failed.length, 1);
  assert.equal(result.skipped, 0);
});

test("saveLessonsOffline honors shouldCancel between items", async () => {
  const attempted = [];
  let calls = 0;
  const result = await saveLessonsOffline(items(URL_A, URL_B, URL_C), {
    saveOne: async (url) => {
      attempted.push(url);
    },
    shouldCancel: () => {
      // Allow the first item, cancel before the second.
      calls++;
      return calls > 1;
    },
  });

  assert.deepEqual(attempted, [URL_A]);
  assert.equal(result.saved, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.skipped, 2); // B and C
});

test("saveLessonsOffline on an empty plan resolves cleanly", async () => {
  const result = await saveLessonsOffline([], { saveOne: async () => {} });
  assert.deepEqual(result, { saved: 0, failed: [], skipped: 0, cancelled: false });
});
