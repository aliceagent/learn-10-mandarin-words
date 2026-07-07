// Resolve the persisted `lastActivity` into a ready-to-render "Resume where you
// left off" target for the home page. Pure module: no React, no DOM — it only
// maps a stored activity + the live topic list into an href, titles, and a human
// mode label, or null when there is nothing resumable.
//
// The dataset check lives here (not in progress-logic) so the normalizer stays
// dataset-independent: a slug that has since been renamed/removed simply resolves
// to null and the card hides.

import type { LastActivity, Topic } from "./types";
import { getTopic, isUsefulPhraseTopic } from "./data-logic.ts";
import { MODE_LABELS, QUIZ_MODE_LABELS, modeQuery, type TopicMode } from "./topic-mode-logic.ts";

export type ResumeTarget = {
  slug: string;
  /** Deep link into the exact drill, canonical (topic default omitted). */
  href: string;
  topicTitleEn: string;
  topicTitleCn: string;
  /** e.g. "Words", "Quiz · English → Hanzi" — includes the quiz sub-mode when relevant. */
  modeLabel: string;
};

// Resolve `lastActivity` against the live dataset. Returns null when there is no
// resumable activity or when its topic slug no longer exists (dataset drift).
// `categorySlug` is read to compute the topic's own default mode so the href
// stays canonical (a Useful-Phrases topic defaults to "phrasebook", every other
// topic to "words"); resuming that default yields a bare "/topics/{slug}".
export function resolveResumeTarget<
  T extends Pick<Topic, "slug" | "titleEn" | "titleCn" | "categorySlug">,
>(topics: T[], lastActivity: LastActivity | null | undefined): ResumeTarget | null {
  if (!lastActivity) return null;
  const topic = getTopic(topics, lastActivity.topicSlug);
  if (!topic) return null;

  const { mode, quizMode } = lastActivity;
  const defaultMode: TopicMode = isUsefulPhraseTopic(topic) ? "phrasebook" : "words";
  const base = MODE_LABELS[mode];
  const modeLabel =
    mode === "quiz" && quizMode ? `${base} · ${QUIZ_MODE_LABELS[quizMode]}` : base;

  return {
    slug: topic.slug,
    href: `/topics/${topic.slug}${modeQuery(mode, quizMode, { defaultMode })}`,
    topicTitleEn: topic.titleEn,
    topicTitleCn: topic.titleCn,
    modeLabel,
  };
}
