"use client";

import { GOAL_OPTIONS } from "./onboarding";

// The daily-goal control: the three preset chips (Casual/Steady/Serious, reusing
// the exact GOAL_OPTIONS from onboarding) plus a 1–100 custom number input. Both
// call `onChange`, which the parent wires to setDailyGoal from useProgress. Split
// out of the /stats GoalCard so the same editor renders on /settings with
// identical markup and classes — /stats stays visually unchanged.
export function GoalEditor({
  current,
  onChange,
}: {
  current: number; // progress.onboarding.dailyGoal (0 = unset)
  onChange: (goal: number) => void; // setDailyGoal from useProgress
}) {
  return (
    <div>
      <p id="daily-goal-label" className="mb-2 text-sm font-semibold text-slate-300">
        Daily goal
      </p>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-labelledby="daily-goal-label"
      >
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={current === opt.value}
            className={`min-h-[44px] rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
              current === opt.value
                ? "border-emerald-300 bg-emerald-300/10 text-white"
                : "border-white/10 text-slate-300 hover:border-emerald-300/60"
            }`}
          >
            {opt.label} {opt.value}
          </button>
        ))}
        <label className="flex min-h-[44px] items-center gap-2 text-xs text-slate-400">
          Custom
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={current > 0 ? current : ""}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n) && n >= 1 && n <= 100) onChange(n);
            }}
            aria-label="Custom daily goal, 1 to 100 words"
            className="w-16 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300"
          />
        </label>
      </div>
    </div>
  );
}
