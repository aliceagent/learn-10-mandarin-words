import type {
  Category,
  Topic,
  TopicIndexEntry,
  TopicSummary,
  VocabItem,
  VocabItemIndex,
  WordIndexEntry,
} from "./types";

// Pure data helpers parameterized by the topics array, extracted from data.ts
// so they can be unit-tested against topics.json without the "@/" path alias.
// data.ts binds these to the real dataset and keeps the same public API.

export function getTopic<T extends Pick<Topic, "slug">>(topics: T[], slug: string): T | undefined {
  return topics.find((topic) => topic.slug === slug);
}

/**
 * Slim a full `Topic` down to the fields the home route actually uses: every
 * topic-level field is kept (including `videoPath`/`video`, so `hasPlayableVideo`
 * keeps working), but each item is reduced to `hanzi`/`pinyin`/`english` —
 * example `sentences` are dropped. This is what lets the home page ship ~118KB
 * instead of ~350KB. Pure and dataset-agnostic; data.ts binds it to topics.json.
 */
export function toTopicSummary(topic: Topic): TopicSummary {
  return {
    ...topic,
    items: topic.items.map((item) => ({
      hanzi: item.hanzi,
      pinyin: item.pinyin,
      english: item.english,
    })),
  };
}

/**
 * Slim a full `Topic` down to the hanzi-only home index entry (Sprint 24): every
 * topic-level field is kept (slug, titles, category, videoPath/video — so
 * `hasPlayableVideo`, the studied count, mastery dots, and the hanzi chips all
 * keep working), but each item is reduced to `{ hanzi }`. Dropping pinyin/english
 * is what takes the home RSC payload from ~118KB to ~75KB; they reload lazily via
 * `toWordIndex`/`mergeWordIndex`. Pure and dataset-agnostic, like toTopicSummary.
 */
export function toTopicIndexEntry(topic: Topic): TopicIndexEntry {
  return {
    ...topic,
    items: topic.items.map((item) => ({ hanzi: item.hanzi })),
  };
}

/**
 * The lazy word-search index: pinyin/english (plus hanzi, to join by position)
 * for every word, grouped by topic slug. Fetched only when the home search box is
 * focused, then merged back with `mergeWordIndex`. Pure; served statically from
 * `/search-index.json`.
 */
export function toWordIndex(topics: Topic[]): WordIndexEntry[] {
  return topics.map((topic) => ({
    slug: topic.slug,
    items: topic.items.map((item) => ({
      hanzi: item.hanzi,
      pinyin: item.pinyin,
      english: item.english,
    })),
  }));
}

/**
 * Rejoin the hanzi-only home index with the lazily-loaded word index into full
 * `TopicSummary[]`, so every existing consumer (search haystack, searchWords,
 * matched-word rows) keeps its shape. When `words` is `null` (not loaded yet) or a
 * topic's slug is missing from it (dataset drift), pinyin/english pad to `""` —
 * the UI never crashes and titles/hanzi search still works. Item order and count
 * follow the index (hanzi is authoritative); word-index items are matched by
 * position within the topic.
 */
export function mergeWordIndex(
  indexTopics: TopicIndexEntry[],
  words: WordIndexEntry[] | null,
): TopicSummary[] {
  const bySlug = new Map<string, WordIndexEntry>();
  if (words) for (const entry of words) bySlug.set(entry.slug, entry);

  return indexTopics.map((topic) => {
    const wordItems = bySlug.get(topic.slug)?.items;
    return {
      ...topic,
      items: topic.items.map((item, i) => ({
        hanzi: item.hanzi,
        pinyin: wordItems?.[i]?.pinyin ?? "",
        english: wordItems?.[i]?.english ?? "",
      })),
    };
  });
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

export function wordKey(topic: Pick<Topic, "slug">, item: Pick<VocabItem, "hanzi">): string {
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

export function datasetSummary(topics: { items: VocabItemIndex[] }[]) {
  const listCount = topics.length;
  const wordCount = topics.reduce((total, topic) => total + topic.items.length, 0);

  return {
    listCount,
    wordCount,
    formattedListCount: new Intl.NumberFormat("en-US").format(listCount),
    formattedWordCount: new Intl.NumberFormat("en-US").format(wordCount),
  };
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
export function recommendedPath<T extends Pick<Topic, "slug">>(topics: T[]): T[] {
  const picked = STARTER_SLUGS.map((slug) => getTopic(topics, slug)).filter((t): t is T => Boolean(t));
  if (picked.length >= 3) return picked;
  // Fallback: first few topics in natural data order.
  return topics.slice(0, 6);
}

/**
 * The next topic to nudge the user toward: the first recommended topic they
 * have not marked learned, then the first unlearned topic overall, then topic 1.
 */
export function nextRecommendedTopic<T extends Pick<Topic, "slug">>(topics: T[], learnedTopics: string[]): T {
  const learned = new Set(learnedTopics);
  const path = recommendedPath(topics);
  return (
    path.find((t) => !learned.has(t.slug)) ??
    topics.find((t) => !learned.has(t.slug)) ??
    topics[0]
  );
}

/**
 * The topic to move on to after finishing `currentSlug`. Like
 * `nextRecommendedTopic`, but it always excludes the topic the learner just
 * completed (even if they have not marked it learned yet, e.g. after a quiz),
 * and returns `null` when there is genuinely no other topic to suggest. Order:
 * first unfinished recommended topic, then first unfinished topic overall.
 */
export function nextTopicAfter<T extends Pick<Topic, "slug">>(
  topics: T[],
  learnedTopics: string[],
  currentSlug: string,
): T | null {
  const done = new Set([...learnedTopics, currentSlug]);
  const path = recommendedPath(topics);
  return (
    path.find((t) => !done.has(t.slug)) ??
    topics.find((t) => !done.has(t.slug)) ??
    null
  );
}

/**
 * Resolve persisted recent-topic slugs back to topic objects for the home
 * "Jump back in" shelf, preserving the given (most-recent-first) order. Slugs
 * that no longer exist in the dataset (renames/removals) are silently dropped,
 * and the result is capped at `limit` (default 3). Generic like
 * nextRecommendedTopic so it works with full Topics or slimmed TopicSummaries.
 */
export function resolveRecentTopics<T extends Pick<Topic, "slug">>(
  topics: T[],
  recentSlugs: string[],
  limit = 3,
): T[] {
  const resolved: T[] = [];
  for (const slug of recentSlugs) {
    if (resolved.length >= limit) break;
    const topic = getTopic(topics, slug);
    if (topic) resolved.push(topic);
  }
  return resolved;
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
