"use client";

import { useCallback, useRef } from "react";

// Shared touch-swipe detection for the flashcard surfaces (topic + review).
// A horizontal drag past the threshold fires onLeft (dragged left) or onRight
// (dragged right); shorter drags are ignored so a tap or a tiny movement never
// grades a card. Extracted verbatim from topic-app/review-app so both stay in
// lockstep — the 50px threshold and left/right mapping are unchanged.
const SWIPE_THRESHOLD_PX = 50;

export function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) onLeft();
    else onRight();
  }, [onLeft, onRight]);

  return { onTouchStart, onTouchEnd };
}
