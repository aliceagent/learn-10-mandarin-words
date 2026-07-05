"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  buildHeatmap,
  cellTitle,
  heatmapSummaryLabel,
  type HeatLevel,
  type HeatmapCell,
} from "@/lib/heatmap-logic";
import { longestStreak, todayISO } from "@/lib/progress-logic";

// GitHub-style study heatmap (Sprint 5). Purely presentational: it derives its
// grid from the persisted progress via buildHeatmap and renders it, with no state
// of its own. `streak` is passed in from the stats page's already-computed
// stats.streak so the header chip can never disagree with the streak pill.
//
// A11y follows the MasteryDots precedent: the grid is one labelled `role="img"`
// with a full summary sentence, and every cell is `aria-hidden`, so a screen
// reader hears "Study heatmap: 42 days studied…" instead of hundreds of dots.

// Per-column pitch in px: a 12px (w-3) cell plus the 3px (gap-[3px]) gap. Used to
// absolutely position the month labels above their week columns.
const COLUMN_PITCH = 15;

// Cell fill per intensity tier. Level 0 is a quiet base; 1–4 ramp the emerald
// accent so a chain of study reads at a glance. Order matches heatLevel's tiers.
const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: "bg-white/[0.06]",
  1: "bg-emerald-400/25",
  2: "bg-emerald-400/45",
  3: "bg-emerald-400/70",
  4: "bg-emerald-400",
};

// Weekday gutter labels, one per row (Sun→Sat). Only Mon/Wed/Fri are shown, as on
// GitHub, so the gutter stays legible without crowding.
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function StudyHeatmap({
  studiedDates,
  dailyActivity,
  streak,
}: {
  studiedDates: string[];
  dailyActivity: Record<string, string[]>;
  streak: number;
}): React.JSX.Element {
  const today = todayISO();
  const model = useMemo(
    () => buildHeatmap(studiedDates, dailyActivity, today),
    [studiedDates, dailyActivity, today],
  );
  const best = useMemo(() => longestStreak(studiedDates), [studiedDates]);

  // Anchor the horizontal scroll to the newest week on mount so the most recent
  // (and most motivating) activity is visible first on narrow screens.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div>
      {/* Header chips: current streak, best-ever streak, days lit this year. */}
      <div className="flex flex-wrap items-center gap-2">
        {streak > 0 ? (
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
            🔥 {streak}-day streak
          </span>
        ) : null}
        {best > 0 ? (
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
            Best: {best} day{best !== 1 ? "s" : ""}
          </span>
        ) : null}
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
          {model.daysStudied} day{model.daysStudied !== 1 ? "s" : ""} lit this year
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        {/* Fixed weekday gutter — a spacer matching the month-label row keeps its
            first slot aligned with grid row 0. */}
        <div aria-hidden="true" className="flex flex-col text-[10px] text-slate-500">
          <div className="h-4" />
          <div className="flex flex-col gap-[3px]">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="flex h-3 items-center leading-none">
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable grid, anchored to the newest week on mount. */}
        <div ref={scrollRef} className="overflow-x-auto pb-1">
          <div className="inline-block">
            {/* Month labels, absolutely positioned over their week column. */}
            <div aria-hidden="true" className="relative h-4 text-[10px] text-slate-500">
              {model.monthLabels.map((m) => (
                <span
                  key={m.weekIndex}
                  className="absolute whitespace-nowrap"
                  style={{ left: `${m.weekIndex * COLUMN_PITCH}px` }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* The grid itself: one labelled image, cells hidden from AT. */}
            <div
              role="img"
              aria-label={heatmapSummaryLabel(model, streak)}
              className="flex gap-[3px]"
            >
              {model.weeks.map((week, col) => (
                <div key={col} className="flex flex-col gap-[3px]">
                  {week.map((cell, row) => (
                    <Cell key={row} cell={cell} today={today} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend: Less → More intensity ramp. */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <span>Less</span>
        <div className="flex items-center gap-[3px]" aria-hidden="true">
          {([0, 1, 2, 3, 4] as HeatLevel[]).map((level) => (
            <span key={level} className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASS[level]}`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

// One heatmap square. Out-of-range padding cells (future days completing the
// final week) render as an invisible spacer so the grid stays rectangular. Today
// gets an emerald ring plus a gentle pulse (reduced-motion-guarded in globals.css).
function Cell({ cell, today }: { cell: HeatmapCell; today: string }): React.JSX.Element {
  if (!cell.inRange) {
    return <span aria-hidden="true" className="h-3 w-3" />;
  }
  const isToday = cell.day === today;
  return (
    <span
      aria-hidden="true"
      title={cellTitle(cell, today)}
      className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASS[cell.level]}${
        isToday ? " ring-1 ring-emerald-300 animate-heat-today" : ""
      }`}
    />
  );
}
