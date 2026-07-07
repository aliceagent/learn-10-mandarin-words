"use client";

import Link from "next/link";
import type { ResumeTarget } from "@/lib/resume-logic";

// Home "Resume where you left off" card (schema v12): a single prominent
// deep-link straight back into the last (topic, mode, quiz sub-mode) the learner
// touched. Purely presentational — the parent resolves the target and hands it
// down. Renders nothing when there is no resumable activity (first-time visitors
// and dropped slugs), so the existing Start-here flow stays untouched.
export function ResumeCard({
  target,
  onResume,
}: {
  target: ResumeTarget | null;
  onResume?: (slug: string) => void;
}) {
  if (!target) return null;

  return (
    <section className="mx-auto mt-8 max-w-7xl px-6 md:px-10">
      <Link
        href={target.href}
        onClick={() => onResume?.(target.slug)}
        aria-label={`Resume ${target.topicTitleEn} — ${target.modeLabel}`}
        className="group flex items-center justify-between gap-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 transition hover:border-emerald-300/50 hover:bg-emerald-500/15 md:px-6"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Pick up where you left off
          </p>
          <p className="mt-1 truncate font-semibold text-white">Resume: {target.topicTitleEn}</p>
          <p className="mt-0.5 truncate text-sm text-slate-300">
            {target.modeLabel} · <span className="font-hanzi">{target.topicTitleCn}</span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition group-hover:bg-cta">
          Resume →
        </span>
      </Link>
    </section>
  );
}
