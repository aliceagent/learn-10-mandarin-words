import test from "node:test";
import assert from "node:assert/strict";

import {
  FORECAST_DAYS,
  buildForecast,
  forecastBarTitle,
  forecastSummaryLabel,
} from "../src/lib/forecast-logic.ts";

// A fixed UTC instant keeps every bucket assertion deterministic. Noon avoids any
// accidental day-boundary sensitivity in the `now` itself.
const NOW = new Date("2026-07-05T12:00:00Z"); // a Sunday

// Build a minimal well-formed stat with a given dueAt; the other SRS fields are
// irrelevant to bucketing but present so the shape is realistic.
function stat(dueAt) {
  return { intervalDays: 1, ease: 2.5, dueAt, reviewCount: 1, lapses: 0 };
}

test("empty stats → seven zero days, correct labels, empty totals", () => {
  const model = buildForecast({}, NOW);
  assert.equal(model.days.length, FORECAST_DAYS);
  assert.equal(model.total, 0);
  assert.equal(model.max, 0);
  assert.equal(model.beyondWindow, 0);
  for (const d of model.days) assert.equal(d.count, 0);

  // Today first, then "Tmrw", then UTC weekday names. 2026-07-05 is a Sunday, so
  // the window runs Sun, Mon(+1), Tue(+2) … Sat(+6).
  assert.deepEqual(
    model.days.map((d) => d.label),
    ["Today", "Tmrw", "Tue", "Wed", "Thu", "Fri", "Sat"],
  );
  assert.equal(model.days[0].isToday, true);
  assert.equal(model.days[1].isToday, false);
  assert.equal(model.days[0].day, "2026-07-05");
  assert.equal(model.days[6].day, "2026-07-11");
});

test("overdue cards fold into the Today bucket", () => {
  const model = buildForecast(
    { a: stat("2026-07-01T09:00:00Z"), b: stat("2026-06-20T00:00:00Z") },
    NOW,
  );
  assert.equal(model.days[0].count, 2);
  assert.equal(model.total, 2);
  assert.equal(model.beyondWindow, 0);
});

test("UTC day boundary: 23:00Z today → Today, 00:30Z tomorrow → Tmrw", () => {
  const model = buildForecast(
    { a: stat("2026-07-05T23:00:00Z"), b: stat("2026-07-06T00:30:00Z") },
    NOW,
  );
  assert.equal(model.days[0].count, 1); // late today still Today
  assert.equal(model.days[1].count, 1); // just past midnight → +1
  assert.equal(model.total, 2);
});

test("day +6 lands in the last bucket; day +7 spills to beyondWindow", () => {
  const model = buildForecast(
    { a: stat("2026-07-11T08:00:00Z"), b: stat("2026-07-12T08:00:00Z") },
    NOW,
  );
  assert.equal(model.days[FORECAST_DAYS - 1].count, 1); // +6 in window
  assert.equal(model.total, 1);
  assert.equal(model.beyondWindow, 1); // +7 excluded but tracked
});

test("corrupt or missing dueAt is skipped without throwing", () => {
  const model = buildForecast(
    {
      good: stat("2026-07-05T10:00:00Z"),
      junk: stat("garbage"),
      empty: stat(""),
      undef: stat(undefined),
      nullish: null,
    },
    NOW,
  );
  assert.equal(model.total, 1); // only the well-formed one counts
  assert.equal(model.days[0].count, 1);
});

test("max and total reflect a multi-day spread", () => {
  const model = buildForecast(
    {
      a: stat("2026-07-05T10:00:00Z"), // Today
      b: stat("2026-07-05T11:00:00Z"), // Today
      c: stat("2026-07-05T12:00:00Z"), // Today  → 3 on Today
      d: stat("2026-07-07T10:00:00Z"), // +2     → 1
      e: stat("2026-07-08T10:00:00Z"), // +3
      f: stat("2026-07-08T11:00:00Z"), // +3     → 2
    },
    NOW,
  );
  assert.equal(model.days[0].count, 3);
  assert.equal(model.days[2].count, 1);
  assert.equal(model.days[3].count, 2);
  assert.equal(model.total, 6);
  assert.equal(model.max, 3);
});

test("forecastSummaryLabel wording: zero, singular, plural, beyondWindow", () => {
  const zero = buildForecast({}, NOW);
  assert.equal(forecastSummaryLabel(zero), "No cards due in the next 7 days.");

  const plural = buildForecast(
    {
      a: stat("2026-07-05T10:00:00Z"),
      b: stat("2026-07-05T11:00:00Z"),
      c: stat("2026-07-05T12:00:00Z"),
      d: stat("2026-07-05T13:00:00Z"), // 4 today
      e: stat("2026-07-07T10:00:00Z"), // +2 (1 of 3 "more")
      f: stat("2026-07-08T10:00:00Z"), // +3
      g: stat("2026-07-09T10:00:00Z"), // +4  → 3 more
    },
    NOW,
  );
  assert.equal(
    forecastSummaryLabel(plural),
    "Review forecast: 4 cards due today, 3 more over the next 6 days.",
  );

  const singular = buildForecast({ a: stat("2026-07-05T10:00:00Z") }, NOW);
  assert.equal(
    forecastSummaryLabel(singular),
    "Review forecast: 1 card due today, 0 more over the next 6 days.",
  );

  const beyond = buildForecast(
    {
      a: stat("2026-07-05T10:00:00Z"), // today
      b: stat("2026-08-01T10:00:00Z"), // far out
      c: stat("2026-08-02T10:00:00Z"), // far out
    },
    NOW,
  );
  assert.equal(
    forecastSummaryLabel(beyond),
    "Review forecast: 1 card due today, 0 more over the next 6 days, 2 due later.",
  );
});

test("forecastBarTitle renders Today, Tomorrow, and weekday buckets", () => {
  const model = buildForecast(
    {
      a: stat("2026-07-05T10:00:00Z"), // Today
      b: stat("2026-07-06T10:00:00Z"), // Tmrw
      c: stat("2026-07-09T10:00:00Z"), // +4 → Thu Jul 9
    },
    NOW,
  );
  assert.equal(forecastBarTitle(model.days[0]), "Today — 1 card due");
  assert.equal(forecastBarTitle(model.days[1]), "Tomorrow — 1 card due");
  assert.equal(forecastBarTitle(model.days[4]), "Thu Jul 9 — 1 card due");
  // Plural + zero forms.
  assert.equal(forecastBarTitle(model.days[2]), "Tue Jul 7 — 0 cards due");
});
