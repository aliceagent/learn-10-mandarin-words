import type { FlashcardTopicHealth } from "./flashcard-health.ts";

export function compactFlashcardSettingsSummary({
  health,
  directionLabel,
  deckOrderLabel,
  hintCount,
}: {
  health: Pick<FlashcardTopicHealth, "due" | "status">;
  directionLabel: string;
  deckOrderLabel: string;
  hintCount: number;
}): string[] {
  const healthLabel = health.due > 0 ? `${health.due} due` : health.status;
  return [healthLabel, directionLabel, deckOrderLabel, `${hintCount} hints`];
}
