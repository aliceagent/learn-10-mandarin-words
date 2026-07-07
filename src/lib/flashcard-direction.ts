import type { VocabItem } from "./types";

export type FlashcardDirection = "zh-en" | "en-zh" | "pinyin-zh" | "mixed";
export type ConcreteFlashcardDirection = Exclude<FlashcardDirection, "mixed">;
export type FlashcardPromptKind = "hanzi" | "english" | "pinyin";

export type FlashcardFace = {
  promptKind: FlashcardPromptKind;
  promptPrimary: string;
  promptSecondary: string | null;
  answerPrimary: string;
  answerPinyin: string;
  answerEnglish: string;
};

export const FLASHCARD_DIRECTION_STORAGE_KEY = "learn-10-mandarin-flashcard-direction";
export const DEFAULT_FLASHCARD_DIRECTION: FlashcardDirection = "zh-en";

export const toggleableDirections = ["zh-en", "en-zh", "pinyin-zh"] as const satisfies readonly ConcreteFlashcardDirection[];

export const FLASHCARD_DIRECTION_OPTIONS: readonly {
  key: FlashcardDirection;
  label: string;
  description: string;
}[] = [
  {
    key: "zh-en",
    label: "Chinese → English",
    description: "Recognize the word from hanzi.",
  },
  {
    key: "en-zh",
    label: "English → Chinese",
    description: "Produce the Chinese from meaning.",
  },
  {
    key: "pinyin-zh",
    label: "Pinyin → Chinese",
    description: "Recall hanzi from pronunciation.",
  },
  {
    key: "mixed",
    label: "Mixed",
    description: "Rotate all prompt types.",
  },
] as const;

const DIRECTION_SET = new Set<FlashcardDirection>(FLASHCARD_DIRECTION_OPTIONS.map((option) => option.key));

export function normalizeFlashcardDirection(raw: unknown): FlashcardDirection {
  return typeof raw === "string" && DIRECTION_SET.has(raw as FlashcardDirection)
    ? (raw as FlashcardDirection)
    : DEFAULT_FLASHCARD_DIRECTION;
}

export function serializeFlashcardDirection(direction: FlashcardDirection): string {
  return direction;
}

export function directionForCard(direction: FlashcardDirection, cardIndex: number): ConcreteFlashcardDirection {
  if (direction !== "mixed") return direction;
  const safeIndex = Number.isFinite(cardIndex) && cardIndex >= 0 ? Math.floor(cardIndex) : 0;
  return toggleableDirections[safeIndex % toggleableDirections.length];
}

export function buildFlashcardFace(
  item: Pick<VocabItem, "hanzi" | "pinyin" | "english">,
  direction: ConcreteFlashcardDirection,
): FlashcardFace {
  if (direction === "en-zh") {
    return {
      promptKind: "english",
      promptPrimary: item.english,
      promptSecondary: null,
      answerPrimary: item.hanzi,
      answerPinyin: item.pinyin,
      answerEnglish: item.english,
    };
  }

  if (direction === "pinyin-zh") {
    return {
      promptKind: "pinyin",
      promptPrimary: item.pinyin,
      promptSecondary: null,
      answerPrimary: item.hanzi,
      answerPinyin: item.pinyin,
      answerEnglish: item.english,
    };
  }

  return {
    promptKind: "hanzi",
    promptPrimary: item.hanzi,
    promptSecondary: null,
    answerPrimary: item.hanzi,
    answerPinyin: item.pinyin,
    answerEnglish: item.english,
  };
}
