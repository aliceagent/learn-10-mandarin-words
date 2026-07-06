// Pure content model for the keyboard-shortcuts help overlay (Sprint 20). The
// overlay is contextual to the active topic-page tab: it always shows a universal
// "This page" group first, plus the group for the active game panel (if any). This
// data is DOM-free so the invariants (universal group first, non-empty rows, unique
// key labels per group) are unit-testable under `node --test`.

export type HelpPanelKind = "scramble" | "match" | "boss" | "other";
export type ShortcutRow = { keys: string[]; description: string };
export type ShortcutGroup = { title: string; rows: ShortcutRow[] };

// Universal group — the page-level keys, present on every tab.
const UNIVERSAL_GROUP: ShortcutGroup = {
  title: "This page",
  rows: [
    { keys: ["?"], description: "Open this guide" },
    { keys: ["Esc"], description: "Close it" },
    { keys: ["Tab"], description: "Move between controls" },
  ],
};

const SCRAMBLE_GROUP: ShortcutGroup = {
  title: "Scramble",
  rows: [
    { keys: ["1–8"], description: "Place a tile from the bank" },
    { keys: ["Backspace"], description: "Return the last placed tile" },
    { keys: ["Enter", "→"], description: "Check the order, then next sentence" },
    { keys: ["H"], description: "Show or hide the word hint" },
    { keys: ["R"], description: "Try again (results screen)" },
  ],
};

const MATCH_GROUP: ShortcutGroup = {
  title: "Match",
  rows: [
    { keys: ["1–5"], description: "Pick a word on the left" },
    // "1–5 again" keeps the label distinct from the left-pick row (unique-per-group).
    { keys: ["1–5 again"], description: "Pick its match on the right" },
    { keys: ["Esc"], description: "Clear your selection" },
    { keys: ["Enter"], description: "Start the next round" },
    { keys: ["R"], description: "Play again (results screen)" },
  ],
};

const BOSS_GROUP: ShortcutGroup = {
  title: "Boss round",
  rows: [
    { keys: ["Enter"], description: "Start the round, check, and move on" },
    { keys: ["1–4"], description: "Answer the question" },
    { keys: ["1–5"], description: "Set the tone for the next syllable" },
    { keys: ["R"], description: "Challenge again (results screen)" },
  ],
};

const PANEL_GROUPS: Record<Exclude<HelpPanelKind, "other">, ShortcutGroup> = {
  scramble: SCRAMBLE_GROUP,
  match: MATCH_GROUP,
  boss: BOSS_GROUP,
};

/**
 * The shortcut groups to show for `kind`: always the universal group first, plus
 * the matching panel group (none for "other" tabs like Words/Quiz/Type/Cards).
 */
export function shortcutGroupsFor(kind: HelpPanelKind): ShortcutGroup[] {
  if (kind === "other") return [UNIVERSAL_GROUP];
  return [UNIVERSAL_GROUP, PANEL_GROUPS[kind]];
}
