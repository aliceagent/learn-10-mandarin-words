// Pure, DOM-free screen-reader announcement helpers (Sprint 21). These build the
// short strings spoken into the app's `aria-live` regions when a quiz verdict
// lands, a combo changes, or the Lightning Round's countdown crosses a milestone.
// Nothing here touches the DOM, localStorage, or React — the quiz-panel and
// lightning-app components feed component state in and render the returned
// strings into persistent sr-only live regions. Mirrors combo-logic.ts's
// pure-helper, defensive-input convention so every string is unit-testable under
// `node --test`.
//
// Explicit `.ts` extension on the combo-logic import so this runtime import
// resolves under `node --test` (Node's native TS runner does not add
// extensions), while `next build` and tsc accept it via
// `allowImportingTsExtensions`. Reusing comboMilestoneLabel keeps the milestone
// microcopy single-sourced.
import { comboMilestoneLabel } from "./combo-logic.ts";

/**
 * Verdict for one answered quiz card. `answer` (and its optional `answerPinyin`)
 * are appended only on a wrong answer, and only when supplied — listening mode
 * omits them because its role="status" reveal already reads the hanzi + pinyin.
 * Pinyin, when given, accompanies the answer in parentheses so a Chinese answer
 * is voiced with its reading (the spoken form of the pinyin-on-hanzi rule).
 */
export function quizVerdictAnnouncement(
  correct: boolean,
  answer?: string,
  answerPinyin?: string | null,
): string {
  if (correct) return "Correct!";
  const word = typeof answer === "string" ? answer.trim() : "";
  if (word === "") return "Not quite.";
  const pinyin = typeof answerPinyin === "string" ? answerPinyin.trim() : "";
  const reading = pinyin === "" ? "" : ` (${pinyin})`;
  return `Not quite — the answer is ${word}${reading}.`;
}

// Coerce an incoming combo/streak count to a safe non-negative integer, matching
// combo-logic.ts's safeCombo so garbage (NaN/negative/float) can never produce a
// bogus "Combo broken at ×NaN." announcement.
function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Announcement for an in-quiz combo change: the milestone microcopy (reused
 * verbatim from combo-logic.ts) prefixed with "Combo " when `combo` lands exactly
 * on a milestone, "Combo broken at ×N." when a streak of ≥2 was just lost, else
 * null. In practice the two are mutually exclusive — a correct answer that hits a
 * milestone leaves brokenCombo at 0, and a wrong answer zeroes `combo` — but the
 * milestone takes precedence if both were ever true.
 */
export function comboChangeAnnouncement(opts: { combo: number; brokenCombo: number }): string | null {
  const milestone = comboMilestoneLabel(opts.combo);
  if (milestone !== null) return `Combo ${milestone}`;
  const broken = safeCount(opts.brokenCombo);
  if (broken >= 2) return `Combo broken at ×${broken}.`;
  return null;
}

// Lightning multiplier microcopy, keyed by the multiplier just reached on a rise.
// Only ×2 and ×3 exist (multiplierFor caps at ×3); any other value yields no rise
// announcement.
const MULTIPLIER_LABELS: Record<number, string> = {
  2: "Combo ×2 — double points.",
  3: "Combo ×3 — triple points.",
};

/**
 * Announcement for a Lightning Round multiplier change: a rise (curr > prev)
 * announces the new tier's copy ("Combo ×2 — double points." / "×3 — triple
 * points."), a reset down from any multiplier above ×1 announces "Combo lost.",
 * and a steady multiplier (or garbage input) stays silent.
 */
export function multiplierAnnouncement(prevMultiplier: number, multiplier: number): string | null {
  if (!Number.isFinite(prevMultiplier) || !Number.isFinite(multiplier)) return null;
  if (multiplier > prevMultiplier) return MULTIPLIER_LABELS[multiplier] ?? null;
  if (multiplier < prevMultiplier && prevMultiplier > 1) return "Combo lost.";
  return null;
}

/** Countdown seconds that get a spoken milestone, descending. */
export const TIMER_ANNOUNCE_SECONDS: readonly number[] = [30, 10, 5];

/**
 * The single timer milestone crossed between two countdown reads (`prevMs` →
 * `currMs`, both remaining-milliseconds), or null when none was crossed. A
 * milestone at S seconds is crossed when the remaining time falls from strictly
 * above S·1000 to at or below it — so a boundary tick fires exactly once and the
 * next tick past it does not re-fire. When a backgrounded tab resumes after
 * skipping several milestones at once, only the LOWEST (closest-to-zero) crossed
 * milestone is returned, so a resume at 3s announces "5 seconds left" rather than
 * blasting 30 / 10 / 5 in a burst.
 */
export function crossedTimerMilestone(prevMs: number, currMs: number): number | null {
  if (!Number.isFinite(prevMs) || !Number.isFinite(currMs)) return null;
  // Ascending so the first crossing found is the lowest-seconds milestone.
  const ascending = [...TIMER_ANNOUNCE_SECONDS].sort((a, b) => a - b);
  for (const seconds of ascending) {
    const threshold = seconds * 1000;
    if (prevMs > threshold && currMs <= threshold) return seconds;
  }
  return null;
}

/** Spoken form of a countdown milestone: "30 seconds left." etc. */
export function timerMilestoneAnnouncement(seconds: number): string {
  return `${seconds} seconds left.`;
}
