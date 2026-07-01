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

/** Slug of the practical-phrases category (see topics.json / getCategory). */
export const USEFUL_PHRASES_CATEGORY_SLUG = "useful-phrases";

/**
 * Whether a topic belongs to the Useful Phrases category. Keyed off the topic's
 * own `categorySlug` (stable dataset identifier), never off item text, so it
 * stays correct if phrases are added, edited, or reworded.
 */
export function isUsefulPhraseTopic(topic: Pick<Topic, "categorySlug">): boolean {
  return topic.categorySlug === USEFUL_PHRASES_CATEGORY_SLUG;
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

// A resolved section of the guided learning path: a titled group of real topics.
export type PathSection = {
  key: string;
  title: string;
  blurb: string;
  topics: Topic[];
};

// The curriculum spine. Each section (after the curated starter) maps to one or
// more existing category slugs, and the sections together cover all 14
// categories in a sensible learn-from-here order. Nothing is invented: every
// topic is pulled from the dataset, and empty sections are dropped. `starter`
// pulls from `recommendedPath` so the two stay in lockstep.
const PATH_SECTION_DEFS: { key: string; title: string; blurb: string; categorySlugs: string[] }[] = [
  {
    key: "everyday-life",
    title: "Everyday life",
    blurb: "Words you reach for at home, getting dressed, and talking about people.",
    categorySlugs: ["home-and-objects", "clothing-and-accessories", "body-and-health", "people-and-jobs"],
  },
  {
    key: "nature-and-animals",
    title: "Nature & animals",
    blurb: "Living things and the natural world around you.",
    categorySlugs: ["animals-and-living-things", "plants-and-nature"],
  },
  {
    key: "food-and-drink",
    title: "Food & drink",
    blurb: "Order, cook, and talk about meals with confidence.",
    categorySlugs: ["food-and-drink"],
  },
  {
    key: "travel-and-places",
    title: "Travel & places",
    blurb: "Get around town and beyond — places, buildings, and transport.",
    categorySlugs: ["travel-and-tourism", "places-and-buildings", "transportation"],
  },
  {
    key: "activities-and-ideas",
    title: "Activities & ideas",
    blurb: "Sports, hobbies, and more abstract vocabulary once the basics stick.",
    categorySlugs: ["sports-and-activities", "abstract-but-picturable", "themed-sub-categories"],
  },
  {
    key: "useful-phrases",
    title: "Useful phrases",
    blurb: "Practical, ready-to-say phrases to round out the path.",
    categorySlugs: ["useful-phrases"],
  },
];

/**
 * The guided learning path as ordered sections of real topics. The first
 * section is the curated `recommendedPath` starter set; the rest group the
 * remaining topics by category in a learn-from-here order. A topic appears in
 * exactly one section (starter topics are not repeated later), and sections
 * with no topics are omitted, so the result is always non-empty and drift-free.
 */
export function pathSections(topics: Topic[]): PathSection[] {
  const seen = new Set<string>();
  const sections: PathSection[] = [];

  const starterTopics = recommendedPath(topics);
  starterTopics.forEach((t) => seen.add(t.slug));
  if (starterTopics.length > 0) {
    sections.push({
      key: "starter-essentials",
      title: "Starter essentials",
      blurb: "Begin here — high-frequency, concrete topics that make a strong first week.",
      topics: starterTopics,
    });
  }

  for (const def of PATH_SECTION_DEFS) {
    const sectionTopics = topics.filter(
      (t) => def.categorySlugs.includes(t.categorySlug) && !seen.has(t.slug)
    );
    sectionTopics.forEach((t) => seen.add(t.slug));
    if (sectionTopics.length > 0) {
      sections.push({ key: def.key, title: def.title, blurb: def.blurb, topics: sectionTopics });
    }
  }

  return sections;
}
