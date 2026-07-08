import type { FlashcardStat, Topic } from "./types";
import { wordKey } from "./data-logic.ts";
import { flashcardConfidence } from "./flashcard-confidence.ts";
import { isLeech } from "./progress-logic.ts";
import { DEFAULT_FLASHCARD_DECK_ORDER, serializeFlashcardDeckOrder, type FlashcardDeckOrder } from "./flashcard-deck-order.ts";

export type FlashcardHealthSummary = {
  totalWords: number;
  totalTracked: number;
  due: number;
  newWords: number;
  shaky: number;
  solid: number;
  mastered: number;
  needsRescue: number;
};

export type FlashcardTopicHealth = Omit<FlashcardHealthSummary, "totalTracked"> & {
  slug: string;
  title: string;
  tracked: number;
  status: "new" | "due" | "needs rescue" | "building" | "solid" | "mastered";
};

export type FlashcardSettings = {
  showHealthDashboard: boolean;
  defaultDeckOrder: FlashcardDeckOrder;
};

export const DEFAULT_FLASHCARD_SETTINGS: FlashcardSettings = {
  showHealthDashboard: true,
  defaultDeckOrder: DEFAULT_FLASHCARD_DECK_ORDER,
};

const EMPTY_HEALTH: FlashcardHealthSummary = {
  totalWords: 0,
  totalTracked: 0,
  due: 0,
  newWords: 0,
  shaky: 0,
  solid: 0,
  mastered: 0,
  needsRescue: 0,
};

export function normalizeFlashcardSettings(value: unknown): FlashcardSettings {
  if (!value || typeof value !== "object") return DEFAULT_FLASHCARD_SETTINGS;
  const raw = value as Partial<FlashcardSettings>;
  return {
    showHealthDashboard:
      typeof raw.showHealthDashboard === "boolean"
        ? raw.showHealthDashboard
        : DEFAULT_FLASHCARD_SETTINGS.showHealthDashboard,
    defaultDeckOrder: serializeFlashcardDeckOrder(raw.defaultDeckOrder),
  };
}

function classifyStat(stat: FlashcardStat | undefined, now: Date): Omit<FlashcardHealthSummary, "totalWords"> {
  if (!stat || stat.reviewCount <= 0) {
    return { totalTracked: 0, due: 0, newWords: 1, shaky: 0, solid: 0, mastered: 0, needsRescue: 0 };
  }

  const confidence = flashcardConfidence(stat);
  const dueAt = new Date(stat.dueAt).getTime();
  const due = Number.isFinite(dueAt) && dueAt <= now.getTime() ? 1 : 0;
  const needsRescue = isLeech(stat) ? 1 : 0;
  const mastered = confidence.label === "Mastered" ? 1 : 0;
  const solid = confidence.label === "Solid" || confidence.label === "Mastered" ? 1 : 0;
  const shaky = confidence.label === "Shaky" || confidence.label === "Needs rescue" || confidence.score < 40 ? 1 : 0;

  return { totalTracked: 1, due, newWords: 0, shaky, solid, mastered, needsRescue };
}

function addHealth(a: FlashcardHealthSummary, b: FlashcardHealthSummary): FlashcardHealthSummary {
  return {
    totalWords: a.totalWords + b.totalWords,
    totalTracked: a.totalTracked + b.totalTracked,
    due: a.due + b.due,
    newWords: a.newWords + b.newWords,
    shaky: a.shaky + b.shaky,
    solid: a.solid + b.solid,
    mastered: a.mastered + b.mastered,
    needsRescue: a.needsRescue + b.needsRescue,
  };
}

function topicStatus(summary: FlashcardHealthSummary): FlashcardTopicHealth["status"] {
  if (summary.needsRescue > 0) return "needs rescue";
  if (summary.due > 0) return "due";
  if (summary.totalTracked === 0) return "new";
  if (summary.mastered === summary.totalWords) return "mastered";
  if (summary.newWords > 0) return "building";
  if (summary.solid >= Math.max(1, summary.totalWords - summary.newWords)) return "solid";
  return "building";
}

export function flashcardTopicHealth(
  topic: Pick<Topic, "slug" | "titleEn"> & { items: readonly Topic["items"][number][] },
  flashcardStats: Record<string, FlashcardStat>,
  { now = new Date() }: { now?: Date } = {},
): FlashcardTopicHealth {
  const summary = topic.items.reduce<FlashcardHealthSummary>((acc, item) => {
    const statHealth = classifyStat(flashcardStats[wordKey(topic, item)], now);
    return addHealth(acc, { totalWords: 1, ...statHealth });
  }, EMPTY_HEALTH);

  return {
    slug: topic.slug,
    title: topic.titleEn,
    totalWords: summary.totalWords,
    tracked: summary.totalTracked,
    due: summary.due,
    newWords: summary.newWords,
    shaky: summary.shaky,
    solid: summary.solid,
    mastered: summary.mastered,
    needsRescue: summary.needsRescue,
    status: topicStatus(summary),
  };
}

export function flashcardHealthSummary(
  topics: readonly (Pick<Topic, "slug" | "titleEn"> & { items: readonly Topic["items"][number][] })[],
  flashcardStats: Record<string, FlashcardStat>,
  { now = new Date() }: { now?: Date } = {},
): FlashcardHealthSummary {
  return topics.reduce<FlashcardHealthSummary>((acc, topic) => {
    const health = flashcardTopicHealth(topic, flashcardStats, { now });
    return addHealth(acc, {
      totalWords: health.totalWords,
      totalTracked: health.tracked,
      due: health.due,
      newWords: health.newWords,
      shaky: health.shaky,
      solid: health.solid,
      mastered: health.mastered,
      needsRescue: health.needsRescue,
    });
  }, EMPTY_HEALTH);
}
