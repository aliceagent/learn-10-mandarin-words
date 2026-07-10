import test from "node:test";
import assert from "node:assert/strict";

import {
  offlineAppPackButtonLabel,
  offlineAppPackCopy,
  offlineAppPackProgressLabel,
} from "../src/lib/offline-app-pack-ui.ts";

test("offlineAppPackCopy explains app readiness and keeps videos separate", () => {
  assert.deepEqual(offlineAppPackCopy("not-ready", { cached: 0, total: 123, missing: ["/"] }), {
    tone: "amber",
    title: "Prepare app for offline",
    status: "Not ready for airplane mode yet",
    body: "Download the app pages, vocabulary, flashcards, quizzes, review, and saved-list screens. Videos are separate — save those from lessons or categories.",
  });

  assert.deepEqual(offlineAppPackCopy("ready", { cached: 123, total: 123, missing: [] }), {
    tone: "emerald",
    title: "Ready for offline study",
    status: "123 app pages ready offline",
    body: "The app shell and study screens are cached on this device. Saved videos are managed separately below.",
  });
});

test("offlineAppPackCopy reports partial readiness with missing count", () => {
  assert.deepEqual(offlineAppPackCopy("partial", { cached: 120, total: 123, missing: ["/a", "/b", "/c"] }), {
    tone: "sky",
    title: "Partially ready offline",
    status: "120 of 123 app pages cached",
    body: "3 items still need to download before this is fully flight-ready. Try Prepare app for offline again while connected.",
  });
});

test("offlineAppPackButtonLabel changes by state and progress", () => {
  assert.equal(offlineAppPackButtonLabel("not-ready", false), "Prepare app for offline");
  assert.equal(offlineAppPackButtonLabel("partial", false), "Finish offline setup");
  assert.equal(offlineAppPackButtonLabel("ready", false), "Refresh offline app pack");
  assert.equal(offlineAppPackButtonLabel("ready", true), "Preparing…");
});

test("offlineAppPackProgressLabel gives human progress text", () => {
  assert.equal(offlineAppPackProgressLabel(null), null);
  assert.equal(offlineAppPackProgressLabel({ done: 0, total: 123, current: "/" }), "Caching 1 of 123…");
  assert.equal(offlineAppPackProgressLabel({ done: 122, total: 123, current: "/topics/x" }), "Caching 123 of 123…");
});
