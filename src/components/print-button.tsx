"use client";

import { useCallback } from "react";
import { track } from "@/lib/analytics";

/**
 * Opens the browser's native print dialog so the learner can print (or "Save as
 * PDF") the topic's cheat sheet — the print-only <TopicCheatSheet> renders in
 * place of the app chrome under `@media print`. Client-side only, no network.
 * `print:hidden` keeps the button itself out of the printed page. Modeled on
 * CopyButton (graceful capability guard, local `track()` call).
 */
export function PrintButton({ topic }: { topic: string }) {
  const print = useCallback(() => {
    if (typeof window === "undefined" || typeof window.print !== "function") return;
    track("cheat_sheet_print", { topic });
    window.print();
  }, [topic]);

  return (
    <button
      type="button"
      onClick={print}
      aria-label="Print this topic's cheat sheet"
      className="min-h-[44px] rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-emerald-300 print:hidden"
    >
      Print cheat sheet
    </button>
  );
}
