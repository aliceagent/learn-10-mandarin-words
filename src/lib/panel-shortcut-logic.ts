// Pure, DOM-free key→intent mapping for the topic-page game panels — Scramble,
// Match, and Boss (Sprint 20). Mirrors shortcut-logic.ts: the classification and
// guards live here, free of any DOM or React, so the whole matrix is unit-testable
// under `node --test`. The hook (use-panel-shortcuts.ts) is the thin adapter that
// reads the KeyboardEvent, classifies its target into PanelTargetContext, and
// dispatches the returned intent. All three resolvers share the same universal
// guards; each panel adds its own phase/count context.

/**
 * The target/modifier facts every resolver needs. `hasModifier` is ctrl/meta/alt
 * ONLY — Shift stays free so the page-level "?" opener (Shift+/) is never shadowed.
 */
export type PanelTargetContext = {
  hasModifier: boolean; // ctrl/meta/alt — never shadow browser keys (Shift excluded)
  repeat: boolean; // KeyboardEvent.repeat — held keys must not machine-gun
  targetIsEditable: boolean; // input/textarea/select/contenteditable
  targetIsButton: boolean; // button/a — blocks Enter to avoid double-fire
};

// ── Scramble ────────────────────────────────────────────────────────────────

export type ScramblePhase = "arranging" | "solved" | "done";
export type ScrambleShortcut =
  | { type: "place"; index: number } // 0-based index into the current tile bank
  | { type: "return-last" }
  | { type: "check" }
  | { type: "next" }
  | { type: "toggle-hint" }
  | { type: "again" };

/**
 * Resolve a key press for the Scramble panel.
 *
 *  - "1".."9" → place the bank tile at that 0-based slot, only while arranging and
 *    only within `bankCount`.
 *  - "Backspace" → return the last placed tile, only while arranging with ≥1 placed.
 *  - "Enter"/"ArrowRight" → check when the line is complete-but-unsolved, next when
 *    solved. Enter is suppressed on button targets (native click would double-fire);
 *    ArrowRight is not (it has no native button action).
 *  - "h"/"H" → toggle the word hint, except on the results screen.
 *  - "r"/"R" → try again, only on the results screen.
 */
export function resolveScrambleShortcut(
  key: string,
  ctx: PanelTargetContext & {
    phase: ScramblePhase;
    bankCount: number;
    placedCount: number;
    complete: boolean;
  },
): ScrambleShortcut | null {
  if (ctx.hasModifier || ctx.repeat || ctx.targetIsEditable) return null;

  if (key >= "1" && key <= "9") {
    if (ctx.phase !== "arranging") return null;
    const index = Number(key) - 1;
    if (index >= ctx.bankCount) return null;
    return { type: "place", index };
  }

  switch (key) {
    case "Backspace":
      if (ctx.phase === "arranging" && ctx.placedCount > 0) return { type: "return-last" };
      return null;
    case "Enter":
      if (ctx.targetIsButton) return null;
      if (ctx.phase === "arranging" && ctx.complete) return { type: "check" };
      if (ctx.phase === "solved") return { type: "next" };
      return null;
    case "ArrowRight":
      if (ctx.phase === "arranging" && ctx.complete) return { type: "check" };
      if (ctx.phase === "solved") return { type: "next" };
      return null;
    case "h":
    case "H":
      if (ctx.phase !== "done") return { type: "toggle-hint" };
      return null;
    case "r":
    case "R":
      if (ctx.phase === "done") return { type: "again" };
      return null;
    default:
      return null;
  }
}

// ── Match ───────────────────────────────────────────────────────────────────

export type MatchPhase = "playing" | "interstitial" | "complete";
export type MatchShortcut =
  | { type: "pick-left"; index: number }
  | { type: "pick-right"; index: number }
  | { type: "clear-selection" }
  | { type: "continue" }
  | { type: "again" };

/**
 * Resolve a key press for the Match panel.
 *
 *  - While playing and not mid-flash (`busy`): "1".."5" pick from the LEFT column
 *    when nothing is selected or an English tile is selected, and from the RIGHT
 *    column when a hanzi tile is selected — so the same digits complete a pair in
 *    two presses. Bounded by `pairCount`. "Escape" clears an active selection only
 *    (otherwise null, so Escape stays free).
 *  - Interstitial: "Enter"/"ArrowRight" continue to the next round (Enter suppressed
 *    on buttons).
 *  - Complete: "r"/"R" play again.
 */
export function resolveMatchShortcut(
  key: string,
  ctx: PanelTargetContext & {
    phase: MatchPhase;
    selectedSide: "hanzi" | "english" | null;
    pairCount: number;
    busy: boolean;
  },
): MatchShortcut | null {
  if (ctx.hasModifier || ctx.repeat || ctx.targetIsEditable) return null;

  if (key >= "1" && key <= "9") {
    if (ctx.phase !== "playing" || ctx.busy) return null;
    const index = Number(key) - 1;
    if (index >= ctx.pairCount) return null;
    return ctx.selectedSide === "hanzi"
      ? { type: "pick-right", index }
      : { type: "pick-left", index };
  }

  switch (key) {
    case "Escape":
      if (ctx.phase === "playing" && !ctx.busy && ctx.selectedSide !== null)
        return { type: "clear-selection" };
      return null;
    case "Enter":
      if (ctx.targetIsButton) return null;
      if (ctx.phase === "interstitial") return { type: "continue" };
      return null;
    case "ArrowRight":
      if (ctx.phase === "interstitial") return { type: "continue" };
      return null;
    case "r":
    case "R":
      if (ctx.phase === "complete") return { type: "again" };
      return null;
    default:
      return null;
  }
}

// ── Boss ────────────────────────────────────────────────────────────────────

export type BossKeyPhase =
  | { phase: "intro" }
  | { phase: "result" }
  | { phase: "choices"; answered: boolean; choiceCount: number } // quiz + cloze stages
  | { phase: "tones"; checked: boolean; complete: boolean }
  | { phase: "typing"; graded: boolean };
export type BossShortcut =
  | { type: "start" }
  | { type: "choose"; index: number }
  | { type: "tone"; tone: 1 | 2 | 3 | 4 | 5 }
  | { type: "check" }
  | { type: "next" }
  | { type: "again" };

/**
 * Resolve a key press for the Boss panel, parameterized by the active phase/stage.
 *
 *  - Digits are stage-specific: "1".."4" answer a choice stage (unanswered, within
 *    `choiceCount`); "1".."5" set the next syllable's tone on a tone stage (unchecked).
 *  - "Enter" drives the whole flow: start (intro), check (tone stage complete but
 *    unchecked), next (any graded stage), again (result). Always suppressed on
 *    button targets to avoid a double-fire with the native click.
 *  - "ArrowRight" is the button-safe advance: next on any graded stage only.
 *  - "r"/"R" → again on the result screen.
 *
 * The typing stage's own <input> submits on Enter natively, so only its graded-phase
 * `next` lives here; the universal editable-target guard protects the input itself.
 */
export function resolveBossShortcut(
  key: string,
  ctx: PanelTargetContext & BossKeyPhase,
): BossShortcut | null {
  if (ctx.hasModifier || ctx.repeat || ctx.targetIsEditable) return null;

  if (key >= "1" && key <= "9") {
    if (ctx.phase === "choices" && !ctx.answered) {
      const index = Number(key) - 1;
      if (index >= ctx.choiceCount) return null;
      return { type: "choose", index };
    }
    if (ctx.phase === "tones" && !ctx.checked && key <= "5") {
      return { type: "tone", tone: Number(key) as 1 | 2 | 3 | 4 | 5 };
    }
    return null;
  }

  // Button-safe advance: `next` on any graded stage.
  const advance = (): BossShortcut | null => {
    if (ctx.phase === "choices" && ctx.answered) return { type: "next" };
    if (ctx.phase === "tones" && ctx.checked) return { type: "next" };
    if (ctx.phase === "typing" && ctx.graded) return { type: "next" };
    return null;
  };

  switch (key) {
    case "Enter":
      if (ctx.targetIsButton) return null;
      if (ctx.phase === "intro") return { type: "start" };
      if (ctx.phase === "result") return { type: "again" };
      if (ctx.phase === "tones" && !ctx.checked && ctx.complete) return { type: "check" };
      return advance();
    case "ArrowRight":
      return advance();
    case "r":
    case "R":
      if (ctx.phase === "result") return { type: "again" };
      return null;
    default:
      return null;
  }
}
