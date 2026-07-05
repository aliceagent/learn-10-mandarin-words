// Pure, DOM-free derivation for the /stats study heatmap (Sprint 5). It reads
// ONLY the two progress fields the app already persists — `studiedDates`
// (ISO "YYYY-MM-DD" UTC days, full history) and `dailyActivity` (day → distinct
// wordKeys, pruned to the last 14 days) — and turns them into a GitHub-style
// 53-week contribution grid. No schema change, no new persistence, no network.
//
// Everything here uses the app-wide UTC-day convention (`todayISO()` →
// `toISOString().slice(0, 10)`), the same one the streak/goal already use, so the
// heatmap stays in lock-step with the streak pill rather than drifting a day for
// users far from UTC. Injectable `endDay` keeps it deterministic under tests.

// Value import needs the explicit `.ts` extension so it resolves under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors progress-logic.ts.
import { todayISO } from "./progress-logic.ts";

// Whole day in milliseconds — the same constant computeStreak uses for its
// consecutive-day arithmetic. UTC days have no DST, so fixed-ms math is exact.
const DAY_MS = 86_400_000;

// Short UTC month names, indexed by getUTCMonth(). Hardcoded rather than derived
// via toLocaleString so labels are deterministic and locale-independent (the
// pure logic must not depend on the host's Intl locale).
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// A fresh month label is only placed when it is at least this many columns from
// the previously placed one, so adjacent months on a cramped grid don't collide.
const MONTH_LABEL_MIN_GAP = 3;

// Number of week-columns in the grid (a little over a year, matching GitHub).
export const HEATMAP_WEEKS = 53;

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = {
  day: string; // "YYYY-MM-DD" (UTC day, same convention as todayISO)
  level: HeatLevel;
  count: number | null; // distinct words practiced, null when no dailyActivity entry
  inRange: boolean; // false for grid-padding cells after endDay (rendered invisible)
};

export type HeatmapModel = {
  weeks: HeatmapCell[][]; // HEATMAP_WEEKS columns × 7 rows, Sun→Sat
  monthLabels: { weekIndex: number; label: string }[]; // "Jan", "Feb", …
  daysStudied: number; // studied days inside the window
};

// True for a well-formed ISO day string ("YYYY-MM-DD"). Same idiom as
// progress-logic's isISODayKey: reject junk defensively so a corrupt
// studiedDates entry can never throw during grid construction.
function isISODay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime());
}

// UTC midnight epoch-ms for an ISO day string.
function dayMs(day: string): number {
  return new Date(day).getTime();
}

// ISO day string `days` after (or before, when negative) `fromMs`.
function isoFrom(fromMs: number, days: number): string {
  return new Date(fromMs + days * DAY_MS).toISOString().slice(0, 10);
}

// Map a studied flag + word count to an intensity tier. The asymmetry is
// deliberate and documented:
//   - not studied            → 0 (the quiet base cell)
//   - studied, count 1–3     → 1, 4–7 → 2, 8–14 → 3, 15+ → 4
//   - studied, null or 0     → 1
// A studied day carries `null` (or effectively 0) intensity in two legitimate
// cases: it's older than the 14-day dailyActivity retention window, or it was lit
// only by toggleLearnedTopic (which stamps studiedDates WITHOUT dailyActivity).
// Those days are real study, so they light at the lowest tier rather than reading
// as "not studied".
export function heatLevel(studied: boolean, count: number | null): HeatLevel {
  if (!studied) return 0;
  if (count == null || count <= 0) return 1;
  if (count <= 3) return 1;
  if (count <= 7) return 2;
  if (count <= 14) return 3;
  return 4;
}

// Build the 53-week grid ending on `endDay` (default today, UTC). Columns are
// weeks; rows are Sun→Sat by UTC day-of-week. The final column holds `endDay` at
// its weekday row; later rows in that column are future padding (`inRange:false`)
// so the grid always ends on a clean week boundary. The first column always
// starts on a Sunday. O(days) with a Set lookup — negligible even after years of
// use.
export function buildHeatmap(
  studiedDates: string[],
  dailyActivity: Record<string, string[]> | undefined,
  endDay: string = todayISO(),
  weeks: number = HEATMAP_WEEKS,
): HeatmapModel {
  // Only well-formed days participate; duplicates collapse via the Set.
  const studiedSet = new Set(studiedDates.filter(isISODay));
  const activity = dailyActivity ?? {};

  const endMs = dayMs(endDay);
  const endDow = new Date(endDay).getUTCDay(); // 0 = Sun … 6 = Sat
  // Sunday of endDay's week, then step back to the grid's very first Sunday.
  const lastSundayMs = endMs - endDow * DAY_MS;
  const firstSundayMs = lastSundayMs - (weeks - 1) * 7 * DAY_MS;

  const grid: HeatmapCell[][] = [];
  let daysStudied = 0;

  for (let col = 0; col < weeks; col++) {
    const column: HeatmapCell[] = [];
    for (let row = 0; row < 7; row++) {
      const cellMs = firstSundayMs + (col * 7 + row) * DAY_MS;
      const day = isoFrom(firstSundayMs, col * 7 + row);
      const inRange = cellMs <= endMs;
      const studied = inRange && studiedSet.has(day);
      // A dailyActivity entry gives a real count; its absence is null (unknown),
      // which heatLevel treats as the lowest lit tier for a studied day.
      const entry = activity[day];
      const count = Array.isArray(entry) ? entry.length : null;
      if (studied) daysStudied++;
      column.push({ day, level: heatLevel(studied, count), count, inRange });
    }
    grid.push(column);
  }

  return { weeks: grid, monthLabels: monthLabels(grid), daysStudied };
}

// Place a short month label on the column whose week contains that month's 1st
// (an in-range cell with getUTCDate() === 1). Labels closer than
// MONTH_LABEL_MIN_GAP columns to the previously placed one are dropped so a
// narrow grid never shows cramped, overlapping months.
function monthLabels(grid: HeatmapCell[][]): { weekIndex: number; label: string }[] {
  const labels: { weekIndex: number; label: string }[] = [];
  let lastPlaced = -Infinity;
  for (let col = 0; col < grid.length; col++) {
    const firstOfMonth = grid[col].find(
      (cell) => cell.inRange && new Date(cell.day).getUTCDate() === 1,
    );
    if (!firstOfMonth) continue;
    if (col - lastPlaced < MONTH_LABEL_MIN_GAP) continue;
    labels.push({ weekIndex: col, label: MONTH_NAMES[new Date(firstOfMonth.day).getUTCMonth()] });
    lastPlaced = col;
  }
  return labels;
}

// Native-title tooltip text for one cell. `today` (optional) lets the caller mark
// the current day; when a cell's day matches it, " (today)" is appended.
//   studied with a word count → "Jul 5 — 12 words practiced"
//   studied without a count   → "Jul 5 — studied"
//   not studied               → "Jul 5 — no study"
export function cellTitle(cell: HeatmapCell, today?: string): string {
  const date = new Date(cell.day);
  const label = `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
  const studied = cell.level > 0;
  let state: string;
  if (studied && cell.count != null && cell.count > 0) {
    state = `${cell.count} word${cell.count !== 1 ? "s" : ""} practiced`;
  } else if (studied) {
    state = "studied";
  } else {
    state = "no study";
  }
  const suffix = today && cell.day === today ? " (today)" : "";
  return `${label} — ${state}${suffix}`;
}

// Accessible summary for the grid's single role="img" container, so a screen
// reader hears one meaningful sentence instead of hundreds of anonymous cells.
export function heatmapSummaryLabel(model: HeatmapModel, streak: number): string {
  return `Study heatmap: ${model.daysStudied} days studied in the last year, current streak ${streak} days.`;
}
