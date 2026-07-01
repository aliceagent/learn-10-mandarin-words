"use client";

import Link from "next/link";
import { useState } from "react";
import type { Topic } from "@/lib/types";

const GOAL_OPTIONS = [
  { value: 5, label: "Casual", detail: "5 words / day" },
  { value: 10, label: "Steady", detail: "10 words / day" },
  { value: 20, label: "Serious", detail: "20 words / day" },
];

// ── First-run onboarding modal ────────────────────────────────────────────────
// Presentational only: the parent owns progress state and persists the choice.

export function OnboardingModal({
  firstTopic,
  onComplete,
  onSkip,
}: {
  firstTopic: Topic;
  onComplete: (dailyGoal: number) => void;
  onSkip: () => void;
}) {
  const [goal, setGoal] = useState(10);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="animate-celebrate w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-900 p-7 shadow-2xl">
        <p className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          Welcome 你好
        </p>
        <h2 id="onboarding-title" className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Learn 10 Mandarin words at a time
        </h2>
        <p className="mt-3 text-slate-300">
          Pick a daily goal and we&apos;ll point you to a starting lesson. Everything stays on
          your device — no account, no tracking.
        </p>

        <fieldset className="mt-6">
          <legend className="mb-3 text-sm font-semibold text-slate-300">Daily goal</legend>
          <div className="grid grid-cols-3 gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGoal(opt.value)}
                aria-pressed={goal === opt.value}
                className={`rounded-2xl border px-3 py-4 text-center transition ${
                  goal === opt.value
                    ? "border-emerald-300 bg-emerald-300/10"
                    : "border-white/10 hover:border-emerald-300/60"
                }`}
              >
                <span className="block text-sm font-semibold text-white">{opt.label}</span>
                <span className="mt-1 block text-xs text-slate-400">{opt.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start here</p>
          <p className="mt-1 font-semibold text-white">{firstTopic.titleEn}</p>
          <p className="font-hanzi text-emerald-300">{firstTopic.titleCn}</p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/topics/${firstTopic.slug}`}
            onClick={() => onComplete(goal)}
            className="flex-1 rounded-full bg-emerald-400 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Start first lesson →
          </Link>
          <button
            type="button"
            onClick={() => onComplete(goal)}
            className="flex-1 rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
          >
            Browse on my own
          </button>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full text-center text-sm text-slate-500 transition hover:text-slate-300"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ── Home "Continue learning / Start here" CTA ─────────────────────────────────

export function ContinueLearningCard({
  nextTopic,
  learnedCount,
  dailyGoal,
}: {
  nextTopic: Topic;
  learnedCount: number;
  dailyGoal: number;
}) {
  const started = learnedCount > 0;
  return (
    <section className="mx-auto max-w-7xl px-6 md:px-10">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-emerald-400/25 bg-emerald-400/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            {started ? "Continue learning" : "Start here"}
          </p>
          <p className="mt-1 truncate text-xl font-semibold text-white">{nextTopic.titleEn}</p>
          <p className="font-hanzi text-emerald-300">{nextTopic.titleCn}</p>
          <p className="mt-1 text-sm text-slate-400">
            {started
              ? `${learnedCount} list${learnedCount !== 1 ? "s" : ""} marked learned`
              : "A concrete, high-frequency list to begin with"}
            {dailyGoal > 0 ? ` · goal ${dailyGoal} words/day` : ""}
          </p>
        </div>
        <Link
          href={`/topics/${nextTopic.slug}`}
          className="shrink-0 rounded-full bg-emerald-400 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          {started ? "Resume →" : "Start first lesson →"}
        </Link>
      </div>
    </section>
  );
}
