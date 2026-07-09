import { downloadableMp4Url } from "./video.ts";

export type OfflineLibraryTopic = {
  slug: string;
  titleEn: string;
  videoPath: string;
  video?: Parameters<typeof downloadableMp4Url>[0]["video"];
};

export type SavedOfflineLessonRow = {
  url: string;
  title: string;
  slug: string | null;
  href: string | null;
  size: number | null;
};

export type OfflineHomeSummary = {
  hasSavedOffline: boolean;
  count: number;
  totalBytes: number;
  preview: SavedOfflineLessonRow[];
};

function urlKey(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.pathname;
  } catch {
    return url;
  }
}

function fallbackTitle(url: string): string {
  try {
    const name = new URL(url, "http://localhost").pathname.split("/").pop() || url;
    return decodeURIComponent(name);
  } catch {
    return url;
  }
}

export function savedOfflineLessonRows(
  topics: readonly OfflineLibraryTopic[],
  savedUrls: ReadonlySet<string>,
  sizes: ReadonlyMap<string, number | null> = new Map(),
): SavedOfflineLessonRow[] {
  const byPath = new Map<string, OfflineLibraryTopic>();
  const byExact = new Map<string, OfflineLibraryTopic>();

  for (const topic of topics) {
    const url = downloadableMp4Url(topic);
    if (!url) continue;
    byExact.set(url, topic);
    byPath.set(urlKey(url), topic);
  }

  const rows = [...savedUrls].map((url) => {
    const topic = byExact.get(url) ?? byPath.get(urlKey(url));
    if (!topic) {
      return {
        url,
        title: fallbackTitle(url),
        slug: null,
        href: null,
        size: sizes.get(url) ?? null,
      };
    }
    return {
      url,
      title: topic.titleEn,
      slug: topic.slug,
      href: `/topics/${topic.slug}`,
      size: sizes.get(url) ?? null,
    };
  });

  rows.sort((a, b) => a.title.localeCompare(b.title));
  return rows;
}

export function offlineHomeSummary(rows: readonly SavedOfflineLessonRow[], limit = 3): OfflineHomeSummary {
  return {
    hasSavedOffline: rows.length > 0,
    count: rows.length,
    totalBytes: rows.reduce((sum, row) => sum + (row.size ?? 0), 0),
    preview: rows.slice(0, limit),
  };
}
