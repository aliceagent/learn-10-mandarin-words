"use client";

// Deck-position dots for the flashcard surfaces (Sprint 9): one dot per card,
// the current one emerald and wider, earlier ones dimmed emerald, upcoming ones
// faint white. Purely decorative — `aria-hidden` because the adjacent
// "Card N of M" counter already conveys position to assistive tech.
//
// Sprint 3: calmer + smaller — thinner dots, a gentler current pill, and softer
// emerald/white tones so the row reads as a quiet position hint, not a bright
// bar. Position logic (current / done / upcoming) is unchanged.
export function DeckDots({ count, current }: { count: number; current: number }) {
  if (count <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-center gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const state =
          i === current
            ? "w-3 bg-emerald-400/80"
            : i < current
              ? "w-1 bg-emerald-400/30"
              : "w-1 bg-white/10";
        return (
          <span
            key={i}
            className={`h-1 rounded-full transition-all ${state}`}
          />
        );
      })}
    </div>
  );
}
