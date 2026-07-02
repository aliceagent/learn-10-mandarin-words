"use client";

// Deck-position dots for the flashcard surfaces (Sprint 9): one dot per card,
// the current one emerald and wider, earlier ones dimmed emerald, upcoming ones
// faint white. Purely decorative — `aria-hidden` because the adjacent
// "Card N of M" counter already conveys position to assistive tech.
export function DeckDots({ count, current }: { count: number; current: number }) {
  if (count <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const state =
          i === current
            ? "w-4 bg-emerald-400"
            : i < current
              ? "w-1.5 bg-emerald-400/40"
              : "w-1.5 bg-white/15";
        return (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${state}`}
          />
        );
      })}
    </div>
  );
}
