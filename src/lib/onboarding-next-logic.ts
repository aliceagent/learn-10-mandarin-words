// Decide what first-run onboarding should offer as its "next step" (Sprint 6).
// Pure module: no React, no DOM — it maps the live topic list + persisted
// progress into one descriptor the onboarding modal renders.
//
// Two outcomes, most specific first:
//   resume — a returning visitor whose last activity still resolves: skip the
//            picker and offer a one-tap deep link straight back into that drill.
//   pick   — a first-run (or drifted) visitor: a short starter picker so they
//            choose their first lesson instead of being dropped on an arbitrary
//            one, with the finder's exact starter ordering.
//
// It composes existing selectors (resolveResumeTarget, starterLessons) rather
// than re-deriving any topic-selection logic, so the onboarding picker, the
// finder's "New here?" row, and the hero can never disagree about the starters.

import type { ProgressState, Topic } from "./types";
import { starterLessons } from "./lesson-finder-logic.ts";
import { resolveResumeTarget } from "./resume-logic.ts";

// resolveResumeTarget needs titleCn + categorySlug (to know a topic's own default
// mode); the picker only surfaces slug + titles + href — so the reader takes the
// widened shape and narrows it in the "pick" branch.
type OnboardingTopic = Pick<Topic, "slug" | "titleEn" | "titleCn" | "categorySlug">;

export type OnboardingLesson = {
  slug: string;
  titleEn: string;
  titleCn: string;
  href: string;
};

export type OnboardingNext =
  | { kind: "resume"; href: string; label: string }
  | { kind: "pick"; lessons: OnboardingLesson[] };

export function onboardingNext<T extends OnboardingTopic>(
  topics: T[],
  progress: Pick<ProgressState, "learnedTopics" | "lastActivity">,
  limit = 3,
): OnboardingNext {
  // Returning-user precedence — a resolvable last activity means we already know
  // exactly where to send them; the picker would be redundant. A dropped/renamed
  // slug resolves to null and falls through to the picker, never a broken href.
  const resume = resolveResumeTarget(topics, progress.lastActivity);
  if (resume) {
    return {
      kind: "resume",
      href: resume.href,
      label: `Resume: ${resume.topicTitleEn}`,
    };
  }

  // First-run (or drifted) — offer a short starter picker. starterLessons hides
  // already-learned topics and tops up from the path head so the row stays full.
  const lessons = starterLessons(topics, progress.learnedTopics, limit).map((topic) => ({
    slug: topic.slug,
    titleEn: topic.titleEn,
    titleCn: topic.titleCn,
    href: `/topics/${topic.slug}`,
  }));
  return { kind: "pick", lessons };
}
