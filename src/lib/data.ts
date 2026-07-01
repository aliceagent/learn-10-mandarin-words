import rawData from "@/data/topics.json";
import type { MandarinData, Topic, VocabItem } from "./types";

export const data = rawData as MandarinData;

export function getTopic(slug: string): Topic | undefined {
  return data.topics.find((topic) => topic.slug === slug);
}

export function wordKey(topic: Topic, item: VocabItem): string {
  return `${topic.slug}:${item.hanzi}`;
}

export function allWords() {
  return data.topics.flatMap((topic) =>
    topic.items.map((item) => ({ ...item, topicSlug: topic.slug, topicTitle: topic.titleEn, category: topic.category }))
  );
}

// A hand-picked starter sequence of concrete, high-frequency topics that read
// well as a first path. These are real slugs from topics.json; any that go
// missing are silently skipped, and the path always falls back to data order.
const STARTER_SLUGS = [
  "ten-types-of-pets",
  "ten-types-of-tropical-fruit",
  "ten-types-of-drinks",
  "ten-types-of-vegetables",
  "ten-types-of-weather",
  "ten-types-of-vehicles",
];

/** Ordered list of recommended starter topics, drawn only from existing data. */
export function recommendedPath(): Topic[] {
  const picked = STARTER_SLUGS.map((slug) => getTopic(slug)).filter((t): t is Topic => Boolean(t));
  if (picked.length >= 3) return picked;
  // Fallback: first few topics in natural data order.
  return data.topics.slice(0, 6);
}

/**
 * The next topic to nudge the user toward: the first recommended topic they
 * have not marked learned, then the first unlearned topic overall, then topic 1.
 */
export function nextRecommendedTopic(learnedTopics: string[]): Topic {
  const learned = new Set(learnedTopics);
  const path = recommendedPath();
  return (
    path.find((t) => !learned.has(t.slug)) ??
    data.topics.find((t) => !learned.has(t.slug)) ??
    data.topics[0]
  );
}
