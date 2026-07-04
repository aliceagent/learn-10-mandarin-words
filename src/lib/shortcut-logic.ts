// Pure, DOM-free key→intent mapping for the /practice keyboard shortcuts
// (Sprint 5). Modeled on gesture-logic.ts: the classification/guards live here,
// free of any DOM or React, so the whole matrix is unit-testable under
// `node --test`. The hook (use-practice-shortcuts.ts) is a thin adapter that
// reads the KeyboardEvent, classifies its target into this context shape, and
// dispatches the returned intent.

/** Where the practice card is in its lifecycle when a key is pressed. */
export type PracticePhase = "question" | "answered" | "done";

/** The intent a key press resolves to, or `null` for "ignore this key". */
export type PracticeShortcut =
  | { type: "choose"; index: number } // 0-based choice index
  | { type: "next" }
  | { type: "speak" }
  | { type: "again" };

export type ShortcutContext = {
  phase: PracticePhase;
  choiceCount: number; // digits above this are ignored
  hasModifier: boolean; // ctrlKey || metaKey || altKey — never shadow browser keys
  repeat: boolean; // KeyboardEvent.repeat — held keys must not machine-gun
  targetIsEditable: boolean; // input/textarea/select/contenteditable
  targetIsButton: boolean; // button/a — blocks Enter to avoid double-fire
};

/**
 * Resolve a KeyboardEvent.key + context into a practice intent, or `null`.
 *
 * Universal guards (checked first, in order): a held modifier, an auto-repeat,
 * or an editable target all short-circuit to `null` so browser shortcuts, held
 * keys, and text entry are never disturbed.
 *
 * Mapping (after the guards):
 *  - "1".."9" → choose (0-based) only in "question" phase and only when the
 *    digit is within choiceCount.
 *  - "Enter" → next only in "answered" phase and only when the target is NOT a
 *    button/link (a focused button's native Enter click would double-fire).
 *  - "ArrowRight" → next in "answered" phase (safe on buttons; no native action).
 *  - "p"/"P" → speak in "question" or "answered".
 *  - "r"/"R" → again only in "done".
 *  - anything else → null.
 */
export function resolvePracticeShortcut(
  key: string,
  ctx: ShortcutContext,
): PracticeShortcut | null {
  if (ctx.hasModifier || ctx.repeat || ctx.targetIsEditable) return null;

  // Digits: answer a choice by position.
  if (key >= "1" && key <= "9") {
    if (ctx.phase !== "question") return null;
    const index = Number(key) - 1;
    if (index >= ctx.choiceCount) return null;
    return { type: "choose", index };
  }

  switch (key) {
    case "Enter":
      // Native button/link activation already handles Enter — don't double-fire.
      if (ctx.phase === "answered" && !ctx.targetIsButton) return { type: "next" };
      return null;
    case "ArrowRight":
      if (ctx.phase === "answered") return { type: "next" };
      return null;
    case "p":
    case "P":
      if (ctx.phase === "question" || ctx.phase === "answered") return { type: "speak" };
      return null;
    case "r":
    case "R":
      if (ctx.phase === "done") return { type: "again" };
      return null;
    default:
      return null;
  }
}
