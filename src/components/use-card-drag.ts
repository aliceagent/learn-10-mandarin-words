"use client";

import { useCallback, useRef, useState } from "react";
import { flingIntent, type FlingIntent } from "@/lib/gesture-logic";

// Touch drag/fling tracking for the flashcard surfaces (Sprint 9). Unlike the
// tap-only `useSwipe` (left untouched for API stability), this hook tracks
// touchmove so the card can follow the thumb and report a live `dx`.
//
// - onTap fires when total movement stays under TAP_SLOP_PX (a flip-to-reveal).
// - onFling fires with the released fling intent (or null for a sub-threshold
//   drag that should spring back) so the caller decides reveal vs. grade.
// - The gesture is only "claimed" (preventDefault on move) once the drag is
//   clearly horizontal, so vertical page scroll starting on the card survives.
// - Multi-touch and touchcancel reset cleanly and never fire callbacks.

const TAP_SLOP_PX = 10;
const CLAIM_PX = 10;

export function useCardDrag({
  onTap,
  onFling,
}: {
  onTap: () => void;
  onFling: (intent: FlingIntent) => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef(0);
  const claimed = useRef(false); // horizontal intent locked in
  const rejected = useRef(false); // vertical scroll won — ignore this gesture

  const reset = useCallback(() => {
    startX.current = null;
    claimed.current = false;
    rejected.current = false;
    setDx(0);
    setDragging(false);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Ignore multi-touch (pinch/zoom) — don't hijack it.
    if (e.touches.length !== 1) {
      startX.current = null;
      return;
    }
    // Let interactive children (e.g. the embedded Speak button) own their taps
    // so hearing the word doesn't flip the card.
    if ((e.target as HTMLElement | null)?.closest("button")) {
      startX.current = null;
      return;
    }
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    claimed.current = false;
    rejected.current = false;
    setDx(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startX.current === null || rejected.current) return;
    if (e.touches.length !== 1) return; // a second finger landed — bail
    const moveX = e.touches[0].clientX - startX.current;
    const moveY = e.touches[0].clientY - startY.current;

    if (!claimed.current) {
      // Decide, on the first meaningful movement, whether this is a horizontal
      // card drag or a vertical scroll. Vertical wins → let the page scroll.
      if (Math.abs(moveY) > Math.abs(moveX) && Math.abs(moveY) > CLAIM_PX) {
        rejected.current = true;
        return;
      }
      if (Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > CLAIM_PX) {
        claimed.current = true;
        setDragging(true);
      } else {
        return; // ambiguous so far — wait for more movement
      }
    }

    // Horizontal drag claimed: suppress page scroll and follow the thumb.
    if (e.cancelable) e.preventDefault();
    setDx(moveX);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) {
      reset();
      return;
    }
    const endX = e.changedTouches[0]?.clientX ?? startX.current;
    const endY = e.changedTouches[0]?.clientY ?? startY.current;
    const totalX = endX - startX.current;
    const totalY = endY - startY.current;
    const claimedNow = claimed.current;
    const rejectedNow = rejected.current;
    reset();

    if (rejectedNow) return; // it was a scroll, not a card gesture
    if (!claimedNow) {
      // Never became a horizontal drag → treat a small movement as a tap.
      if (Math.abs(totalX) < TAP_SLOP_PX && Math.abs(totalY) < TAP_SLOP_PX) onTap();
      return;
    }
    onFling(flingIntent(totalX));
  }, [onFling, onTap, reset]);

  const onTouchCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    dx,
    dragging,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
  };
}
