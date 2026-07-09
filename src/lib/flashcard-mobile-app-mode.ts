export type FlashcardMobileAppModeCopy = {
  title: string;
  action: string;
  ariaLabel: string;
};

export function flashcardMobileAppModeCopy(open: boolean): FlashcardMobileAppModeCopy {
  return open
    ? {
        title: "Flashcards",
        action: "Exit",
        ariaLabel: "Exit full-screen flashcard practice",
      }
    : {
        title: "Cards",
        action: "Open full-screen cards",
        ariaLabel: "Open flashcards in a full-screen mobile practice view",
      };
}

export function flashcardMobileShellClass(open: boolean): string {
  if (!open) {
    return "mt-4 rounded-3xl border border-white/10 bg-surface p-3 text-center md:mt-6 md:p-6";
  }

  return [
    "fixed inset-0 z-[80] flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-center",
    "px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]",
    "md:static md:mt-6 md:h-auto md:overflow-visible md:rounded-3xl md:border md:border-white/10 md:bg-surface md:p-6",
  ].join(" ");
}

export function flashcardMobileContentClass(open: boolean): string {
  return open ? "flex min-h-0 flex-1 flex-col md:block" : "";
}

export function flashcardMobileCardWrapClass(open: boolean): string {
  return open
    ? "flex min-h-0 flex-1 items-center justify-center md:block"
    : "";
}

export function flashcardMobileActionZoneClass(open: boolean): string {
  return open ? "shrink-0 pb-1 md:pb-0" : "";
}
