// Pure combo-meter helpers for the in-quiz combo counter (Sprint 4). DOM-free and
// localStorage-free: the Quiz component layers session state and rendering on top,
// and the persisted all-time best lives in progress-logic.ts (normalizeBestCombo /
// recordBestCombo). Mirrors quiz-logic.ts's pure-helper convention so all combo
// math is unit-testable without React. Nothing here touches the DOM or a backend.

/** Milestone thresholds, ascending. Single source for UI tiers and microcopy. */
export const COMBO_MILESTONES = [3, 5, 10] as const;

/** Escalation tier for a combo value: 0 (<3), 1 (≥3), 2 (≥5), 3 (≥10). */
export type ComboTier = 0 | 1 | 2 | 3;

// Coerce any incoming combo count to a safe non-negative integer. A combo is a
// count of consecutive correct answers, so garbage (NaN/negative/float) collapses
// to 0 rather than corrupting the streak.
function safeCombo(combo: number): number {
  return Number.isFinite(combo) && combo > 0 ? Math.floor(combo) : 0;
}

/** Next combo after one answer: +1 on correct, 0 on wrong. Coerces bad input to 0. */
export function nextCombo(combo: number, correct: boolean): number {
  return correct ? safeCombo(combo) + 1 : 0;
}

/** Escalation tier for a combo value (drives chip styling intensity). */
export function comboTier(combo: number): ComboTier {
  const c = safeCombo(combo);
  let tier: ComboTier = 0;
  for (let i = 0; i < COMBO_MILESTONES.length; i++) {
    if (c >= COMBO_MILESTONES[i]) tier = (i + 1) as ComboTier;
  }
  return tier;
}

// Milestone microcopy, keyed by the exact combo that triggers it. Keys mirror
// COMBO_MILESTONES so the two stay in lockstep.
const MILESTONE_LABELS: Record<number, string> = {
  3: "×3 — heating up!",
  5: "×5 — on fire!",
  10: "×10 — unstoppable!",
};

/**
 * Milestone microcopy for a combo that lands EXACTLY on a milestone
 * ("×5 — on fire!"), else null — so the flash fires once per milestone rather
 * than on every answer.
 */
export function comboMilestoneLabel(combo: number): string | null {
  return MILESTONE_LABELS[safeCombo(combo)] ?? null;
}

/** True when `combo` beats the persisted best (strictly greater; a tie is not new). */
export function isNewBestCombo(combo: number, bestSoFar: number): boolean {
  return safeCombo(combo) > safeCombo(bestSoFar);
}
