"use client";

import Link from "next/link";
import type { FlashcardStat, QuizStat, TopicSummary } from "@/lib/types";
import { wordKey } from "@/lib/data-logic";
import { topicWordStatuses } from "@/lib/progress-logic";
import {
  lessonCardFavoriteAction,
  lessonCardMeta,
  topicCardPreviewItems,
  type LessonCardStatus,
} from "@/lib/lesson-card-logic";
import { downloadableMp4Url, hasPlayableVideo } from "@/lib/video";
import { normalizePinyin } from "@/lib/highlight";
import { HighlightedText } from "./highlighted-text";
import { MasteryDots, masteryCountsLabel } from "./mastery-dots";
import { SaveOfflineButton } from "./save-offline-button";

// Shared topic card used by the home library grid and the per-category pages so
// both surfaces stay visually identical. Progress-derived flags are passed in by
// the caller (which owns the localStorage progress state). `query` is optional:
// when the home search passes it, matched text is highlighted; category pages
// omit it and the card renders plain.
export function TopicCard({
  topic,
  learned,
  favorite,
  crowned,
  savedOffline,
  flashcardStats,
  quizStats,
  status,
  query,
  onToggleFavorite,
}: {
  topic: TopicSummary;
  learned: boolean;
  favorite: boolean;
  // Whether this topic has been crowned via a flawless Boss Round (schema v7).
  crowned?: boolean;
  // Optional consolidated status (Sprint 5). When supplied, a single status chip
  // replaces the separate Crowned/Learned chips so the card never double-badges;
  // callers that omit it keep the original crowned/learned chips.
  status?: LessonCardStatus;
  // Whether this topic's video is saved in the offline cache. Browser-only, so it
  // stays false during SSR/first paint and the chip pops in after mount.
  savedOffline?: boolean;
  flashcardStats: Record<string, FlashcardStat>;
  // Optional per-word quiz accuracy. When supplied (home + category grids) the
  // card shows mastery dots; callers that omit it (path page) render as before.
  quizStats?: Record<string, QuizStat>;
  query?: string;
  onToggleFavorite?: () => void;
}) {
  const studiedCount = topic.items.filter(
    (item) => (flashcardStats[wordKey(topic, item)]?.reviewCount ?? 0) > 0,
  ).length;

  const pct = (studiedCount / topic.items.length) * 100;
  // Derive the ten word statuses only when the caller opted into the dots by
  // passing quizStats; otherwise the card keeps its original studied bar.
  const statuses = quizStats ? topicWordStatuses(topic, flashcardStats, quizStats) : null;
  const videoReady = hasPlayableVideo(topic);
  const offlineSource = downloadableMp4Url(topic);
  const favoriteAction = lessonCardFavoriteAction(favorite);
  const mobilePreview = topicCardPreviewItems(topic, 3);
  const desktopPreview = topicCardPreviewItems(topic, 5);

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
    <article
      className="flex min-h-[44px] flex-col rounded-2xl border border-white/10 bg-surface p-4 transition hover:-translate-y-1 hover:bg-surface-hover md:rounded-3xl md:p-5"
      aria-label={`${topic.titleEn} - ${topic.category}`}
    >
      <Link href={`/topics/${topic.slug}`} className="group flex flex-1 flex-col">
      {/* Row 1: category badge + status badges */}
      <div className="flex items-center justify-between gap-2">
        <span className="max-w-[58%] truncate rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-400 md:max-w-none md:text-xs">
          <HighlightedText text={topic.category} query={query} />
        </span>
        {/* Keep at most one loud/filled badge (Learned). Video and Saved read as
            quiet neutral chips; the low-value "Video soon" state is omitted. */}
        <div className="flex flex-wrap justify-end gap-1.5 text-xs">
          {videoReady ? (
            <span
              className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-medium text-slate-400 md:inline-flex"
              title="Video available"
            >
              ▶ Video
            </span>
          ) : null}
          {savedOffline ? (
            <span
              className="hidden rounded-full border border-white/10 px-2.5 py-1 font-medium text-slate-400 md:inline-flex"
              title="Video saved - plays without internet"
            >
              ✓ Offline
            </span>
          ) : null}
          {favorite ? (
            <span
              className="hidden rounded-full border border-white/10 px-2.5 py-1 font-medium text-slate-400 md:inline-flex"
              title="Saved"
            >
              ★ Saved
            </span>
          ) : null}
          {/* When the caller supplies a consolidated status, render exactly one
              status chip (achievement states only — "started"/"new" are already
              conveyed by the studied bar below). Otherwise fall back to the
              original separate Crowned/Learned chips. */}
          {status ? (
            <StatusChip status={status} />
          ) : (
            <>
              {crowned ? (
                <span
                  className="rounded-full border border-amber-300/30 px-2.5 py-1 font-medium text-amber-200/90"
                  title="Crowned - a flawless Boss Round"
                >
                  👑 Crowned
                </span>
              ) : null}
              {learned ? (
                <span className="rounded-full bg-cta/90 px-2.5 py-1 font-semibold text-slate-950">Learned</span>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Row 2: title + featured hanzi */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-white transition group-hover:text-emerald-50 md:text-lg">
            <HighlightedText text={topic.titleEn} query={query} />
          </h3>
          <p className="font-hanzi mt-1 text-xl font-semibold text-emerald-300 md:text-2xl">
            <HighlightedText text={topic.titleCn} query={query} />
          </p>
        </div>
        {/* Quiet watermark hanzi. Hidden below ~380px so it never collides with
            the title on very narrow screens. */}
        <div
          className="font-hanzi hidden shrink-0 select-none text-4xl font-bold leading-none text-white/10 transition group-hover:text-white/20 min-[380px]:block md:text-5xl"
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
              <span className="text-xs font-semibold text-accent">Complete ✓</span>
            ) : null}
          </div>
          <MasteryDots statuses={statuses} size="sm" label={masteryCountsLabel(statuses)} />
        </div>
      ) : studiedCount > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">{studiedCount}/10 studied</span>
            {studiedCount === 10 ? (
              <span className="text-xs font-semibold text-accent">Complete ✓</span>
            ) : null}
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {/* Row 4: hanzi word chips */}
      <div className="mt-3 flex flex-wrap gap-1.5 md:hidden">
        {mobilePreview.items.map((item) => (
          <span
            key={item.hanzi}
            className="font-hanzi rounded-full bg-white/[0.04] px-2.5 py-1 text-sm text-slate-400"
          >
            <HighlightedText text={item.hanzi} query={query} />
          </span>
        ))}
        {mobilePreview.remaining > 0 ? (
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-500">
            +{mobilePreview.remaining} more
          </span>
        ) : null}
      </div>
      <div className="mt-3 hidden flex-wrap gap-1.5 md:flex">
        {desktopPreview.items.map((item) => (
          <span
            key={item.hanzi}
            className="font-hanzi rounded-full bg-white/[0.04] px-2.5 py-1 text-sm text-slate-400"
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

      {/* Static "what's in this lesson" line (Sprint 5): word count · video? ·
          quiz — reads the same for every learner so a teacher can size up a
          lesson at a glance. */}
      <p className="mt-3 text-xs text-slate-500">{lessonCardMeta(topic)}</p>

      <p className="mt-auto pt-3 text-sm font-semibold text-slate-400 transition group-hover:text-emerald-300 md:pt-4">
        Open lesson →
      </p>
      </Link>

      <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favoriteAction.ariaLabel}
          aria-pressed={favorite}
          title={favoriteAction.title}
          className={`inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
            favorite
              ? "border-amber-300/30 bg-amber-300/15 text-amber-200 hover:border-amber-200/50"
              : "border-white/15 text-slate-300 hover:border-amber-300/50 hover:text-amber-200"
          }`}
        >
          <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
          {favoriteAction.label}
        </button>

      {offlineSource ? (
        <div>
          <SaveOfflineButton
            source={offlineSource}
            slug={topic.slug}
            pageUrl={`/topics/${topic.slug}`}
            variant="card"
          />
        </div>
      ) : null}
      </div>
    </article>
  );
}

// One consolidated status chip (Sprint 5). Only the achievement states get a
// chip — "started" and "new" are already communicated by the studied bar, so
// surfacing them here would just repeat "3/10 studied" or add "Not started"
// noise to every fresh card. The label carries the meaning as text (a11y);
// color/emoji only reinforce it.
function StatusChip({ status }: { status: LessonCardStatus }) {
  switch (status.kind) {
    case "crowned":
      return (
        <span
          className="rounded-full border border-amber-300/30 px-2.5 py-1 font-medium text-amber-200/90"
          title="Crowned - a flawless Boss Round"
        >
          {status.label}
        </span>
      );
    case "learned":
      return (
        <span className="rounded-full bg-cta/90 px-2.5 py-1 font-semibold text-slate-950">
          {status.label}
        </span>
      );
    case "mastered":
      return (
        <span
          className="rounded-full border border-emerald-300/30 px-2.5 py-1 font-medium text-emerald-200/90"
          title="Most words past the review threshold"
        >
          {status.label}
        </span>
      );
    default:
      return null;
  }
}
