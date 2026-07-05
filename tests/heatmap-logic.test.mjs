import test from "node:test";
import assert from "node:assert/strict";

import {
  HEATMAP_WEEKS,
  buildHeatmap,
  cellTitle,
  heatLevel,
  heatmapSummaryLabel,
} from "../src/lib/heatmap-logic.ts";

// A fixed UTC Sunday keeps every grid assertion deterministic.
const END = "2026-07-05"; // getUTCDay === 0 (Sunday)

// Find the {col,row} of a given day in the grid, or null.
function locate(model, day) {
  for (let c = 0; c < model.weeks.length; c++) {
    for (let r = 0; r < 7; r++) {
      if (model.weeks[c][r].day === day) return { c, r };
    }
  }
  return null;
}

test("grid is 53 weeks × 7 rows, ends on endDay, first column is a Sunday", () => {
  const model = buildHeatmap([], {}, END);
  assert.equal(model.weeks.length, HEATMAP_WEEKS);
  for (const week of model.weeks) assert.equal(week.length, 7);

  // First column starts on a Sunday (UTC day 0).
  assert.equal(new Date(model.weeks[0][0].day).getUTCDay(), 0);

  // endDay is the last in-range cell; because it's a Sunday it sits at row 0 of
  // the final column, and the rest of that column is future padding.
  const last = model.weeks[HEATMAP_WEEKS - 1];
  assert.equal(last[0].day, END);
  assert.equal(last[0].inRange, true);
  for (let r = 1; r < 7; r++) assert.equal(last[r].inRange, false);
});

test("empty inputs yield an all-zero grid", () => {
  const model = buildHeatmap([], {}, END);
  assert.equal(model.daysStudied, 0);
  for (const week of model.weeks) {
    for (const cell of week) {
      assert.equal(cell.level, 0);
      assert.equal(cell.count, null);
    }
  }
});

test("heatLevel tiers by count, with studied-but-uncounted days at level 1", () => {
  assert.equal(heatLevel(false, null), 0);
  assert.equal(heatLevel(false, 99), 0); // not studied always wins
  assert.equal(heatLevel(true, null), 1); // older than 14-day retention
  assert.equal(heatLevel(true, 0), 1); // learned-toggle day, no words
  assert.equal(heatLevel(true, 1), 1);
  assert.equal(heatLevel(true, 3), 1);
  assert.equal(heatLevel(true, 4), 2);
  assert.equal(heatLevel(true, 7), 2);
  assert.equal(heatLevel(true, 8), 3);
  assert.equal(heatLevel(true, 14), 3);
  assert.equal(heatLevel(true, 15), 4);
  assert.equal(heatLevel(true, 40), 4);
});

test("a studied day lands in the correct week/row and daily activity raises its level", () => {
  const day = "2026-06-15"; // a Monday inside the window
  const model = buildHeatmap([day], { [day]: ["a", "b", "c", "d", "e"] }, END);
  const loc = locate(model, day);
  assert.ok(loc, "studied day should appear in the grid");
  // Row equals the UTC weekday of that date.
  assert.equal(loc.r, new Date(day).getUTCDay());
  const cell = model.weeks[loc.c][loc.r];
  assert.equal(cell.count, 5);
  assert.equal(cell.level, 2); // 5 words → tier 2
  assert.equal(model.daysStudied, 1);
});

test("a studied day without a count lights at level 1", () => {
  const day = "2026-06-15";
  const model = buildHeatmap([day], {}, END);
  const loc = locate(model, day);
  const cell = model.weeks[loc.c][loc.r];
  assert.equal(cell.count, null);
  assert.equal(cell.level, 1);
});

test("out-of-window, malformed, and duplicate dates are handled without throwing", () => {
  const model = buildHeatmap(
    ["2020-01-01", "junk", "2026-13-99", "2026-06-15", "2026-06-15"],
    {},
    END,
  );
  // Only the one valid, in-window day counts; duplicates collapse.
  assert.equal(model.daysStudied, 1);
  assert.equal(locate(model, "2020-01-01"), null); // far past, off the grid
});

test("month labels are ordered, spaced, and use short UTC month names", () => {
  const model = buildHeatmap([], {}, END);
  const valid = new Set([
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]);
  assert.ok(model.monthLabels.length >= 10);
  let prev = -Infinity;
  for (const { weekIndex, label } of model.monthLabels) {
    assert.ok(valid.has(label), `unexpected label ${label}`);
    assert.ok(weekIndex > prev, "weekIndex strictly increasing");
    assert.ok(weekIndex - prev >= 3 || prev === -Infinity, "labels at least 3 columns apart");
    prev = weekIndex;
  }
});

test("cellTitle formats each state and marks today", () => {
  assert.equal(
    cellTitle({ day: END, level: 2, count: 12, inRange: true }),
    "Jul 5 — 12 words practiced",
  );
  assert.equal(
    cellTitle({ day: END, level: 1, count: 1, inRange: true }),
    "Jul 5 — 1 word practiced",
  );
  assert.equal(
    cellTitle({ day: END, level: 1, count: null, inRange: true }),
    "Jul 5 — studied",
  );
  assert.equal(
    cellTitle({ day: END, level: 0, count: null, inRange: true }),
    "Jul 5 — no study",
  );
  assert.equal(
    cellTitle({ day: END, level: 2, count: 12, inRange: true }, END),
    "Jul 5 — 12 words practiced (today)",
  );
});

test("heatmapSummaryLabel reports days studied and current streak", () => {
  const model = buildHeatmap(["2026-06-15"], {}, END);
  assert.equal(
    heatmapSummaryLabel(model, 3),
    "Study heatmap: 1 days studied in the last year, current streak 3 days.",
  );
});
