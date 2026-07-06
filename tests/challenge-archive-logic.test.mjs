import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCHIVE_MAX_MONTHS,
  archiveCellLabel,
  archiveSummary,
  buildChallengeArchive,
  resultStrip,
  scoreTier,
} from "../src/lib/challenge-archive-logic.ts";

// A fixed UTC day keeps every grid assertion deterministic.
const TODAY = "2026-07-07"; // a Tuesday in July 2026

// Convenience: a well-formed stored result.
const result = (score, total = 10, completedAt = `${TODAY}T12:00:00.000Z`) => ({
  score,
  total,
  completedAt,
});

// Find a cell for a given day across all months, or null.
function findCell(months, day) {
  for (const m of months) {
    for (const week of m.weeks) {
      for (const cell of week) {
        if (cell.day === day && cell.inMonth) return cell;
      }
    }
  }
  return null;
}

test("every week has exactly 7 cells and starts on a UTC Sunday", () => {
  const months = buildChallengeArchive({}, TODAY);
  for (const m of months) {
    for (const week of m.weeks) {
      assert.equal(week.length, 7);
      assert.equal(new Date(week[0].day).getUTCDay(), 0);
      assert.equal(new Date(week[6].day).getUTCDay(), 6);
    }
  }
});

test("empty map yields only the current month", () => {
  const months = buildChallengeArchive({}, TODAY);
  assert.equal(months.length, 1);
  assert.equal(months[0].key, "2026-07");
  assert.equal(months[0].label, "July 2026");
});

test("all in-month days of today's month appear exactly once", () => {
  const months = buildChallengeArchive({}, TODAY);
  const inMonth = [];
  for (const week of months[0].weeks) {
    for (const cell of week) if (cell.inMonth) inMonth.push(cell.day);
  }
  // July has 31 days.
  assert.equal(inMonth.length, 31);
  assert.equal(new Set(inMonth).size, 31);
  assert.equal(inMonth[0], "2026-07-01");
  assert.equal(inMonth[30], "2026-07-31");
});

test("isToday marks only today; isFuture marks days after today", () => {
  const months = buildChallengeArchive({}, TODAY);
  let todayCount = 0;
  for (const week of months[0].weeks) {
    for (const cell of week) {
      if (cell.isToday) todayCount++;
      if (cell.isToday) assert.equal(cell.day, TODAY);
      assert.equal(cell.isFuture, cell.day > TODAY);
    }
  }
  assert.equal(todayCount, 1);
});

test("a result two months back adds that month; months without results excluded", () => {
  const map = {
    "2026-05-10": result(9),
    "2026-07-03": result(7),
  };
  const months = buildChallengeArchive(map, TODAY);
  const keys = months.map((m) => m.key);
  assert.deepEqual(keys, ["2026-07", "2026-05"]); // June excluded (no results); newest first
  assert.ok(findCell(months, "2026-05-10"));
});

test("never more than ARCHIVE_MAX_MONTHS, newest first", () => {
  const map = {
    "2026-07-01": result(5),
    "2026-06-01": result(5),
    "2026-05-01": result(5),
    "2026-04-01": result(5), // would be a 4th month → dropped by the cap
  };
  const months = buildChallengeArchive(map, TODAY);
  assert.equal(months.length, ARCHIVE_MAX_MONTHS);
  assert.deepEqual(
    months.map((m) => m.key),
    ["2026-07", "2026-06", "2026-05"],
  );
});

test("in-month cells carry results; padding cells never do", () => {
  const map = { "2026-07-03": result(8) };
  const months = buildChallengeArchive(map, TODAY);
  const played = findCell(months, "2026-07-03");
  assert.ok(played?.result);
  assert.equal(played.result.score, 8);
  // Padding cells (inMonth false) always have a null result.
  for (const m of months) {
    for (const week of m.weeks) {
      for (const cell of week) {
        if (!cell.inMonth) assert.equal(cell.result, null);
      }
    }
  }
});

test("scoreTier bands: miss, low, mid, high, perfect", () => {
  assert.equal(scoreTier(0, 10), 0);
  assert.equal(scoreTier(3, 10), 1); // 30% < 40
  assert.equal(scoreTier(4, 10), 2); // 40%
  assert.equal(scoreTier(6, 10), 2); // 60%
  assert.equal(scoreTier(7, 10), 3); // 70%
  assert.equal(scoreTier(9, 10), 3);
  assert.equal(scoreTier(10, 10), 4); // perfect
});

test("scoreTier tolerates total = 0 and non-finite input without NaN", () => {
  assert.equal(scoreTier(0, 0), 0);
  assert.equal(scoreTier(5, 0), 0);
  assert.equal(scoreTier(NaN, 10), 0);
  assert.equal(scoreTier(5, NaN), 0);
  // score clamps to total when it somehow exceeds it.
  assert.equal(scoreTier(12, 10), 4);
});

test("resultStrip: greens-then-reds reconstruction", () => {
  assert.equal(resultStrip(result(3, 5)), "🟩🟩🟩🟥🟥");
  assert.equal(resultStrip(result(5, 5)), "🟩🟩🟩🟩🟩"); // all green
  assert.equal(resultStrip(result(0, 3)), "🟥🟥🟥"); // all red
});

test("resultStrip returns empty string for junk input", () => {
  assert.equal(resultStrip(null), "");
  assert.equal(resultStrip({}), "");
  assert.equal(resultStrip({ score: 3 }), "");
});

test("archiveSummary counts played, perfect, and averages score", () => {
  const map = {
    "2026-07-01": result(10),
    "2026-07-02": result(8),
    "2026-07-03": result(6),
  };
  const summary = archiveSummary(map);
  assert.equal(summary.played, 3);
  assert.equal(summary.perfect, 1);
  assert.equal(summary.average, 8); // (10 + 8 + 6) / 3
});

test("archiveSummary rounds average to one decimal", () => {
  const map = {
    "2026-07-01": result(10),
    "2026-07-02": result(9),
  };
  assert.equal(archiveSummary(map).average, 9.5);
  const map2 = {
    "2026-07-01": result(10),
    "2026-07-02": result(7),
    "2026-07-03": result(7),
  };
  assert.equal(archiveSummary(map2).average, 8); // 24/3
});

test("archiveSummary on an empty or junk map yields zeros, no NaN", () => {
  assert.deepEqual(archiveSummary({}), { played: 0, perfect: 0, average: 0 });
  assert.deepEqual(archiveSummary(undefined), { played: 0, perfect: 0, average: 0 });
  const junk = { "not-a-day": result(5), "2026-07-01": { score: "x" } };
  assert.deepEqual(archiveSummary(junk), { played: 0, perfect: 0, average: 0 });
});

test("archiveCellLabel: played, unplayed, and today variants", () => {
  const cell = (day, res, isToday = false) => ({
    day,
    result: res,
    inMonth: true,
    isToday,
    isFuture: false,
  });
  assert.equal(archiveCellLabel(cell("2026-07-05", result(8))), "Jul 5 — 8/10");
  assert.equal(archiveCellLabel(cell("2026-07-05", null)), "Jul 5 — not played");
  assert.equal(archiveCellLabel(cell("2026-07-07", result(9), true)), "Jul 7 — 9/10 (today)");
});

test("junk day keys and malformed results do not throw", () => {
  const map = {
    "not-a-day": result(5),
    "2026-13-99": result(5), // invalid calendar day
    "2026-07-03": { score: "eight", total: null }, // malformed
    "2026-07-04": result(7), // valid
  };
  const months = buildChallengeArchive(map, TODAY);
  assert.equal(months.length, 1); // only current month; junk keys never spawn months
  assert.equal(findCell(months, "2026-07-03")?.result, null); // malformed → no result
  assert.ok(findCell(months, "2026-07-04")?.result); // valid result survives
});

test("invalid `today` falls back without throwing", () => {
  const months = buildChallengeArchive({}, "garbage");
  assert.ok(Array.isArray(months));
  assert.ok(months.length >= 1);
});
