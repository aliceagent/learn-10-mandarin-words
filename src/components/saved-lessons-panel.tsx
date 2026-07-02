"use client";

import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { downloadableMp4Url } from "@/lib/video";
import {
  formatBytes,
  listSavedLessons,
  removeLessonOffline,
  savedLessonSize,
  supportsCacheStorage,
} from "@/lib/offline";

type SavedLesson = {
  url: string;
  title: string;
  slug: string | null;
  size: number | null;
};

// Map a saved MP4 URL back to its topic title, so the list reads as lessons
// rather than raw file URLs. Built from the bundled topic data.
function describeUrl(url: string): { title: string; slug: string | null } {
  for (const topic of data.topics) {
    if (downloadableMp4Url(topic) === url) {
      return { title: topic.titleEn, slug: topic.slug };
    }
  }
  // Fall back to the file name for anything not in the current dataset.
  try {
    const name = new URL(url).pathname.split("/").pop() || url;
    return { title: decodeURIComponent(name), slug: null };
  } catch {
    return { title: url, slug: null };
  }
}

// Read every saved lesson and resolve its title + size. Pure data access, no
// React state — the caller decides what to do with the rows.
async function loadSavedRows(): Promise<SavedLesson[]> {
  const urls = await listSavedLessons();
  const rows = await Promise.all(
    urls.map(async (url) => {
      const { title, slug } = describeUrl(url);
      return { url, title, slug, size: await savedLessonSize(url) };
    })
  );
  rows.sort((a, b) => a.title.localeCompare(b.title));
  return rows;
}

// Lists lessons the learner has explicitly saved for offline playback and lets
// them free the space again. Rendered on /offline; hidden when the Cache API is
// unavailable or nothing is saved.
export function SavedLessonsPanel() {
  const [ready, setReady] = useState(false);
  const [lessons, setLessons] = useState<SavedLesson[]>([]);

  useEffect(() => {
    if (!supportsCacheStorage()) return;
    let active = true;
    (async () => {
      let rows: SavedLesson[] = [];
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
    <section className="mt-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Saved for offline{totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
      </h2>
      <ul className="mt-4 space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.url} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{lesson.title}</p>
              {lesson.size ? (
                <p className="text-xs text-slate-400">{formatBytes(lesson.size)}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onRemove(lesson.url)}
              className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-rose-300 hover:text-rose-200"
              aria-label={`Remove the saved offline copy of ${lesson.title}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
