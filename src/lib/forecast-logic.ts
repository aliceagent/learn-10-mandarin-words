// Pure, DOM-free derivation for the /review upcoming-due forecast (Sprint 7). It
// reads ONLY the persisted `flashcardStats` — every graded word already carries a
// `dueAt` ISO timestamp stamped by `scheduleReview` — and buckets those due dates
// into a 7-day bar chart. No schema change, no new persistence, no network, no
// chart library.
//
// Like heatmap-logic.ts, everything here uses the app-wide UTC-day convention
// (`todayISO()` → `toISOString().slice(0, 10)`), the same one the streak/goal/
// heatmap already use, so the forecast stays in lock-step rather than drifting a
// day for users far from UTC. Injectable `now` keeps it deterministic under tests.

// Type-only import needs the explicit `.ts` extension so it resolves under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors heatmap-logic.ts.
import type { FlashcardStat } from "./types.ts";

// Whole day in milliseconds — the same constant computeStreak/buildHeatmap use
// for consecutive-day arithmetic. UTC days have no DST, so fixed-ms math is exact.
const DAY_MS = 86_400_000;

// Number of day-columns in the chart: today plus the next six days.
export const FORECAST_DAYS = 7;

// Short UTC weekday names, indexed by getUTCDay() (0 = Sun … 6 = Sat). Hardcoded
// rather than derived via toLocaleString so labels are deterministic and
// locale-independent (the pure logic must not depend on the host's Intl locale).
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Short UTC month names, indexed by getUTCMonth(). Same rationale as above; used
// only by the per-bar tooltip for weekday buckets ("Thu Jul 9").
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export type ForecastDay = {
  day: string; // "YYYY-MM-DD" (UTC day, same convention as todayISO)
  label: string; // "Today" | "Tmrw" | "Mon" … "Sat"
  count: number; // cards whose dueAt falls on this UTC day (bucket 0 includes overdue)
  isToday: boolean;
};

export type ForecastModel = {
  days: ForecastDay[]; // exactly FORECAST_DAYS entries, today first
  total: number; // sum of counts inside the window
  max: number; // largest single-day count (0 when empty), for bar scaling
  beyondWindow: number; // tracked cards due after the window (for the summary line)
};

// True for a well-formed ISO timestamp. Same idiom as progress-logic's
// isValidISO: reject junk defensively so a corrupt `dueAt` can never throw during
// bucketing.
function isValidISO(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

// UTC midnight epoch-ms for an ISO day string.
function dayMs(day: string): number {
  return new Date(day).getTime();
}

// Build the 7-day due-count model ending `days - 1` days after `now` (default
// today, UTC). Bucket 0 is Today; buckets 1…6 are the next six UTC days. Each
// stat is placed by the UTC day of its `dueAt` (`.slice(0, 10)`):
//   - due day <= today  → bucket 0 (overdue folds into Today)
//   - today+1 … today+6 → buckets 1…6
//   - later than that   → excluded from the bars, counted in `beyondWindow`
//
// NOTE (deliberate): bucket 0 counts every card due on today's UTC day OR earlier,
// so it can read HIGHER than `dueCards(...).length`, which compares full
// timestamps (`dueAt <= now`) and therefore excludes cards due later today. That
// mismatch is honest — the subline copy ("coming due") owns it — and must NOT be
// "fixed" by switching to timestamp comparison. O(tracked words) with a single
// pass.
export function buildForecast(
  flashcardStats: Record<string, FlashcardStat>,
  now: Date = new Date(),
  days: number = FORECAST_DAYS,
): ForecastModel {
  // Same UTC-day derivation as todayISO() (`toISOString().slice(0, 10)`), but for
  // the injectable `now` so tests can pin the day boundary.
  const today = now.toISOString().slice(0, 10);
  const todayMs = dayMs(today);

  const counts = new Array<number>(days).fill(0);
  let beyondWindow = 0;

  for (const stat of Object.values(flashcardStats ?? {})) {
    if (!stat || !isValidISO(stat.dueAt)) continue;
    const dueDay = stat.dueAt.slice(0, 10);
    // Diff in whole UTC days between the due day and today. Rounded so any stray
    // sub-day drift (there shouldn't be, both are UTC midnights) can't leak.
    const diff = Math.round((dayMs(dueDay) - todayMs) / DAY_MS);
    if (diff <= 0) counts[0]++; // overdue or due today
    else if (diff < days) counts[diff]++;
    else beyondWindow++;
  }

  const forecastDays: ForecastDay[] = counts.map((count, i) => {
    const day = new Date(todayMs + i * DAY_MS).toISOString().slice(0, 10);
    return { day, label: bucketLabel(i, day), count, isToday: i === 0 };
  });

  return {
    days: forecastDays,
    total: counts.reduce((sum, c) => sum + c, 0),
    max: counts.reduce((hi, c) => (c > hi ? c : hi), 0),
    beyondWindow,
  };
}

// Column label: bucket 0 is "Today", bucket 1 the compact "Tmrw" (full word lives
// in the tooltip/aria), and every later bucket its short UTC weekday name.
function bucketLabel(index: number, day: string): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tmrw";
  return WEEKDAY_NAMES[new Date(day).getUTCDay()];
}

// Native-title tooltip text for one bar (singular/plural handled):
//   Today bucket   → "Today — 4 cards due"
//   Tomorrow       → "Tomorrow — 2 cards due"
//   weekday bucket → "Thu Jul 9 — 1 card due"
export function forecastBarTitle(day: ForecastDay): string {
  const due = `${day.count} card${day.count !== 1 ? "s" : ""} due`;
  let when: string;
  if (day.label === "Today") {
    when = "Today";
  } else if (day.label === "Tmrw") {
    when = "Tomorrow";
  } else {
    const date = new Date(day.day);
    when = `${WEEKDAY_NAMES[date.getUTCDay()]} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
  }
  return `${when} — ${due}`;
}

// Accessible summary for the chart's single role="img" container, so a screen
// reader hears one meaningful sentence instead of seven anonymous bars:
//   total 0          → "No cards due in the next 7 days."
//   otherwise        → "Review forecast: 4 cards due today, 7 more over the next
//                       6 days." ( + ", 12 due later" when beyondWindow > 0)
export function forecastSummaryLabel(model: ForecastModel): string {
  if (model.total === 0) return `No cards due in the next ${model.days.length} days.`;
  const todayCount = model.days[0].count;
  const rest = model.total - todayCount;
  let body =
    `${todayCount} card${todayCount !== 1 ? "s" : ""} due today, ` +
    `${rest} more over the next ${model.days.length - 1} days`;
  if (model.beyondWindow > 0) body += `, ${model.beyondWindow} due later`;
  return `Review forecast: ${body}.`;
}
