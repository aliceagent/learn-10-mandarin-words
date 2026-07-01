import rawData from "@/data/topics.json";
import type { MandarinData, Topic, VocabItem } from "./types";
import * as logic from "./data-logic";

export const data = rawData as MandarinData;

export function getTopic(slug: string): Topic | undefined {
  return logic.getTopic(data.topics, slug);
}

export function wordKey(topic: Topic, item: VocabItem): string {
  return logic.wordKey(topic, item);
}

export function allWords() {
  return logic.allWords(data.topics);
}

/** Ordered list of recommended starter topics, drawn only from existing data. */
export function recommendedPath(): Topic[] {
  return logic.recommendedPath(data.topics);
}

/**
 * The next topic to nudge the user toward: the first recommended topic they
 * have not marked learned, then the first unlearned topic overall, then topic 1.
 */
export function nextRecommendedTopic(learnedTopics: string[]): Topic {
  return logic.nextRecommendedTopic(data.topics, learnedTopics);
}
