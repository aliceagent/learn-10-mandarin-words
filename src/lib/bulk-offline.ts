// Page-context helpers for saving a whole category's lesson MP4s in one action.
//
// Built on top of src/lib/offline.ts — this module only sequences saves and
// reports progress; the actual fetch-and-cache lives in `saveLessonOffline`.
// Everything is browser-side and strictly user-initiated (see the bulk button in
// save-category-offline-button.tsx); nothing here runs on its own.
//
// Design notes:
//   - Downloads run ONE AT A TIME so a metered/limited connection isn't hammered
//     and progress is honest (each item finishes before the next begins).
//   - After 2 consecutive failures the run stops early: both a full storage quota
//     and a lost connection make every remaining download futile, and each failed
//     attempt still pulls a full MP4 over the wire. Error-message introspection is
//     too brittle across browsers, so a consecutive-failure cutoff covers both.
//   - `saveLessonOffline` is injectable (mirroring OfflineDeps) so the runner is
//     unit-testable with fakes — see tests/bulk-offline.test.mjs.

import type { Topic } from "./types";
import { downloadableMp4Url } from "./video.ts";
import { saveLessonOffline, type SaveOptions } from "./offline.ts";

/** One video to download: its MP4 URL, owning topic slug, and same-origin lesson
 *  page URL to co-cache so the lesson renders offline. */
export type BulkSaveItem = { url: string; slug: string; pageUrl: string };

/**
 * The videos in a category that still need downloading: topics with a
 * downloadable MP4 whose URL isn't already in the saved set. YouTube and
 * placeholder topics (no `downloadableMp4Url`) are skipped. Accepts full `Topic`
 * or the lighter `TopicSummary` shape — only slug + video fields are read.
 */
export function categoryOfflinePlan(
  topics: Pick<Topic, "slug" | "videoPath" | "video">[],
  saved: ReadonlySet<string>,
): BulkSaveItem[] {
  const items: BulkSaveItem[] = [];
  for (const topic of topics) {
    const url = downloadableMp4Url(topic);
    if (!url) continue; // YouTube / placeholder — nothing to download
    if (saved.has(url)) continue; // already saved — never re-download
    items.push({ url, slug: topic.slug, pageUrl: `/topics/${topic.slug}` });
  }
  return items;
}

export type BulkSaveProgress = { done: number; total: number; current: BulkSaveItem };

export type BulkSaveResult = {
  saved: number;
  failed: { item: BulkSaveItem; message: string }[];
  /** Items never attempted because the run stopped early (cancel or 2 consecutive
   *  failures). */
  skipped: number;
  cancelled: boolean;
};

/** Stop the run after this many failures in a row (see module notes). */
const CONSECUTIVE_FAILURE_LIMIT = 2;

export type BulkSaveOptions = SaveOptions & {
  /** Fired just before each item's download begins, so the UI can show a counter.
   *  `done` is the number already completed (0-based index of `current`). */
  onProgress?: (p: BulkSaveProgress) => void;
  /** Called before each item; returning true stops the run with `cancelled: true`.
   *  Already-saved items keep their downloads. */
  shouldCancel?: () => boolean;
  /** Injectable for tests; defaults to the real `saveLessonOffline`. */
  saveOne?: (source: string, options: SaveOptions) => Promise<void>;
};

/**
 * Download each item's MP4 sequentially. Reports progress before every attempt,
 * collects per-item failures, honours `shouldCancel` between items, and stops
 * early after 2 consecutive failures (counting the untouched remainder as
 * `skipped`). Never throws — a run that fully fails still resolves with a result.
 */
export async function saveLessonsOffline(
  items: BulkSaveItem[],
  options: BulkSaveOptions = {},
): Promise<BulkSaveResult> {
  const { onProgress, shouldCancel, saveOne, ...saveDeps } = options;
  const save = saveOne ?? saveLessonOffline;

  const failed: BulkSaveResult["failed"] = [];
  let saved = 0;
  let consecutiveFailures = 0;

  for (let i = 0; i < items.length; i++) {
    if (shouldCancel?.()) {
      return { saved, failed, skipped: items.length - i, cancelled: true };
    }

    const item = items[i];
    onProgress?.({ done: i, total: items.length, current: item });

    try {
      await save(item.url, { ...saveDeps, pageUrl: item.pageUrl });
      saved++;
      consecutiveFailures = 0;
    } catch (err) {
      failed.push({
        item,
        message: err instanceof Error ? err.message : "Couldn't save this video offline.",
      });
      consecutiveFailures++;
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
        // Give up on the rest — remaining downloads are almost certainly futile.
        return { saved, failed, skipped: items.length - (i + 1), cancelled: false };
      }
    }
  }

  return { saved, failed, skipped: 0, cancelled: false };
}
