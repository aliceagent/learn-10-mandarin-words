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
