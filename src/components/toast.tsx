"use client";

import { useEffect } from "react";

// Minimal transient status chip shown above the bottom nav after an action
// (e.g. grading a flashcard). One toast at a time: a new `message` replaces the
// current one and restarts the auto-dismiss timer. Renders nothing when
// `message` is null. `role="status"` + `aria-live="polite"` so screen readers
// announce it once, without stealing focus.
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (message === null) return;
    const id = setTimeout(onDone, 2000);
    // Clear on unmount or when the message changes, so timers never leak or
    // fire against a stale message.
    return () => clearTimeout(id);
  }, [message, onDone]);

  if (message === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-toast-in fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 truncate rounded-full border border-white/15 bg-slate-900/95 px-5 py-2.5 text-sm font-semibold text-white shadow-xl shadow-emerald-950/30 backdrop-blur"
    >
      {message}
    </div>
  );
}
