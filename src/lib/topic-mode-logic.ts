// Single source of truth for the topic practice modes. This replaces the inline
// union that used to live in topic-app.tsx and gives every surface (the topic
// tabs, the resume card, the hero, teacher-shared links) one canonical list of
// mode ids, their human labels, and a URL (de)serialization pair.
//
// Pure module: no React, no DOM. It only knows about strings, so it stays
// testable with `node --test` and reusable from server/client alike.

import type { QuizMode } from "./quiz-logic.ts";

// Canonical order — matches the left-to-right tab order rendered in
// topic-app.tsx. Keep this array and that tab strip in lockstep; a test guards
// the length/order against drift.
export const TOPIC_MODES = [
  "phrasebook",
  "words",
  "flashcards",
  "quiz",
  "typed",
  "match",
  "memory",
  "cloze",
  "scramble",
  "sentence-listen",
  "boss",
] as const;

export type TopicMode = (typeof TOPIC_MODES)[number];

// Human labels — must match the tab labels rendered in topic-app.tsx (the Boss
// tab shows "Boss 👑" once crowned, but its base label is "Boss").
export const MODE_LABELS: Record<TopicMode, string> = {
  phrasebook: "Phrasebook",
  words: "Words",
  flashcards: "Cards",
  quiz: "Quiz",
  typed: "Type",
  match: "Match",
  memory: "Memory",
  cloze: "Sentences",
  scramble: "Scramble",
  "sentence-listen": "Listening",
  boss: "Boss",
};

// Quiz sub-mode reuses quiz-logic's QuizMode; re-exported here so resume/href
// callers have one import site for everything mode-related.
export type ResumableQuizMode = QuizMode;

export const RESUMABLE_QUIZ_MODES = [
  "hanzi-english",
  "english-hanzi",
  "hanzi-pinyin",
  "listening",
] as const;

// Human labels for the quiz sub-modes — must match the direction labels rendered
// on the quiz panel's mode chips (topic/quiz-panel.tsx). Used by resume-logic to
// spell out "Quiz · English → Hanzi" on the home resume card.
export const QUIZ_MODE_LABELS: Record<ResumableQuizMode, string> = {
  "hanzi-english": "Hanzi → English",
  "english-hanzi": "English → Hanzi",
  "hanzi-pinyin": "Hanzi → Pinyin",
  listening: "Listening",
};

// The quiz panel's own default sub-mode (topic-app initializes quizMode to this).
// Kept here so modeQuery can omit `q` when it equals the default and URLs stay
// canonical.
export const DEFAULT_QUIZ_MODE: ResumableQuizMode = "hanzi-english";

const MODE_SET = new Set<string>(TOPIC_MODES);
const QUIZ_MODE_SET = new Set<string>(RESUMABLE_QUIZ_MODES);

// Parse a mode from a raw query value; return null if absent/invalid so the
// caller can fall back to the topic default (phrasebook vs words). Case
// sensitive on purpose — the codes we emit are always lowercase.
export function parseMode(raw: string | null | undefined): TopicMode | null {
  if (typeof raw !== "string") return null;
  return MODE_SET.has(raw) ? (raw as TopicMode) : null;
}

export function parseQuizMode(raw: string | null | undefined): ResumableQuizMode | null {
  if (typeof raw !== "string") return null;
  return QUIZ_MODE_SET.has(raw) ? (raw as ResumableQuizMode) : null;
}

// Build the query string for a mode (+ optional quiz sub-mode). Omits params
// that equal a default so a plain "/topics/slug" stays canonical:
//   - `m` is dropped when it equals opts.defaultMode (the topic's own default).
//   - `q` is only ever emitted for the quiz mode, and dropped when it equals the
//     quiz default (hanzi-english) or is absent.
// Returns "" (not "?") when nothing needs encoding.
export function modeQuery(
  mode: TopicMode,
  quizMode?: ResumableQuizMode | null,
  opts?: { defaultMode?: TopicMode },
): string {
  const params = new URLSearchParams();
  if (mode !== opts?.defaultMode) params.set("m", mode);
  if (mode === "quiz" && quizMode && quizMode !== DEFAULT_QUIZ_MODE) {
    params.set("q", quizMode);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Full href helper used by the shelf/hero/resume card. A bare slug (no mode, or
// a mode that equals the topic default handled by the caller) yields the
// canonical "/topics/{slug}".
export function topicModeHref(
  slug: string,
  mode?: TopicMode | null,
  quizMode?: ResumableQuizMode | null,
): string {
  const base = `/topics/${slug}`;
  if (!mode) return base;
  return base + modeQuery(mode, quizMode);
}
