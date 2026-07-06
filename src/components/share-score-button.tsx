"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { type ShareCardData } from "@/lib/share-card-logic";

type Surface = "stats" | "practice" | "review" | "weekly";

// True when the card has anything worth sharing. A stats card with zero activity
// is hidden entirely (nothing to brag about); practice/review need a real run.
function hasSomethingToShare(data: ShareCardData): boolean {
  if (data.kind === "stats") {
    return data.streak > 0 || data.reviewedWords > 0 || data.learnedTopics > 0 || data.daysStudied > 0;
  }
  // A weekly card needs a lived-in week: any practice or any active day.
  if (data.kind === "weekly") {
    return data.wordsPracticed > 0 || data.activeDays > 0;
  }
  return data.total > 0;
}

// Placeholder shown while the dialog chunk downloads: the same backdrop + card
// shell in its "Building your card…" state, so click → chunk-fetch → canvas
// render reads as one continuous message with no layout jump.
function DialogFallback() {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Your score card"
    >
      <div className="animate-celebrate w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Your score card</h2>
        <div className="mt-4 aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-surface">
          <div className="flex h-full w-full items-center justify-center text-center text-sm text-slate-400">
            Building your card…
          </div>
        </div>
      </div>
    </div>
  );
}

// The dialog + its canvas pipeline are deferred into a separate chunk that only
// loads when a learner actually opens the preview (see share-card-dialog.tsx).
const ShareCardDialog = dynamic(
  () => import("./share-card-dialog").then((m) => m.ShareCardDialog),
  { loading: () => <DialogFallback /> },
);

// A shareable score card: a trigger button that opens a preview dialog with
// Share / Copy image / Copy text / Save PNG actions. The card image is generated
// entirely on-device (canvas) — nothing is uploaded unless the user shares it.
export function ShareScoreButton({
  data,
  surface,
  className,
}: {
  data: ShareCardData;
  surface: Surface;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const label =
    surface === "stats"
      ? "Share progress 📸"
      : surface === "weekly"
        ? "Share weekly recap 📅"
        : "Share score card 📸";

  const openDialog = useCallback(() => {
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    // Restore focus to the trigger (it may have unmounted after navigation).
    previouslyFocused.current?.focus?.();
  }, []);

  if (!hasSomethingToShare(data)) return null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={
          className ??
          "min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
        }
      >
        {label}
      </button>

      {open ? <ShareCardDialog data={data} surface={surface} onClose={closeDialog} /> : null}
    </>
  );
}
