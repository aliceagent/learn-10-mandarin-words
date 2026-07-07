// Decide the single "smart" primary action the home hero should lead with,
// adapting to the learner's state. Pure module: no React, no DOM — it maps the
// live topic list + persisted progress into one CTA descriptor the hero renders.
//
// Precedence (most specific first):
//   resume   — a resolvable last activity (Sprint 2's lastActivity) exists.
//   continue — nothing to resume, but the learner has marked ≥1 list learned.
//   start    — a brand-new visitor: point at the first recommended lesson.
//
// It composes existing selectors (resolveResumeTarget, nextRecommendedTopic,
// recommendedPath) rather than re-deriving any topic-selection logic, so the
// hero, the resume card, and the continue card can never disagree.

import type { ProgressState, Topic } from "./types";
import { nextRecommendedTopic, recommendedPath } from "./data-logic.ts";
import { resolveResumeTarget } from "./resume-logic.ts";

export type PrimaryCta =
  | { kind: "resume"; href: string; label: string; sub: string }
  | { kind: "continue"; href: string; label: string; sub: string }
  | { kind: "start"; href: string; label: string; sub: string };

// resolveResumeTarget needs titleCn + categorySlug (to know a topic's own default
// mode), so the CTA reader takes the same widened topic shape.
type CtaTopic = Pick<Topic, "slug" | "titleEn" | "titleCn" | "categorySlug">;

// The href for the "continue"/"start" cases: a bare topic link (no mode) — those
// cases nudge toward a whole lesson, not one exact drill (that's "resume").
function topicHref(slug: string): string {
  return `/topics/${slug}`;
}

export function primaryCta<T extends CtaTopic>(
  topics: T[],
  progress: Pick<ProgressState, "learnedTopics" | "lastActivity">,
): PrimaryCta {
  // 1. Resume — a resolvable last activity always wins, whatever the learned
  //    count. A dropped/renamed slug resolves to null and falls through, so this
  //    never produces a broken href.
  const resume = resolveResumeTarget(topics, progress.lastActivity);
  if (resume) {
    return {
      kind: "resume",
      href: resume.href,
      label: `Resume: ${resume.topicTitleEn}`,
      sub: `${resume.modeLabel} · one tap back in`,
    };
  }

  const learnedCount = progress.learnedTopics.length;

  // 2. Continue — a returning learner with progress but nothing mid-flight.
  if (learnedCount > 0) {
    const next = nextRecommendedTopic(topics, progress.learnedTopics);
    if (next) {
      return {
        kind: "continue",
        href: topicHref(next.slug),
        label: `Continue: ${next.titleEn}`,
        sub: `${learnedCount} list${learnedCount !== 1 ? "s" : ""} learned · keep going`,
      };
    }
  }

  // 3. Start — a brand-new visitor: point at the head of the recommended path.
  const first = recommendedPath(topics)[0];
  return {
    kind: "start",
    href: first ? topicHref(first.slug) : "#library",
    label: "Start your first lesson",
    sub: "10 words, one short video, then practice",
  };
}
