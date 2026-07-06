import test from "node:test";
import assert from "node:assert/strict";

import {
  quizVerdictAnnouncement,
  comboChangeAnnouncement,
  multiplierAnnouncement,
  TIMER_ANNOUNCE_SECONDS,
  crossedTimerMilestone,
  timerMilestoneAnnouncement,
} from "../src/lib/announce-logic.ts";

// ── quizVerdictAnnouncement ───────────────────────────────────────────────────
test("quizVerdictAnnouncement announces a plain 'Correct!' and ignores the answer", () => {
  assert.equal(quizVerdictAnnouncement(true), "Correct!");
  assert.equal(quizVerdictAnnouncement(true, "好", "hǎo"), "Correct!");
});

test("quizVerdictAnnouncement names the answer on a wrong answer", () => {
  assert.equal(quizVerdictAnnouncement(false, "好"), "Not quite — the answer is 好.");
});

test("quizVerdictAnnouncement appends pinyin only when provided", () => {
  assert.equal(quizVerdictAnnouncement(false, "好", "hǎo"), "Not quite — the answer is 好 (hǎo).");
  assert.equal(quizVerdictAnnouncement(false, "好", null), "Not quite — the answer is 好.");
  assert.equal(quizVerdictAnnouncement(false, "好", ""), "Not quite — the answer is 好.");
});

test("quizVerdictAnnouncement falls back to a terse verdict when no answer is given (listening mode)", () => {
  assert.equal(quizVerdictAnnouncement(false), "Not quite.");
  assert.equal(quizVerdictAnnouncement(false, ""), "Not quite.");
  assert.equal(quizVerdictAnnouncement(false, "   "), "Not quite.");
});

// ── comboChangeAnnouncement ───────────────────────────────────────────────────
test("comboChangeAnnouncement announces each combo milestone exactly once, on the milestone", () => {
  assert.equal(comboChangeAnnouncement({ combo: 3, brokenCombo: 0 }), "Combo ×3 — heating up!");
  assert.equal(comboChangeAnnouncement({ combo: 5, brokenCombo: 0 }), "Combo ×5 — on fire!");
  assert.equal(comboChangeAnnouncement({ combo: 10, brokenCombo: 0 }), "Combo ×10 — unstoppable!");
});

test("comboChangeAnnouncement stays silent on non-milestone combos", () => {
  for (const combo of [0, 1, 2, 4, 6, 7, 9, 11]) {
    assert.equal(comboChangeAnnouncement({ combo, brokenCombo: 0 }), null, `combo ${combo}`);
  }
});

test("comboChangeAnnouncement announces a broken combo of ≥2 with the lost streak size", () => {
  assert.equal(comboChangeAnnouncement({ combo: 0, brokenCombo: 2 }), "Combo broken at ×2.");
  assert.equal(comboChangeAnnouncement({ combo: 0, brokenCombo: 7 }), "Combo broken at ×7.");
});

test("comboChangeAnnouncement ignores a broken combo below the ×2 threshold", () => {
  assert.equal(comboChangeAnnouncement({ combo: 0, brokenCombo: 0 }), null);
  assert.equal(comboChangeAnnouncement({ combo: 0, brokenCombo: 1 }), null);
});

test("comboChangeAnnouncement lets the milestone win if both could apply, and tolerates garbage", () => {
  assert.equal(comboChangeAnnouncement({ combo: 3, brokenCombo: 5 }), "Combo ×3 — heating up!");
  assert.equal(comboChangeAnnouncement({ combo: NaN, brokenCombo: NaN }), null);
  assert.equal(comboChangeAnnouncement({ combo: 0, brokenCombo: 4.9 }), "Combo broken at ×4.");
});

// ── multiplierAnnouncement ────────────────────────────────────────────────────
test("multiplierAnnouncement announces multiplier rises", () => {
  assert.equal(multiplierAnnouncement(1, 2), "Combo ×2 — double points.");
  assert.equal(multiplierAnnouncement(2, 3), "Combo ×3 — triple points.");
  assert.equal(multiplierAnnouncement(1, 3), "Combo ×3 — triple points.");
});

test("multiplierAnnouncement announces a reset down from any combo above ×1", () => {
  assert.equal(multiplierAnnouncement(3, 1), "Combo lost.");
  assert.equal(multiplierAnnouncement(2, 1), "Combo lost.");
});

test("multiplierAnnouncement stays silent on a steady multiplier or a reset from ×1", () => {
  assert.equal(multiplierAnnouncement(3, 3), null);
  assert.equal(multiplierAnnouncement(1, 1), null);
});

test("multiplierAnnouncement returns null for garbage input", () => {
  assert.equal(multiplierAnnouncement(NaN, 2), null);
  assert.equal(multiplierAnnouncement(1, NaN), null);
  assert.equal(multiplierAnnouncement(Infinity, 2), null);
});

// ── timer milestones ──────────────────────────────────────────────────────────
test("TIMER_ANNOUNCE_SECONDS lists the milestones descending", () => {
  assert.deepEqual([...TIMER_ANNOUNCE_SECONDS], [30, 10, 5]);
});

test("crossedTimerMilestone fires once on a normal tick that crosses a boundary", () => {
  assert.equal(crossedTimerMilestone(30_100, 29_900), 30);
  assert.equal(crossedTimerMilestone(10_050, 9_950), 10);
  assert.equal(crossedTimerMilestone(5_050, 4_950), 5);
});

test("crossedTimerMilestone returns null when no boundary is crossed", () => {
  assert.equal(crossedTimerMilestone(29_900, 29_800), null);
  assert.equal(crossedTimerMilestone(6_000, 5_500), null);
});

test("crossedTimerMilestone does not double-fire once past a boundary", () => {
  // The crossing tick fires at exactly the boundary; the next tick must not repeat.
  assert.equal(crossedTimerMilestone(30_100, 30_000), 30);
  assert.equal(crossedTimerMilestone(30_000, 29_900), null);
});

test("crossedTimerMilestone announces only the lowest milestone when a backgrounded tab skips several", () => {
  assert.equal(crossedTimerMilestone(31_000, 3_000), 5);
  assert.equal(crossedTimerMilestone(31_000, 8_000), 10);
});

test("crossedTimerMilestone tolerates garbage input", () => {
  assert.equal(crossedTimerMilestone(NaN, 3_000), null);
  assert.equal(crossedTimerMilestone(31_000, NaN), null);
});

test("timerMilestoneAnnouncement speaks the seconds remaining", () => {
  assert.equal(timerMilestoneAnnouncement(30), "30 seconds left.");
  assert.equal(timerMilestoneAnnouncement(10), "10 seconds left.");
  assert.equal(timerMilestoneAnnouncement(5), "5 seconds left.");
});
