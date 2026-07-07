import test from "node:test";
import assert from "node:assert/strict";

import {
  lessonCardStatus,
  lessonCardMeta,
  MASTERED_MAJORITY_RATIO,
} from "../src/lib/lesson-card-logic.ts";

// ── fixtures ──────────────────────────────────────────────────────────────────

// A topic with `count` distinct-hanzi words. `videoPath` defaults to a
// not-yet-connected local placeholder so cards read "no video" unless promoted.
function makeTopic(slug, count = 10, extra = {}) {
  return {
    slug,
    titleEn: slug,
    titleCn: "标题",
    videoPath: "/videos/placeholder.mp4",
    items: Array.from({ length: count }, (_, i) => ({
      hanzi: `${slug}字${i}`,
      pinyin: "pin",
      english: "eng",
    })),
    ...extra,
  };
}

function progress(over = {}) {
  return { flashcardStats: {}, bossStats: {}, learnedTopics: [], ...over };
}

// wordKey is `${slug}:${hanzi}`; build flashcard stats for the first `n` words.
function studiedStats(topic, n, intervalDays = 1) {
  const stats = {};
  for (const item of topic.items.slice(0, n)) {
    stats[`${topic.slug}:${item.hanzi}`] = { reviewCount: 1, intervalDays };
  }
  return stats;
}

// ── lessonCardStatus ──────────────────────────────────────────────────────────

test("new topic with no progress → { kind: 'new', label: 'Not started' }", () => {
  const topic = makeTopic("drinks");
  assert.deepEqual(lessonCardStatus(topic, progress()), {
    kind: "new",
    label: "Not started",
  });
});

test("some words studied → { kind: 'started', label: 'N/total studied' }", () => {
  const topic = makeTopic("drinks", 10);
  const status = lessonCardStatus(topic, progress({ flashcardStats: studiedStats(topic, 3) }));
  assert.deepEqual(status, { kind: "started", label: "3/10 studied" });
});

test("majority of words mastered (interval ≥ threshold) → { kind: 'mastered' }", () => {
  const topic = makeTopic("drinks", 10);
  // 5 words with a week-long interval clears the 50% majority ratio.
  const status = lessonCardStatus(topic, progress({ flashcardStats: studiedStats(topic, 5, 7) }));
  assert.equal(status.kind, "mastered");
  assert.equal(status.label, "Mastered");
});

test("studied but below the mastery majority stays 'started'", () => {
  const topic = makeTopic("drinks", 10);
  // 4 mastered of 10 is under the 0.5 ratio → not yet "Mastered".
  const status = lessonCardStatus(topic, progress({ flashcardStats: studiedStats(topic, 4, 7) }));
  assert.deepEqual(status, { kind: "started", label: "4/10 studied" });
});

test("learned topics show 'Learned ✓'", () => {
  const topic = makeTopic("drinks");
  const status = lessonCardStatus(topic, progress({ learnedTopics: ["drinks"] }));
  assert.deepEqual(status, { kind: "learned", label: "Learned ✓" });
});

test("crowned outranks learned and mastery (precedence: crowned first)", () => {
  const topic = makeTopic("drinks", 10);
  const status = lessonCardStatus(
    topic,
    progress({
      bossStats: { drinks: { crownedAt: "2026-07-01T00:00:00.000Z" } },
      learnedTopics: ["drinks"],
      flashcardStats: studiedStats(topic, 10, 7),
    }),
  );
  assert.deepEqual(status, { kind: "crowned", label: "Crowned 👑" });
});

test("learned outranks mastery when not crowned", () => {
  const topic = makeTopic("drinks", 10);
  const status = lessonCardStatus(
    topic,
    progress({ learnedTopics: ["drinks"], flashcardStats: studiedStats(topic, 10, 7) }),
  );
  assert.equal(status.kind, "learned");
});

test("MASTERED_MAJORITY_RATIO is the exposed 0.5 threshold", () => {
  assert.equal(MASTERED_MAJORITY_RATIO, 0.5);
});

test("tolerates missing progress fields without throwing", () => {
  const topic = makeTopic("drinks");
  assert.deepEqual(lessonCardStatus(topic, {}), { kind: "new", label: "Not started" });
});

// ── lessonCardMeta ────────────────────────────────────────────────────────────

test("meta omits 'video' when no playable video is connected", () => {
  const topic = makeTopic("drinks", 10); // local placeholder path → not playable
  assert.equal(lessonCardMeta(topic), "10 words · quiz");
});

test("meta includes 'video' for a playable remote mp4", () => {
  const topic = makeTopic("drinks", 10, { videoPath: "https://cdn.example.com/drinks.mp4" });
  assert.equal(lessonCardMeta(topic), "10 words · video · quiz");
});

test("meta includes 'video' when explicit youtube metadata is present", () => {
  const topic = makeTopic("drinks", 10, {
    video: { provider: "youtube", source: "https://youtu.be/abcdefghijk" },
  });
  assert.equal(lessonCardMeta(topic), "10 words · video · quiz");
});

test("meta word count matches items.length and singularizes at 1", () => {
  assert.equal(lessonCardMeta(makeTopic("solo", 1)), "1 word · quiz");
  assert.equal(lessonCardMeta(makeTopic("pair", 2)), "2 words · quiz");
});
