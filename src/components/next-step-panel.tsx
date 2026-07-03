"use client";

import Link from "next/link";
import type { Topic } from "@/lib/types";

// Shown once a learner finishes a topic (marked learned) or completes its quiz.
// It gathers clear onward actions from existing routes/helpers — continue to the
// next recommended topic, clear any due reviews, save the list, or step back to
// the guided path — so there's always an obvious next move. It holds no state of
// its own: the parent supplies the resolved next topic, due count, and save
// toggle, all derived from the same progress + data helpers used elsewhere.
export function NextStepPanel({
  nextTopic,
  dueReviews,
  isFavoriteTopic,
  onToggleFavorite,
}: {
  nextTopic: Topic | null;
  dueReviews: number;
  isFavoriteTopic: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <section
      className="mt-8 rounded-[2rem] border border-emerald-400/25 bg-surface-accent p-6 md:p-8"
      aria-label="What's next"
    >
      <h2 className="text-xl font-semibold text-white">Nice work — what&apos;s next?</h2>
      <p className="mt-1 text-sm text-slate-300">
        Keep the momentum going with one of these.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {/* Continue to the next recommended topic (omitted only when none remain). */}
        {nextTopic ? (
          <Link
            href={`/topics/${nextTopic.slug}`}
            className="group flex min-h-[44px] flex-col justify-center rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-950/70">
              Continue
            </span>
            <span className="mt-0.5">
              {nextTopic.titleEn}
              <span className="font-hanzi ml-2 text-emerald-950/70">{nextTopic.titleCn}</span>
            </span>
          </Link>
        ) : null}

        {/* Review due words — only when the spaced-repetition queue has some. */}
        {dueReviews > 0 ? (
          <Link
            href="/review"
            className="group flex min-h-[44px] flex-col justify-center rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-emerald-300"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Review
            </span>
            <span className="mt-0.5">
              {dueReviews} due word{dueReviews !== 1 ? "s" : ""}
            </span>
          </Link>
        ) : null}

        {/* Save / saved indicator for the whole topic. */}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavoriteTopic}
          className="group flex min-h-[44px] flex-col justify-center rounded-2xl border border-white/15 px-5 py-3 text-left font-semibold text-white transition hover:border-amber-300"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {isFavoriteTopic ? "Saved" : "Save"}
          </span>
          <span className="mt-0.5">
            {isFavoriteTopic ? "In your saved lists ★" : "Save this list"}
          </span>
        </button>

        {/* Back to the guided learning path. */}
        <Link
          href="/path"
          className="group flex min-h-[44px] flex-col justify-center rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-emerald-300"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Learning path
          </span>
          <span className="mt-0.5">Back to the path</span>
        </Link>
      </div>
    </section>
  );
}
