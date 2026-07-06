"use client";

import { useMemo, useState } from "react";
import type { DailyChallengeResult } from "@/lib/types";
import {
  archiveCellLabel,
  archiveSummary,
  buildChallengeArchive,
  resultStrip,
  scoreTier,
  type ArchiveCell,
  type ScoreTier,
} from "@/lib/challenge-archive-logic";
import { challengeStreak } from "@/lib/progress-logic";

// Daily challenge archive (Sprint 11). Purely presentational: it derives its
// month grids from the persisted `dailyChallenge` map via the pure helpers in
// challenge-archive-logic and renders them, with only local selection state.
// Read-only over existing data — no persistence, no schema change, no network.
//
// Cell colour follows study-heatmap's emerald ramp (LEVEL_CLASS): a quiet base
// for a miss, brightening to solid emerald for a perfect ten. Today gets the
// same ring-1 ring-emerald-300 treatment as the heatmap's current-day cell.

const TIER_CLASS: Record<ScoreTier, string> = {
  0: "bg-white/[0.06]",
  1: "bg-emerald-400/25",
  2: "bg-emerald-400/45",
  3: "bg-emerald-400/70",
  4: "bg-emerald-400",
};

// Bright tiers need dark day-numbers for contrast; quiet tiers keep light text.
const TIER_TEXT: Record<ScoreTier, string> = {
  0: "text-slate-400",
  1: "text-emerald-100",
  2: "text-emerald-50",
  3: "text-slate-950/80",
  4: "text-slate-950",
};

// Sun→Sat gutter, matching the grid's day-of-week ordering.
const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

export function ChallengeArchive({
  dailyChallenge,
  today,
}: {
  dailyChallenge: Record<string, DailyChallengeResult>;
  today: string;
}): React.JSX.Element {
  const months = useMemo(
    () => buildChallengeArchive(dailyChallenge, today),
    [dailyChallenge, today],
  );
  const summary = useMemo(() => archiveSummary(dailyChallenge), [dailyChallenge]);
  const streak = challengeStreak(dailyChallenge, today);

  // The newest played day, used as the default-selected detail. Recomputes when
  // a fresh result lands, so completing today auto-selects it.
  const newestDay = useMemo(() => {
    const days = Object.keys(dailyChallenge)
      .filter((d) => dailyChallenge[d] && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    return days.length > 0 ? days[days.length - 1] : null;
  }, [dailyChallenge]);

  const [picked, setPicked] = useState<string | null>(null);
  // Derived selection: an explicit pick that still has a result, else the newest
  // day. No effect needed — this follows new results until the learner taps one.
  const selectedDay = picked && dailyChallenge[picked] ? picked : newestDay;
  const selectedResult = selectedDay ? dailyChallenge[selectedDay] : null;

  const heading = (
    <div>
      <h2 className="text-xl font-semibold text-white">Challenge archive</h2>
      <p className="mt-1 text-sm text-slate-400">Your last 60 days of daily challenges.</p>
    </div>
  );

  // Empty state: nothing played yet → a single teaser line, no grid.
  if (summary.played === 0) {
    return (
      <section
        className="mt-8 rounded-3xl border border-white/10 bg-surface p-6"
        aria-label="Daily challenge archive"
      >
        {heading}
        <p className="mt-4 text-sm text-slate-300">
          No challenges yet — finish today&apos;s ten to start your archive.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mt-8 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Daily challenge archive"
    >
      {heading}

      {/* Summary chips — mirror the completion card's streak pill styling. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
          🗓️ {summary.played} played
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
          🏆 {summary.perfect} perfect
        </span>
        {streak > 0 ? (
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
            🔥 {streak}-day streak
          </span>
        ) : null}
      </div>

      {/* Month grids, newest first. */}
      <div className="mt-6 space-y-6">
        {months.map((month) => (
          <div key={month.key}>
            <p className="text-sm font-semibold text-slate-300">{month.label}</p>
            <div aria-hidden="true" className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-slate-500">
              {WEEKDAY_HEADERS.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1.5">
              {month.weeks.flat().map((cell) => (
                <Cell
                  key={cell.day}
                  cell={cell}
                  selected={cell.day === selectedDay}
                  onSelect={setPicked}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend: miss → perfect intensity ramp. */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <span>Miss</span>
        <div className="flex items-center gap-1" aria-hidden="true">
          {([0, 1, 2, 3, 4] as ScoreTier[]).map((tier) => (
            <span key={tier} className={`h-3 w-3 rounded-[3px] ${TIER_CLASS[tier]}`} />
          ))}
        </div>
        <span>Perfect</span>
      </div>

      {/* Selected-day detail: date, reconstructed emoji strip, score. */}
      {selectedResult ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-surface-2 p-5">
          <p className="text-sm font-semibold text-slate-300">{detailDate(selectedDay ?? "")}</p>
          <p className="mt-2 text-2xl tracking-wide" aria-hidden="true">
            {resultStrip(selectedResult)}
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">
            {selectedResult.score}
            <span className="text-lg text-slate-400">/{selectedResult.total}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">Strip shows your score, not question order.</p>
        </div>
      ) : null}
    </section>
  );
}

// One calendar square. Padding cells (from an adjacent month) render as an
// invisible spacer so each grid stays rectangular. Played days are selectable
// buttons tinted by score tier; unplayed and future days are inert. Today gets
// an emerald ring; the selected day gets a brighter ring.
function Cell({
  cell,
  selected,
  onSelect,
}: {
  cell: ArchiveCell;
  selected: boolean;
  onSelect: (day: string) => void;
}): React.JSX.Element {
  if (!cell.inMonth) {
    return <span aria-hidden="true" className="aspect-square" />;
  }

  const dayNum = Number(cell.day.slice(8, 10));
  const ring = selected
    ? " ring-2 ring-emerald-200"
    : cell.isToday
    ? " ring-1 ring-emerald-300"
    : "";

  if (cell.result) {
    const tier = scoreTier(cell.result.score, cell.result.total);
    return (
      <button
        type="button"
        onClick={() => onSelect(cell.day)}
        title={archiveCellLabel(cell)}
        aria-label={archiveCellLabel(cell)}
        aria-pressed={selected}
        className={`flex aspect-square min-h-[36px] items-center justify-center rounded-lg text-[11px] font-semibold transition hover:brightness-110 ${TIER_CLASS[tier]} ${TIER_TEXT[tier]}${ring}`}
      >
        {dayNum}
      </button>
    );
  }

  // Unplayed / future in-month day: inert, faint, not focusable.
  return (
    <span
      title={archiveCellLabel(cell)}
      className={`flex aspect-square min-h-[36px] items-center justify-center rounded-lg text-[11px] font-medium text-slate-600 ${
        cell.isFuture ? "opacity-40" : "bg-white/[0.03]"
      }${ring}`}
    >
      {dayNum}
    </span>
  );
}

// Long-form date for the detail line, e.g. "July 5, 2026". Locale-independent to
// match the pure logic's hardcoded month names.
const DETAIL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function detailDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const date = new Date(day);
  return `${DETAIL_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
