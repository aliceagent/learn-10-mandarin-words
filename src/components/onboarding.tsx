"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/types";
import type { OnboardingNext } from "@/lib/onboarding-next-logic";

// The home CTAs only render a topic's slug + titles, so accept any object with
// those fields. This keeps the slimmed `TopicSummary` (see toTopicSummary)
// assignable without dragging the full item/sentence payload into these props.
type TopicCta = Pick<Topic, "slug" | "titleEn" | "titleCn">;

// Shared daily-goal presets. Exported so the stats-page goal editor reuses the
// exact same options and copy as first-run onboarding.
export const GOAL_OPTIONS = [
  { value: 5, label: "Casual", detail: "5 words / day" },
  { value: 10, label: "Steady", detail: "10 words / day" },
  { value: 20, label: "Serious", detail: "20 words / day" },
];

// Elements that can receive keyboard focus inside the modal.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ── First-run onboarding modal ────────────────────────────────────────────────
// Presentational only: the parent owns progress state and persists the choice.

export function OnboardingModal({
  next,
  onComplete,
  onSkip,
}: {
  // What the modal should offer after the goal step — a starter "pick" for
  // first-run visitors, or a one-tap "resume" for returning ones (Sprint 6).
  // The parent computes this from the live dataset + persisted progress.
  next: OnboardingNext;
  onComplete: (dailyGoal: number) => void;
  onSkip: () => void;
}) {
  const [goal, setGoal] = useState(10);
  // A returning visitor with a resolvable last activity skips the picker
  // entirely (a "Welcome back · Resume" screen); everyone else steps from the
  // goal picker to the first-lesson picker.
  const returning = next.kind === "resume";
  const [step, setStep] = useState<"goal" | "lesson">("goal");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // On open: remember the trigger. On close (any path — skip, complete, or
  // navigate away), restore focus to it. Split from the focus-move effect so
  // stepping between goal → lesson never bounces focus back to the trigger.
  useEffect(() => {
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    return () => {
      // The trigger may have unmounted (e.g. after navigation); guard the call.
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Move focus to the first focusable whenever the step changes, so the newly
  // revealed controls (goal buttons, then lesson choices) are keyboard-reachable.
  useEffect(() => {
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();
  }, [step]);

  // Escape closes the modal; Tab / Shift+Tab are trapped within it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onSkip]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-desc"
      ref={dialogRef}
    >
      <div className="animate-celebrate w-full max-w-lg rounded-3xl border border-white/10 bg-surface p-7 shadow-2xl">
        {returning ? (
          // ── Returning visitor: skip the picker, offer a one-tap resume. ──
          <>
            <p className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              Welcome back 你好
            </p>
            <h2 id="onboarding-title" className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Welcome back
            </h2>
            <p id="onboarding-desc" className="mt-3 text-slate-300">
              Pick up right where you left off. Everything stays on your device — no account, no
              tracking.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={next.href}
                onClick={() => onComplete(goal)}
                className="rounded-full bg-emerald-400 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cta"
              >
                {next.label} →
              </Link>
              <button
                type="button"
                onClick={onSkip}
                className="w-full text-center text-sm text-slate-500 transition hover:text-slate-300"
              >
                Skip for now
              </button>
            </div>
          </>
        ) : step === "goal" ? (
          // ── Step 1: pick a daily goal. ──
          <>
            <p className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              Welcome 你好
            </p>
            <h2 id="onboarding-title" className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Learn 10 Mandarin words at a time
            </h2>
            <p id="onboarding-desc" className="mt-3 text-slate-300">
              Pick a daily goal, then choose your first lesson. Everything stays on your device —
              no account, no tracking.
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

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep("lesson")}
                className="flex-1 rounded-full bg-emerald-400 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cta"
              >
                Next: pick a lesson →
              </button>
              <button
                type="button"
                onClick={() => onComplete(goal)}
                className="flex-1 rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
              >
                Browse all lessons
              </button>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="mt-4 w-full text-center text-sm text-slate-500 transition hover:text-slate-300"
            >
              Skip for now
            </button>
          </>
        ) : (
          // ── Step 2: pick a first lesson from a short starter set. ──
          <>
            <p className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              Goal · {goal} words / day
            </p>
            <h2 id="onboarding-title" className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Pick your first lesson
            </h2>
            <p id="onboarding-desc" className="mt-3 text-slate-300">
              Ten words, one short video, then a quick quiz. You can switch anytime.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {next.lessons.map((lesson) => (
                <Link
                  key={lesson.slug}
                  href={lesson.href}
                  onClick={() => onComplete(goal)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface px-4 py-3 text-left transition hover:border-emerald-300/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-white">{lesson.titleEn}</span>
                    <span className="font-hanzi text-emerald-300">{lesson.titleCn}</span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-slate-500">→</span>
                </Link>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onComplete(goal)}
                className="flex-1 rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
              >
                Browse all lessons
              </button>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="mt-4 w-full text-center text-sm text-slate-500 transition hover:text-slate-300"
            >
              Skip for now
            </button>
          </>
        )}
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
  nextTopic: TopicCta;
  learnedCount: number;
  dailyGoal: number;
}) {
  const started = learnedCount > 0;
  return (
    <section className="mx-auto max-w-7xl px-6 md:px-10">
      <div className="flex flex-col gap-4 rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between">
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
          className="shrink-0 rounded-full bg-emerald-400 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cta"
        >
          {started ? "Resume →" : "Start first lesson →"}
        </Link>
      </div>
    </section>
  );
}
