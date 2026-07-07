// Pure helpers for the learner/teacher clarity pass (Sprint 5): a single,
// human status per lesson card, and a static "what's in this lesson" metadata
// line. No React, no DOM — both are read-only derivations over the live dataset
// and the persisted progress blob, so every card surface (home library,
// category pages, guided path) can agree on one status vocabulary.
//
// Nothing here re-derives a threshold: mastery comes from `topicProgress`
// (the shared MASTERED_INTERVAL_DAYS SRS threshold), the crown from `isCrowned`,
// and playable-video from `hasPlayableVideo`.

import type { ProgressState, Topic, TopicSummary } from "./types";
import { isCrowned, topicProgress } from "./progress-logic.ts";
import { hasPlayableVideo } from "./video.ts";

// A single, at-a-glance status for a topic card. `label` is display-ready text
// (never color/emoji alone, so screen readers convey it too). The union is
// exhaustive so callers can switch on `kind` for styling without a default.
export type LessonCardStatus =
  | { kind: "new"; label: string } // "Not started"
  | { kind: "started"; label: string } // "3/10 studied"
  | { kind: "mastered"; label: string } // "Mastered" — most words past the SRS threshold
  | { kind: "learned"; label: string } // "Learned ✓"
  | { kind: "crowned"; label: string }; // "Crowned 👑" — a flawless Boss Round

// A card counts as "mastered" once at least half its words have reached the
// shared SRS mastery threshold (MASTERED_INTERVAL_DAYS). Named so the one place
// that decides "all/most" sits here rather than being inlined at a call site.
export const MASTERED_MAJORITY_RATIO = 0.5;

/**
 * Derive the single status shown on a topic card.
 *
 * Precedence — highest first — is deliberate and tested:
 *   crowned > learned > mastered > started > new
 * A crown (a flawless Boss Round) is the strongest signal, then the learner's
 * explicit "Learned" mark, then SRS-derived mastery, then any study at all.
 *
 * Mastery is read from `topicProgress` (flashcard SRS intervals), so quiz stats
 * are intentionally not consulted here — a word's "mastered" status is the
 * long-horizon interval signal, matching `wordStatus`. Tolerant of missing
 * progress fields (legacy saves), so it never throws.
 */
export function lessonCardStatus(
  topic: Pick<TopicSummary, "slug" | "items">,
  progress: Pick<ProgressState, "flashcardStats" | "bossStats" | "learnedTopics">,
): LessonCardStatus {
  const { slug } = topic;

  if (isCrowned(progress.bossStats, slug)) {
    return { kind: "crowned", label: "Crowned 👑" };
  }
  if (progress.learnedTopics?.includes(slug)) {
    return { kind: "learned", label: "Learned ✓" };
  }

  const { studied, mastered, total } = topicProgress(topic, progress.flashcardStats ?? {});
  if (total > 0 && mastered >= total * MASTERED_MAJORITY_RATIO && mastered > 0) {
    return { kind: "mastered", label: "Mastered" };
  }
  if (studied > 0) {
    return { kind: "started", label: `${studied}/${total} studied` };
  }
  return { kind: "new", label: "Not started" };
}

/**
 * A static, dataset-derived "what's in this lesson" line — no progress, so it
 * reads the same for every learner: "10 words · video · quiz" (or "10 words ·
 * quiz" when no playable video is connected yet). Every lesson is quizzable, so
 * "quiz" is always present; "video" appears only when `hasPlayableVideo` is true.
 */
export function lessonCardMeta(
  // Only `items.length` and the video source are read, so accept either the full
  // Topic or the slimmed TopicSummary (whose items drop `sentences`).
  topic: Pick<Topic, "video" | "videoPath"> & { items: readonly unknown[] },
): string {
  const count = topic.items.length;
  const parts = [`${count} word${count === 1 ? "" : "s"}`];
  if (hasPlayableVideo(topic)) parts.push("video");
  parts.push("quiz");
  return parts.join(" · ");
}
