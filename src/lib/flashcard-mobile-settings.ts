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

export type FlashcardMobileSettingsDrawerCopy = {
  action: string;
  title: string;
  ariaLabel: string;
  expanded: string;
};

export function flashcardMobileSettingsDrawerCopy(open: boolean): FlashcardMobileSettingsDrawerCopy {
  return open
    ? {
        action: "Close settings",
        title: "Practice settings",
        ariaLabel: "Close flashcard settings drawer",
        expanded: "Settings open",
      }
    : {
        action: "Settings",
        title: "Practice settings",
        ariaLabel: "Open flashcard settings drawer",
        expanded: "Settings closed",
      };
}

export function flashcardMobileSettingsDrawerClass(open: boolean): string {
  if (!open) return "hidden";

  return [
    "absolute inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[90]",
    "max-h-[min(70dvh,34rem)] overflow-y-auto rounded-3xl border border-white/15 bg-slate-900/95 p-3 text-left shadow-2xl shadow-black/50 backdrop-blur",
    "md:hidden",
  ].join(" ");
}
