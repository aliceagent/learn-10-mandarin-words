"use client";

import { useEffect, useState } from "react";
import {
  formatBytes,
  isLessonSaved,
  removeLessonOffline,
  saveLessonOffline,
  savedLessonSize,
  supportsCacheStorage,
} from "@/lib/offline";
import { track } from "@/lib/analytics";
import { notifySavedLessonsChanged } from "./use-saved-lessons";

type Status = "idle" | "saving" | "saved" | "removing";

interface SaveOfflineButtonProps {
  /** Direct MP4 URL for the lesson. */
  source: string;
  /** Topic slug, used for analytics only. */
  slug: string;
  /** Same-origin lesson page URL to co-cache so the page renders offline. */
  pageUrl?: string;
  /** Compact card mode for lesson-grid toggles. */
  variant?: "panel" | "card";
}

// Explicit "save this lesson for offline" control shown next to downloadable MP4
// lessons. Renders nothing when the Cache API is unavailable, so it degrades to
// the existing stream-only behaviour on unsupported browsers.
export function SaveOfflineButton({ source, slug, pageUrl, variant = "panel" }: SaveOfflineButtonProps) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detect support and current saved state on mount only (browser-only APIs).
  // All state updates happen inside the async task so the effect body never
  // triggers a synchronous cascading render.
  useEffect(() => {
    if (!supportsCacheStorage()) return;
    let active = true;
    (async () => {
      try {
        const saved = await isLessonSaved(source);
        const bytes = saved ? await savedLessonSize(source) : null;
        if (!active) return;
        setSupported(true);
        if (saved) {
          setStatus("saved");
          setSize(bytes);
        }
      } catch {
        // Reading the cache failed — still reveal the control in its idle state.
        if (active) setSupported(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [source]);

  if (!supported) return null;

  async function onSave() {
    setError(null);
    setStatus("saving");
    try {
      await saveLessonOffline(source, { pageUrl });
      setStatus("saved");
      setSize(await savedLessonSize(source));
      notifySavedLessonsChanged();
      track("lesson_saved_offline", { topic: slug });
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Couldn't save this video offline.");
    }
  }

  async function onRemove() {
    setError(null);
    setStatus("removing");
    try {
      await removeLessonOffline(source);
      setStatus("idle");
      setSize(null);
      notifySavedLessonsChanged();
      track("lesson_removed_offline", { topic: slug });
    } catch {
      setStatus("saved");
      setError("Couldn't remove the saved video. Try again.");
    }
  }

  const saving = status === "saving";
  const removing = status === "removing";
  const saved = status === "saved";
  const compact = variant === "card";

  return (
    <div className="flex flex-col gap-1">
      <div className={compact ? "grid grid-cols-2 gap-2" : "flex items-center gap-2"}>
        {saved ? (
          <>
            <span className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-300 ${compact ? "w-full" : ""}`}>
              ✓ Offline{!compact && size ? ` · ${formatBytes(size)}` : ""}
            </span>
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              className={`inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-300 hover:text-rose-200 disabled:opacity-60 ${compact ? "w-full" : ""}`}
              aria-label="Remove the saved offline copy of this lesson"
            >
              {removing ? "Removing…" : compact ? "Delete" : "Remove"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            aria-busy={saving}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-emerald-200 disabled:opacity-60 ${compact ? "w-full col-span-2" : ""}`}
            aria-label="Save this lesson video for offline playback"
          >
            {saving ? "Saving…" : compact ? "⬇ Save offline" : "⬇ Save for offline"}
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs leading-5 text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
