import Link from "next/link";
import type { FlashcardStat, QuizStat, Topic } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { topicWordStatuses } from "@/lib/progress-logic";
import { hasPlayableVideo } from "@/lib/video";
import { normalizePinyin } from "@/lib/highlight";
import { HighlightedText } from "./highlighted-text";
import { MasteryDots, masteryCountsLabel } from "./mastery-dots";

// Shared topic card used by the home library grid and the per-category pages so
// both surfaces stay visually identical. Progress-derived flags are passed in by
// the caller (which owns the localStorage progress state). `query` is optional:
// when the home search passes it, matched text is highlighted; category pages
// omit it and the card renders plain.
export function TopicCard({
  topic,
  learned,
  favorite,
  flashcardStats,
  quizStats,
  query,
}: {
  topic: Topic;
  learned: boolean;
  favorite: boolean;
  flashcardStats: Record<string, FlashcardStat>;
  // Optional per-word quiz accuracy. When supplied (home + category grids) the
  // card shows mastery dots; callers that omit it (path page) render as before.
  quizStats?: Record<string, QuizStat>;
  query?: string;
}) {
  const studiedCount = topic.items.filter(
    (item) => (flashcardStats[wordKey(topic, item)]?.reviewCount ?? 0) > 0,
  ).length;

  const pct = (studiedCount / topic.items.length) * 100;
  // Derive the ten word statuses only when the caller opted into the dots by
  // passing quizStats; otherwise the card keeps its original studied bar.
  const statuses = quizStats ? topicWordStatuses(topic, flashcardStats, quizStats) : null;
  const videoReady = hasPlayableVideo(topic);

  // When the home search is active, surface the specific words that matched so
  // the learner can see (and scan) the highlighted hanzi, pinyin, and English
  // without opening the lesson. Matching mirrors the diacritic-tolerant home
  // search haystack. Capped to keep the card compact.
  const q = normalizePinyin((query ?? "").trim());
  const matchedItems = q
    ? topic.items
        .filter((item) => normalizePinyin(`${item.hanzi} ${item.pinyin} ${item.english}`).includes(q))
        .slice(0, 4)
    : [];

  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-white/[0.07]"
      aria-label={`${topic.titleEn} — ${topic.category}`}
    >
      {/* Row 1: category badge + status badges */}
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-400">
          <HighlightedText text={topic.category} query={query} />
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
            <HighlightedText text={topic.titleEn} query={query} />
          </h3>
          <p className="font-hanzi mt-1 text-2xl font-semibold text-emerald-300">
            <HighlightedText text={topic.titleCn} query={query} />
          </p>
        </div>
        <div
          className="font-hanzi shrink-0 select-none text-5xl font-bold leading-none text-white/15 transition group-hover:text-white/30"
          aria-hidden="true"
        >
          {topic.items[0]?.hanzi}
        </div>
      </div>

      {/* Row 3: mastery dots + studied count (when quizStats is supplied), else
          the original studied bar for callers that don't opt into the dots. */}
      {statuses ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">{studiedCount}/10 studied</span>
            {studiedCount === 10 ? (
              <span className="text-xs font-semibold text-emerald-400">Complete ✓</span>
            ) : null}
          </div>
          <MasteryDots statuses={statuses} size="sm" label={masteryCountsLabel(statuses)} />
        </div>
      ) : studiedCount > 0 ? (
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
            <HighlightedText text={item.hanzi} query={query} />
          </span>
        ))}
      </div>

      {/* Row 5: matched words (only while searching) — shows the exact hanzi,
          pinyin, and English that matched, with the query highlighted. */}
      {matchedItems.length > 0 ? (
        <div className="mt-3 space-y-1 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3">
          {matchedItems.map((item) => (
            <div key={item.hanzi} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="font-hanzi text-white">
                <HighlightedText text={item.hanzi} query={query} />
              </span>
              <span className="text-slate-400">
                <HighlightedText text={item.pinyin} query={query} />
              </span>
              <span className="text-slate-500">
                <HighlightedText text={item.english} query={query} />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-auto pt-4 text-sm font-semibold text-emerald-300 group-hover:underline">
        Open lesson →
      </p>
    </Link>
  );
}
