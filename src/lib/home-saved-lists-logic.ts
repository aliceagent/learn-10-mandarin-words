export type SavedListHomeTopic = {
  slug: string;
  titleEn: string;
  titleCn: string;
  category: string;
  items: readonly unknown[];
};

export type SavedListsHomeSummary<T extends SavedListHomeTopic> = {
  hasSavedLists: boolean;
  visibleTopics: T[];
  listCount: number;
  wordCount: number;
  remainingListCount: number;
};

/**
 * Build the conditional home-page saved-lists preview.
 *
 * The user's saved-topic order is meaningful because it reflects what they saved
 * first. Stale slugs from old exports are ignored so the home page never renders
 * dead links after dataset changes.
 */
export function savedListsHomeSummary<T extends SavedListHomeTopic>(
  topics: readonly T[],
  favoriteTopicSlugs: readonly string[] = [],
  favoriteWordKeys: readonly string[] = [],
  limit = 3,
): SavedListsHomeSummary<T> {
  const bySlug = new Map(topics.map((topic) => [topic.slug, topic]));
  const seen = new Set<string>();
  const savedTopics: T[] = [];

  for (const slug of favoriteTopicSlugs) {
    if (seen.has(slug)) continue;
    const topic = bySlug.get(slug);
    if (!topic) continue;
    savedTopics.push(topic);
    seen.add(slug);
  }

  const safeLimit = Math.max(0, Math.floor(limit));
  const visibleTopics = savedTopics.slice(0, safeLimit);

  return {
    hasSavedLists: savedTopics.length > 0,
    visibleTopics,
    listCount: savedTopics.length,
    wordCount: favoriteWordKeys.length,
    remainingListCount: Math.max(0, savedTopics.length - visibleTopics.length),
  };
}
