import rawData from "@/data/topics.json";
import type { Category, MandarinData, Topic, VocabItem } from "./types";
import * as logic from "./data-logic";

export type { PathSection } from "./data-logic";

export const data = rawData as MandarinData;

export function getTopic(slug: string): Topic | undefined {
  return logic.getTopic(data.topics, slug);
}

/** Look up a category by its slug in the real dataset. */
export function getCategory(slug: string): Category | undefined {
  return logic.getCategory(data.categories, slug);
}

/** All topics in a category, drawn from the real dataset. */
export function topicsForCategory(slug: string): Topic[] {
  return logic.topicsForCategory(data.topics, slug);
}

export function wordKey(topic: Topic, item: VocabItem): string {
  return logic.wordKey(topic, item);
}

/** Whether a topic is part of the Useful Phrases category (phrasebook mode). */
export function isUsefulPhraseTopic(topic: Topic): boolean {
  return logic.isUsefulPhraseTopic(topic);
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

/**
 * The topic to move on to after finishing `currentSlug`, drawn from the real
 * dataset. Never returns the just-finished topic; `null` when none remain.
 */
export function nextTopicAfter(learnedTopics: string[], currentSlug: string): Topic | null {
  return logic.nextTopicAfter(data.topics, learnedTopics, currentSlug);
}

/** The guided learning path as ordered sections, drawn from the real dataset. */
export function pathSections(): logic.PathSection[] {
  return logic.pathSections(data.topics);
}
