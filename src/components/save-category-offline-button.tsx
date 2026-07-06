"use client";

import { useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/types";
import { supportsCacheStorage } from "@/lib/offline";
import { categoryOfflinePlan, saveLessonsOffline, type BulkSaveProgress } from "@/lib/bulk-offline";
import { track } from "@/lib/analytics";
import { notifySavedLessonsChanged, useSavedLessons } from "./use-saved-lessons";
import { useOnlineStatus } from "./use-online-status";

interface SaveCategoryOfflineButtonProps {
  categorySlug: string;
  categoryName: string;
  topics: Topic[];
}

// One-tap "download every video in this category for offline playback". Sits on
// the category page below the mastery chip. Sequential downloads with live
// progress, cancel, and honest per-run failure reporting — everything is
// page-context and user-initiated, so the service worker's never-auto-cache
// policy is untouched. Renders nothing where Cache Storage is unavailable or the
// category has no downloadable MP4s (e.g. useful-phrases).
export function SaveCategoryOfflineButton({
  categorySlug,
  categoryName,
  topics,
}: SaveCategoryOfflineButtonProps) {
  const [supported, setSupported] = useState(false);
  const [progress, setProgress] = useState<BulkSaveProgress | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const online = useOnlineStatus();
  const saved = useSavedLessons();
  // Set true to stop the run between items (Cancel button).
  const cancelRef = useRef(false);

  // Cache Storage is browser-only; detect on mount so the control degrades to
  // nothing on unsupported browsers without a hydration mismatch. The update runs
  // off a microtask (mirroring save-offline-button.tsx) so the effect body never
  // triggers a synchronous cascading render.
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active && supportsCacheStorage()) setSupported(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Total downloadable videos in this category, and the ones still to save.
  const total = categoryOfflinePlan(topics, new Set()).length;
  const remaining = categoryOfflinePlan(topics, saved);
  const saving = progress !== null;

  // No downloadable MP4s at all — nothing this control could ever do.
  if (!supported || total === 0) return null;

  async function onSave() {
    setFailedCount(0);
    cancelRef.current = false;
    const items = categoryOfflinePlan(topics, saved);
    if (items.length === 0) return;

    // Show the first item's progress immediately, then let the runner drive it.
    setProgress({ done: 0, total: items.length, current: items[0] });
    const result = await saveLessonsOffline(items, {
      onProgress: (p) => {
        setProgress(p);
        // Items already completed light up their card badges live. `done` counts
        // finished items, so this fires once each earlier save lands.
        if (p.done > 0) notifySavedLessonsChanged();
      },
      shouldCancel: () => cancelRef.current,
    });

    // Final broadcast covers the last saved item (onProgress fires before items,
    // never after the last one).
    notifySavedLessonsChanged();
    setProgress(null);
    setFailedCount(result.failed.length);
    track("category_saved_offline", {
      category: categorySlug,
      saved: result.saved,
      failed: result.failed.length,
      cancelled: result.cancelled,
    });
  }

  function onCancel() {
    cancelRef.current = true;
  }

  // ── Saving ──────────────────────────────────────────────────────────────
  if (saving && progress) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex min-h-[36px] items-center rounded-full border border-emerald-300/30 bg-emerald-300/[0.08] px-4 py-1.5 text-sm font-semibold text-emerald-200">
            Saving {progress.done + 1} of {progress.total}…
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[36px] items-center rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-rose-300 hover:text-rose-200"
            aria-label="Cancel saving videos"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── All saved ───────────────────────────────────────────────────────────
  if (remaining.length === 0) {
    return (
      <div className="mt-4">
        <span className="inline-flex min-h-[36px] items-center rounded-full bg-emerald-400/15 px-4 py-1.5 text-sm font-bold text-emerald-300">
          ✓ All {total} video{total !== 1 ? "s" : ""} saved offline
        </span>
      </div>
    );
  }

  // ── Idle (with any prior failure) ─────────────────────────────────────────
  const n = remaining.length;
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onSave}
        disabled={!online}
        className="inline-flex min-h-[36px] w-fit items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-emerald-200 disabled:opacity-60"
        aria-label={`Save ${n} ${categoryName} video${n !== 1 ? "s" : ""} for offline playback`}
      >
        ⬇ Save {n} video{n !== 1 ? "s" : ""} offline
      </button>
      {online ? (
        <p className="text-xs leading-5 text-slate-500">
          Videos download now and play without internet later.
        </p>
      ) : (
        <p className="text-xs leading-5 text-slate-500">
          You&apos;re offline — reconnect to download videos.
        </p>
      )}
      {failedCount > 0 ? (
        <p role="alert" className="text-xs leading-5 text-rose-300">
          {failedCount} video{failedCount !== 1 ? "s" : ""} didn&apos;t save. Check your connection and
          storage, then try again.
        </p>
      ) : null}
    </div>
  );
}
