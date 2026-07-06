import rawData from "@/data/topics.json";
import type { Category, HomeData, MandarinData, Topic, VocabItem } from "./types";
import * as logic from "./data-logic";
import { topicCharConnections, type CharConnectionGroup } from "./connections-logic";

export type { PathSection } from "./data-logic";

export const data = rawData as MandarinData;

// Slimmed dataset for the home route: the full topic list minus per-item example
// sentences. Built once at module scope so `homeData()` is a cheap accessor. See
// toTopicSummary — this is what keeps the home page's serialized payload small.
const home: HomeData = {
  categories: data.categories,
  topics: data.topics.map(logic.toTopicSummary),
};

/** The slimmed home dataset (no example sentences). Safe to pass across the
 *  `"use client"` boundary without bloating the RSC payload / client chunk. */
export function homeData(): HomeData {
  return home;
}

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

export function datasetSummary(topics: Topic[] = data.topics) {
  return logic.datasetSummary(topics);
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

/**
 * Shared-character connections for one topic's words: a `wordKey → groups` map of
 * the other dataset words that share a hanzi with each word on the topic. Computed
 * from the full dataset (server-side only), it stays capped to a few KB so the
 * topic page can pass it as a prop without bundling topics.json into any client
 * chunk. See connections-logic.ts.
 */
export function charConnectionsForTopic(topic: Topic): Record<string, CharConnectionGroup[]> {
  return topicCharConnections(data.topics, topic);
}
