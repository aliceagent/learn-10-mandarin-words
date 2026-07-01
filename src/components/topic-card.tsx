import Link from "next/link";
import type { Topic } from "@/lib/types";
import { hasPlayableVideo } from "@/lib/video";

// Shared topic card used by the home library grid and the per-category pages so
// both surfaces stay visually identical. Progress-derived flags are passed in by
// the caller (which owns the localStorage progress state).
export function TopicCard({
  topic,
  learned,
  favorite,
  flashcardStats,
}: {
  topic: Topic;
  learned: boolean;
  favorite: boolean;
  flashcardStats: Record<string, { reviewCount: number }>;
}) {
  const studiedCount = topic.items.filter((item) => {
    const key = `${topic.slug}:${item.hanzi}`;
    return (flashcardStats[key]?.reviewCount ?? 0) > 0;
  }).length;

  const pct = (studiedCount / topic.items.length) * 100;
  const videoReady = hasPlayableVideo(topic);

  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-white/[0.07]"
      aria-label={`${topic.titleEn} — ${topic.category}`}
    >
      {/* Row 1: category badge + status badges */}
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-400">
          {topic.category}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5 text-xs font-bold">
          {videoReady ? (
            <span
              className="rounded-full bg-sky-300/90 px-2.5 py-1 text-slate-950"
              title="Video available"
            >
              ▶ Video
            </span>
          ) : (
            <span
              className="rounded-full border border-white/15 px-2.5 py-1 font-semibold text-slate-400"
              title="Video coming soon"
            >
              Video soon
            </span>
          )}
          {favorite ? (
            <span className="rounded-full bg-amber-300/90 px-2.5 py-1 text-slate-950">Saved</span>
          ) : null}
          {learned ? (
            <span className="rounded-full bg-emerald-300/90 px-2.5 py-1 text-slate-950">Learned</span>
          ) : null}
        </div>
      </div>

      {/* Row 2: title + featured hanzi */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight text-white transition group-hover:text-emerald-50">
            {topic.titleEn}
          </h3>
          <p className="font-hanzi mt-1 text-2xl font-semibold text-emerald-300">{topic.titleCn}</p>
        </div>
        <div
          className="font-hanzi shrink-0 select-none text-5xl font-bold leading-none text-white/15 transition group-hover:text-white/30"
          aria-hidden="true"
        >
          {topic.items[0]?.hanzi}
        </div>
      </div>

      {/* Row 3: progress bar (only if any studied) */}
      {studiedCount > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">{studiedCount}/10 studied</span>
            {studiedCount === 10 ? (
              <span className="text-xs font-semibold text-emerald-400">Complete ✓</span>
            ) : null}
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {/* Row 4: hanzi word chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {topic.items.slice(0, 5).map((item) => (
          <span
            key={item.hanzi}
            className="font-hanzi rounded-full bg-slate-900 px-2.5 py-1 text-sm text-slate-300"
          >
            {item.hanzi}
          </span>
        ))}
      </div>

      <p className="mt-auto pt-4 text-sm font-semibold text-emerald-300 group-hover:underline">
        Open lesson →
      </p>
    </Link>
  );
}
