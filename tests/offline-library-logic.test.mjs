import test from "node:test";
import assert from "node:assert/strict";

import {
  offlineHomeSummary,
  savedOfflineLessonRows,
} from "../src/lib/offline-library-logic.ts";

const topics = [
  {
    slug: "hotel-facilities",
    titleEn: "Hotel Facilities",
    videoPath: "https://cdn.example.com/hotel.mp4",
  },
  {
    slug: "airport-words",
    titleEn: "Airport Words",
    videoPath: "/videos/airport.mp4",
  },
  {
    slug: "no-video",
    titleEn: "No Video",
    videoPath: "https://youtube.com/watch?v=abcdefghijk",
  },
];

test("savedOfflineLessonRows maps saved MP4 URLs back to lessons with open hrefs", () => {
  const rows = savedOfflineLessonRows(topics, new Set(["https://cdn.example.com/hotel.mp4"]), new Map([["https://cdn.example.com/hotel.mp4", 1024]]));

  assert.deepEqual(rows, [
    {
      url: "https://cdn.example.com/hotel.mp4",
      title: "Hotel Facilities",
      slug: "hotel-facilities",
      href: "/topics/hotel-facilities",
      size: 1024,
    },
  ]);
});

test("savedOfflineLessonRows keeps unknown saved files manageable", () => {
  const rows = savedOfflineLessonRows(topics, new Set(["https://cdn.example.com/custom%20lesson.mp4"]));

  assert.deepEqual(rows, [
    {
      url: "https://cdn.example.com/custom%20lesson.mp4",
      title: "custom lesson.mp4",
      slug: null,
      href: null,
      size: null,
    },
  ]);
});

test("offlineHomeSummary exposes a prominent home CTA only when lessons are saved", () => {
  assert.deepEqual(offlineHomeSummary([]), { hasSavedOffline: false, count: 0, totalBytes: 0, preview: [] });

  const rows = savedOfflineLessonRows(
    topics,
    new Set(["https://cdn.example.com/hotel.mp4", "http://localhost/videos/airport.mp4"]),
    new Map([
      ["https://cdn.example.com/hotel.mp4", 1024],
      ["http://localhost/videos/airport.mp4", 2048],
    ]),
  );

  assert.deepEqual(offlineHomeSummary(rows), {
    hasSavedOffline: true,
    count: 2,
    totalBytes: 3072,
    preview: rows,
  });
});
