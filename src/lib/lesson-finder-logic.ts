// Pure helpers for the front-page "Find your lesson" block (Sprint 4). No React,
// no DOM — they only map the live dataset + persisted progress into the small
// data shapes the finder renders: category chips (browse by theme) and a short,
// stable starter-lessons row (a fast on-ramp for new learners).
//
// Both compose existing selectors / dataset shapes rather than re-deriving any
// ordering, so the finder, the guided path, and the onboarding picker can never
// disagree about what "the starters" are.

import type { Category, Topic } from "./types";
import { recommendedPath } from "./data-logic.ts";

// One browse-by-theme chip per category, linking to its dedicated page. `count`
// is the category's own topic list length (kept in lockstep with the topics
// array by validate:data), and dataset order is preserved so the chips read in
// the same order as the "Browse by category" grid.
export type CategoryChip = {
  name: string;
  slug: string;
  href: string;
  count: number;
};

export type CategoryFilterOption = {
  label: string;
  slug: string;
  count: number;
  active: boolean;
};

export function categoryChips(
  categories: Pick<Category, "name" | "slug" | "topics">[],
): CategoryChip[] {
  return categories.map((category) => ({
    name: category.name,
    slug: category.slug,
    href: `/categories/${category.slug}`,
    count: category.topics.length,
  }));
}

export function categoryFilterOptions(
  categories: Pick<Category, "name" | "slug" | "topics">[],
  selectedSlug: string,
): CategoryFilterOption[] {
  const validSlugs = new Set(categories.map((category) => category.slug));
  const activeSlug = validSlugs.has(selectedSlug) ? selectedSlug : "all";
  const total = categories.reduce((sum, category) => sum + category.topics.length, 0);

  return [
    { label: "All", slug: "all", count: total, active: activeSlug === "all" },
    ...categories.map((category) => ({
      label: category.name,
      slug: category.slug,
      count: category.topics.length,
      active: activeSlug === category.slug,
    })),
  ];
}

/**
 * A short, stable set of starter lessons for the finder's "New here?" row.
 *
 * Drawn from `recommendedPath` (the curated starter sequence, falling back to
 * data order), it prefers topics the learner has not yet marked learned. When
 * too few unlearned starters remain to fill `limit`, it tops up from the head of
 * the path (already-learned starters) so the row always stays populated for a
 * learner who has finished most of them — never returning duplicates and never
 * exceeding the path's own size.
 */
export function starterLessons<T extends Pick<Topic, "slug" | "titleEn" | "titleCn">>(
  topics: T[],
  learnedTopics: string[],
  limit = 6,
): T[] {
  const path = recommendedPath(topics);
  const learned = new Set(learnedTopics);

  const unlearned = path.filter((topic) => !learned.has(topic.slug));
  if (unlearned.length >= limit) return unlearned.slice(0, limit);

  // Fall back to the head of the path (learned starters) to keep the row full,
  // guarding against duplicates for the already-picked unlearned topics.
  const picked = [...unlearned];
  const seen = new Set(picked.map((topic) => topic.slug));
  for (const topic of path) {
    if (picked.length >= limit) break;
    if (seen.has(topic.slug)) continue;
    picked.push(topic);
    seen.add(topic.slug);
  }
  return picked.slice(0, limit);
}
