"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { savedOfflineLessonRows, type SavedOfflineLessonRow } from "@/lib/offline-library-logic";
import {
  formatBytes,
  listSavedLessons,
  removeLessonOffline,
  savedLessonSize,
  supportsCacheStorage,
} from "@/lib/offline";
import { notifySavedLessonsChanged } from "./use-saved-lessons";

// Read every saved lesson and resolve its title + size. Pure data access, no
// React state - the caller decides what to do with the rows.
async function loadSavedRows(): Promise<SavedOfflineLessonRow[]> {
  const urls = await listSavedLessons();
  const sizes = new Map(
    await Promise.all(urls.map(async (url) => [url, await savedLessonSize(url)] as const)),
  );
  return savedOfflineLessonRows(data.topics, new Set(urls), sizes);
}

// Lists lessons the learner has explicitly saved for offline playback and lets
// them free the space again. Rendered on /offline; hidden when the Cache API is
// unavailable or nothing is saved.
export function SavedLessonsPanel() {
  const [ready, setReady] = useState(false);
  const [lessons, setLessons] = useState<SavedOfflineLessonRow[]>([]);

  useEffect(() => {
    if (!supportsCacheStorage()) return;
    let active = true;
    (async () => {
      let rows: SavedOfflineLessonRow[] = [];
      try {
        rows = await loadSavedRows();
      } catch {
        rows = [];
      }
      if (active) {
        setLessons(rows);
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onRemove(url: string) {
    try {
      await removeLessonOffline(url);
      notifySavedLessonsChanged();
    } finally {
      try {
        setLessons(await loadSavedRows());
      } catch {
        setLessons([]);
      }
    }
  }

  if (!ready || lessons.length === 0) return null;

  const totalBytes = lessons.reduce((sum, l) => sum + (l.size ?? 0), 0);

  return (
    <section className="mt-10 w-full max-w-md rounded-3xl border border-white/10 bg-surface p-5 text-left md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Offline saved lessons</h2>
          <p className="mt-1 text-sm text-slate-400">
            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""} ready without internet{totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.url} className="rounded-2xl border border-white/10 bg-surface-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{lesson.title}</p>
              <p className="mt-1 text-xs text-slate-400">
                {lesson.size ? formatBytes(lesson.size) : "Saved offline"}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {lesson.href ? (
                <Link
                  href={lesson.href}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cta"
                >
                  Open lesson
                </Link>
              ) : (
                <span className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-600">
                  No lesson link
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(lesson.url)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-300 hover:text-rose-200"
                aria-label={`Delete the saved offline copy of ${lesson.title}`}
              >
                Delete offline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
