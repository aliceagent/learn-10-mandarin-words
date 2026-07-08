import type { FlashcardStat, Sentence, VocabItem } from "./types";
import { isLeech } from "./progress-logic.ts";

export type FlashcardRescuePrompt = {
  word: string;
  pinyin: string;
  english: string;
  lapses: number;
  title: string;
  body: string;
  examples: Sentence[];
};

const RESCUE_EXAMPLE_LIMIT = 2;

export function flashcardRescuePrompt(
  item: Pick<VocabItem, "hanzi" | "pinyin" | "english" | "sentences">,
  stat: FlashcardStat | undefined,
  { dismissed = false }: { dismissed?: boolean } = {},
): FlashcardRescuePrompt | null {
  if (dismissed || !stat || !isLeech(stat)) return null;

  const examples = item.sentences.length > 0
    ? item.sentences.slice(0, RESCUE_EXAMPLE_LIMIT)
    : [{ cn: item.hanzi, en: item.english }];

  return {
    word: item.hanzi,
    pinyin: item.pinyin,
    english: item.english,
    lapses: stat.lapses,
    title: "Rescue this slipping word",
    body: "Pause for one example, say it aloud, then grade normally when you reveal. Skipping this note does not change the schedule.",
    examples,
  };
}
