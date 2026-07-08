import type { FlashcardStat, Topic, VocabItem } from "./types";
import { wordKey } from "./data-logic.ts";
import { flashcardConfidence } from "./flashcard-confidence.ts";

export type FlashcardDeckOrder = "topic" | "due-first" | "weak-first" | "new" | "mixed-smart";

export const DEFAULT_FLASHCARD_DECK_ORDER: FlashcardDeckOrder = "mixed-smart";

export const FLASHCARD_DECK_ORDER_OPTIONS: { key: FlashcardDeckOrder; label: string; description: string }[] = [
  { key: "topic", label: "Topic order", description: "Follow the lesson list." },
  { key: "due-first", label: "Due first", description: "Review due cards before the rest." },
  { key: "weak-first", label: "Weak first", description: "Start with shaky or slipping words." },
  { key: "new", label: "New words", description: "See unseen cards first." },
  { key: "mixed-smart", label: "Mixed smart", description: "Blend due, weak, new, and solid cards." },
];

const VALID_FLASHCARD_DECK_ORDERS = new Set<FlashcardDeckOrder>(
  FLASHCARD_DECK_ORDER_OPTIONS.map((option) => option.key),
);

export function serializeFlashcardDeckOrder(value: unknown): FlashcardDeckOrder {
  return typeof value === "string" && VALID_FLASHCARD_DECK_ORDERS.has(value as FlashcardDeckOrder)
    ? (value as FlashcardDeckOrder)
    : DEFAULT_FLASHCARD_DECK_ORDER;
}

type DeckItem = {
  item: VocabItem;
  key: string;
  index: number;
  stat?: FlashcardStat;
  dueMs: number;
  confidenceScore: number;
};

function deckItems(
  topic: Pick<Topic, "slug"> & { items: readonly VocabItem[] },
  flashcardStats: Record<string, FlashcardStat>,
): DeckItem[] {
  return topic.items.map((item, index) => {
    const key = wordKey(topic, item);
    const stat = flashcardStats[key];
    const dueMs = stat ? new Date(stat.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return {
      item,
      key,
      index,
      stat,
      dueMs: Number.isFinite(dueMs) ? dueMs : Number.POSITIVE_INFINITY,
      confidenceScore: flashcardConfidence(stat).score,
    };
  });
}

function byTopic(a: DeckItem, b: DeckItem): number {
  return a.index - b.index;
}

function byDueThenTopic(a: DeckItem, b: DeckItem): number {
  return a.dueMs - b.dueMs || byTopic(a, b);
}

function byWeakThenTopic(a: DeckItem, b: DeckItem): number {
  const aReviewed = a.stat && a.stat.reviewCount > 0 ? 0 : 1;
  const bReviewed = b.stat && b.stat.reviewCount > 0 ? 0 : 1;
  return (
    aReviewed - bReviewed ||
    a.confidenceScore - b.confidenceScore ||
    (b.stat?.lapses ?? 0) - (a.stat?.lapses ?? 0) ||
    (b.stat?.reviewCount ?? 0) - (a.stat?.reviewCount ?? 0) ||
    byTopic(a, b)
  );
}

function uniquePush(out: DeckItem[], seen: Set<string>, bucket: DeckItem[]): void {
  while (bucket.length > 0) {
    const next = bucket.shift();
    if (!next || seen.has(next.key)) continue;
    seen.add(next.key);
    out.push(next);
    return;
  }
}

function mixedSmartOrder(items: DeckItem[], now: Date): DeckItem[] {
  const nowMs = now.getTime();
  const due = items
    .filter((entry) => entry.stat && entry.dueMs <= nowMs)
    .sort(byDueThenTopic);
  const weak = items
    .filter((entry) => entry.stat && (entry.stat.lapses > 0 || entry.confidenceScore < 50))
    .sort(byWeakThenTopic);
  const fresh = items.filter((entry) => !entry.stat || entry.stat.reviewCount <= 0).sort(byTopic);
  const solid = items
    .filter((entry) => entry.stat && entry.dueMs > nowMs && entry.confidenceScore >= 50)
    .sort(byTopic);

  const out: DeckItem[] = [];
  const seen = new Set<string>();
  const priorityBuckets = [due, weak, fresh];
  while (priorityBuckets.some((bucket) => bucket.some((entry) => !seen.has(entry.key)))) {
    const before = out.length;
    for (const bucket of priorityBuckets) uniquePush(out, seen, bucket);
    if (out.length === before) break;
  }
  for (const entry of solid) {
    if (!seen.has(entry.key)) {
      seen.add(entry.key);
      out.push(entry);
    }
  }
  for (const entry of items) {
    if (!seen.has(entry.key)) {
      seen.add(entry.key);
      out.push(entry);
    }
  }
  return out;
}

export function orderFlashcardDeck(
  topic: Pick<Topic, "slug"> & { items: readonly VocabItem[] },
  flashcardStats: Record<string, FlashcardStat>,
  order: FlashcardDeckOrder,
  { now = new Date() }: { now?: Date } = {},
): VocabItem[] {
  const items = deckItems(topic, flashcardStats);
  switch (order) {
    case "due-first": {
      const nowMs = now.getTime();
      return [
        ...items.filter((entry) => entry.stat && entry.dueMs <= nowMs).sort(byDueThenTopic),
        ...items.filter((entry) => !entry.stat || entry.dueMs > nowMs).sort(byTopic),
      ].map((entry) => entry.item);
    }
    case "weak-first":
      return [...items].sort(byWeakThenTopic).map((entry) => entry.item);
    case "new":
      return [
        ...items.filter((entry) => !entry.stat || entry.stat.reviewCount <= 0).sort(byTopic),
        ...items.filter((entry) => entry.stat && entry.stat.reviewCount > 0).sort(byTopic),
      ].map((entry) => entry.item);
    case "mixed-smart":
      return mixedSmartOrder(items, now).map((entry) => entry.item);
    case "topic":
    default:
      return [...topic.items];
  }
}
