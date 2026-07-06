// Pure, DOM-free derivation for the /daily challenge archive (Sprint 11). It
// reads ONLY the progress field the app already persists — `dailyChallenge`
// (ISO "YYYY-MM-DD" UTC day → { score, total, completedAt }, pruned to the last
// 60 days by DAILY_CHALLENGE_RETENTION_DAYS) — and turns it into month calendar
// grids with score-tinted cells and reconstructed emoji strips. No schema
// change, no new persistence, no network.
//
// Everything here uses the app-wide UTC-day convention (`todayISO()` →
// `toISOString().slice(0, 10)`), the same one the challenge streak already uses,
// so the archive stays in lock-step with the streak pill rather than drifting a
// day for users far from UTC. Injectable `today` keeps it deterministic under
// tests. Mirrors the house style established by heatmap-logic.ts.

import type { DailyChallengeResult } from "./types";
// Value imports need the explicit `.ts` extension so they resolve under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors heatmap-logic.ts.
import { outcomeStrip } from "./daily-logic.ts";
import { todayISO } from "./progress-logic.ts";

// Whole day in milliseconds. UTC days have no DST, so fixed-ms math is exact —
// the same constant the streak/heatmap arithmetic uses.
const DAY_MS = 86_400_000;

// 60-day retention (DAILY_CHALLENGE_RETENTION_DAYS) can straddle at most three
// calendar months, so the archive never needs to render more than three grids.
export const ARCHIVE_MAX_MONTHS = 3;

// Short UTC month names, indexed by getUTCMonth() — used for compact cell
// tooltips ("Jul 5"). Full names below drive the month-grid headers.
const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// True for a well-formed ISO day string ("YYYY-MM-DD"). Same idiom as
// progress-logic's isISODayKey: reject junk defensively so a corrupt
// dailyChallenge key can never throw during grid construction.
function isISODay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime());
}

// ISO day string for a UTC-midnight epoch-ms value.
function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Defensively coerce a stored result to the { score, total, completedAt }
// invariant (score is a non-negative integer ≤ total). Loads are already
// sanitized by normalizeDailyChallenge, but the archive re-validates so junk
// passed directly in tests (or a future caller) can never throw. Returns null
// for anything that isn't a usable result.
function normalizeResult(raw: unknown): DailyChallengeResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<DailyChallengeResult>;
  const score = Number(r.score);
  const total = Number(r.total);
  if (!Number.isFinite(score) || !Number.isFinite(total) || total < 0) return null;
  const t = Math.max(0, Math.round(total));
  const s = Math.max(0, Math.min(Math.round(score), t));
  const completedAt = typeof r.completedAt === "string" ? r.completedAt : "";
  return { score: s, total: t, completedAt };
}

// Cell-color intensity for a finished run, from a miss (0) to a perfect run (4).
// Bands are fraction-based so they hold for any `total`:
//   score 0        → 0 (miss, the quiet base cell)
//   < 40%          → 1
//   < 70%          → 2
//   below perfect  → 3
//   score === total→ 4 (perfect, the brightest tier)
// Tolerates total = 0 or non-finite input (→ 0) without producing NaN.
export type ScoreTier = 0 | 1 | 2 | 3 | 4;
export function scoreTier(score: number, total: number): ScoreTier {
  if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return 0;
  const s = Math.max(0, Math.min(score, total));
  if (s <= 0) return 0;
  if (s >= total) return 4;
  const f = s / total;
  if (f < 0.4) return 1;
  if (f < 0.7) return 2;
  return 3;
}

export type ArchiveCell = {
  day: string; // "YYYY-MM-DD" (UTC day, same convention as todayISO)
  result: DailyChallengeResult | null; // null for padding cells and unplayed days
  inMonth: boolean; // false → padding cell from an adjacent month
  isToday: boolean;
  isFuture: boolean; // day after `today` — rendered inert
};

export type ArchiveMonth = {
  key: string; // "YYYY-MM"
  label: string; // "July 2026" (hardcoded month names, locale-independent)
  weeks: ArchiveCell[][]; // rows of 7, Sun→Sat
};

// Build one month's Sun→Sat calendar grid. Leading days from the previous month
// and trailing days from the next complete the first/last weeks as padding cells
// (`inMonth: false`). Only in-month days carry a result, so a day never appears
// twice across adjacent month grids.
function buildMonth(
  key: string,
  map: Record<string, unknown>,
  today: string,
  todayMs: number,
): ArchiveMonth {
  const year = Number(key.slice(0, 4));
  const month0 = Number(key.slice(5, 7)) - 1;

  const firstMs = Date.UTC(year, month0, 1);
  const firstDow = new Date(firstMs).getUTCDay(); // 0 = Sun … 6 = Sat
  const gridStartMs = firstMs - firstDow * DAY_MS; // back up to that week's Sunday

  const lastMs = Date.UTC(year, month0 + 1, 0); // day 0 of next month = last of this
  const lastDow = new Date(lastMs).getUTCDay();
  const gridEndMs = lastMs + (6 - lastDow) * DAY_MS; // forward to that week's Saturday

  const cellCount = Math.round((gridEndMs - gridStartMs) / DAY_MS) + 1;
  const weeks: ArchiveCell[][] = [];
  for (let i = 0; i < cellCount; i++) {
    const ms = gridStartMs + i * DAY_MS;
    const day = isoFromMs(ms);
    const inMonth = day.slice(0, 7) === key;
    const result = inMonth ? normalizeResult(map[day]) : null;
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      day,
      result,
      inMonth,
      isToday: day === today,
      isFuture: ms > todayMs,
    });
  }

  return { key, label: `${MONTH_NAMES_FULL[month0]} ${year}`, weeks };
}

// Build the newest-first month grids for the archive. The current month is
// always included; older months appear only when they hold at least one result;
// the total is capped at ARCHIVE_MAX_MONTHS (60-day retention spans ≤ 3 months).
// `today` is injectable for deterministic tests and defaults to the real day.
export function buildChallengeArchive(
  map: Record<string, DailyChallengeResult> | undefined,
  today: string = todayISO(),
): ArchiveMonth[] {
  const safeToday = isISODay(today) ? today : todayISO();
  const todayMs = new Date(safeToday).getTime();
  const currentKey = safeToday.slice(0, 7); // "YYYY-MM"
  const source = (map ?? {}) as Record<string, unknown>;

  // Month keys (< current) that contain at least one usable result.
  const olderWithResults = new Set<string>();
  for (const [day, raw] of Object.entries(source)) {
    if (!isISODay(day)) continue;
    const monthKey = day.slice(0, 7);
    if (monthKey < currentKey && normalizeResult(raw)) olderWithResults.add(monthKey);
  }

  const older = [...olderWithResults].sort().reverse(); // newest first
  const keys = [currentKey, ...older].slice(0, ARCHIVE_MAX_MONTHS);
  return keys.map((key) => buildMonth(key, source, safeToday, todayMs));
}

// The emoji strip for a stored result. Per-question order is NOT persisted — only
// the score — so this reconstructs a representative strip as `score` greens
// followed by `total − score` reds, the exact convention daily-app.tsx uses for
// the completion card. Returns "" for junk input.
export function resultStrip(result: DailyChallengeResult): string {
  const r = normalizeResult(result);
  if (!r) return "";
  const outcomes = [
    ...Array(r.score).fill(true),
    ...Array(Math.max(0, r.total - r.score)).fill(false),
  ];
  return outcomeStrip(outcomes);
}

export type ArchiveSummary = {
  played: number; // days with a usable result
  perfect: number; // days where score === total
  average: number; // mean score across played days, one decimal (0 when none)
};

// Aggregate the already-pruned map into headline numbers. Ignores invalid keys
// and junk results, and never divides by zero (empty map → all zeros).
export function archiveSummary(
  map: Record<string, DailyChallengeResult> | undefined,
): ArchiveSummary {
  let played = 0;
  let perfect = 0;
  let sumScore = 0;
  for (const [day, raw] of Object.entries(map ?? {})) {
    if (!isISODay(day)) continue;
    const r = normalizeResult(raw);
    if (!r || r.total <= 0) continue;
    played++;
    sumScore += r.score;
    if (r.score === r.total) perfect++;
  }
  const average = played > 0 ? Math.round((sumScore / played) * 10) / 10 : 0;
  return { played, perfect, average };
}

// Native-title / aria text for one cell:
//   played      → "Jul 5 — 8/10"
//   unplayed    → "Jul 5 — not played"
//   today suffix→ "Jul 6 — 9/10 (today)"
export function archiveCellLabel(cell: ArchiveCell): string {
  const date = new Date(cell.day);
  const label = `${MONTH_NAMES_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
  const state = cell.result ? `${cell.result.score}/${cell.result.total}` : "not played";
  const suffix = cell.isToday ? " (today)" : "";
  return `${label} — ${state}${suffix}`;
}
