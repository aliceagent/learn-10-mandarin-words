"use client";

import { useMemo } from "react";
import {
  buildForecast,
  forecastBarTitle,
  forecastSummaryLabel,
} from "@/lib/forecast-logic";
import type { FlashcardStat } from "@/lib/types";

// 7-day upcoming-due review forecast (Sprint 7). Purely presentational: it derives
// its bars from the persisted `flashcardStats` via buildForecast and renders them,
// with no state of its own. Because `flashcardStats` is live in review-app, grading
// a card visibly shifts its bar into a future day without a reload.
//
// A11y follows the StudyHeatmap precedent: the chart is one labelled `role="img"`
// with a full summary sentence, and every bar is `aria-hidden` (with a native
// `title` tooltip), so a screen reader hears "Review forecast: 4 cards due today…"
// instead of seven anonymous bars.

// Bar-track height in px. Bars fill a percentage of this against model.max; a
// zero-count day shows a 2px baseline stub instead so the column never vanishes.
const TRACK_HEIGHT = 72;

export function ReviewForecast({
  flashcardStats,
}: {
  flashcardStats: Record<string, FlashcardStat>;
}): React.JSX.Element {
  // `now` is intentionally read once per render via new Date(); the memo keys on
  // flashcardStats so grading (which replaces the stats object) re-buckets.
  const model = useMemo(() => buildForecast(flashcardStats), [flashcardStats]);

  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Upcoming reviews
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Cards coming due over the next 7 days. Overdue cards count toward today.
      </p>

      <div
        role="img"
        aria-label={forecastSummaryLabel(model)}
        className="mt-6 flex items-end justify-between gap-2"
      >
        {model.days.map((day) => {
          // Height as a percentage of the busiest day; a zero day (or an all-zero
          // window, where max is 0) falls back to the 2px baseline stub.
          const pct = model.max > 0 ? Math.round((day.count / model.max) * 100) : 0;
          const barHeight = day.count > 0 ? `${Math.max(pct, 6)}%` : "2px";
          const fill = day.isToday ? "bg-emerald-400" : "bg-emerald-400/45";
          return (
            <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
              <span
                aria-hidden="true"
                className={`text-xs font-semibold tabular-nums ${
                  day.count > 0 ? "text-slate-200" : "text-slate-600"
                }`}
              >
                {day.count}
              </span>
              <div
                aria-hidden="true"
                className="flex w-full items-end justify-center"
                style={{ height: TRACK_HEIGHT }}
              >
                <div
                  title={forecastBarTitle(day)}
                  style={{ height: barHeight }}
                  className={`w-full max-w-8 rounded-t-md ${
                    day.count > 0 ? fill : "bg-white/[0.06]"
                  }`}
                />
              </div>
              <span
                aria-hidden="true"
                className={`text-[11px] ${
                  day.isToday ? "font-semibold text-emerald-200" : "text-slate-500"
                }`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>

      {model.total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nothing due this week — nice pacing.</p>
      ) : null}
    </section>
  );
}
