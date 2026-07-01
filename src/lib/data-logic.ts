import type { Category, Topic, VocabItem } from "./types";

// Pure data helpers parameterized by the topics array, extracted from data.ts
// so they can be unit-tested against topics.json without the "@/" path alias.
// data.ts binds these to the real dataset and keeps the same public API.

export function getTopic(topics: Topic[], slug: string): Topic | undefined {
  return topics.find((topic) => topic.slug === slug);
}

/** Look up a category by its slug. */
export function getCategory(categories: Category[], slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

/**
 * All topics belonging to a category, in natural data order. Filters on each
 * topic's own `categorySlug` so it stays correct even if a category's `topics`
 * list and the topics array ever drift.
 */
export function topicsForCategory(topics: Topic[], slug: string): Topic[] {
  return topics.filter((topic) => topic.categorySlug === slug);
}

export function wordKey(topic: Topic, item: VocabItem): string {
  return `${topic.slug}:${item.hanzi}`;
}

export function allWords(topics: Topic[]) {
  return topics.flatMap((topic) =>
    topic.items.map((item) => ({ ...item, topicSlug: topic.slug, topicTitle: topic.titleEn, category: topic.category }))
  );
}

// A hand-picked starter sequence of concrete, high-frequency topics that read
// well as a first path. These are real slugs from topics.json; any that go
// missing are silently skipped, and the path always falls back to data order.
export const STARTER_SLUGS = [
  "ten-types-of-pets",
  "ten-types-of-tropical-fruit",
  "ten-types-of-drinks",
  "ten-types-of-vegetables",
  "ten-types-of-weather",
  "ten-types-of-vehicles",
];

/** Ordered list of recommended starter topics, drawn only from existing data. */
export function recommendedPath(topics: Topic[]): Topic[] {
  const picked = STARTER_SLUGS.map((slug) => getTopic(topics, slug)).filter((t): t is Topic => Boolean(t));
  if (picked.length >= 3) return picked;
  // Fallback: first few topics in natural data order.
  return topics.slice(0, 6);
}

/**
 * The next topic to nudge the user toward: the first recommended topic they
 * have not marked learned, then the first unlearned topic overall, then topic 1.
 */
export function nextRecommendedTopic(topics: Topic[], learnedTopics: string[]): Topic {
  const learned = new Set(learnedTopics);
  const path = recommendedPath(topics);
  return (
    path.find((t) => !learned.has(t.slug)) ??
    topics.find((t) => !learned.has(t.slug)) ??
    topics[0]
  );
}
