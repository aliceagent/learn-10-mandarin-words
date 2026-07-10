type OfflineManifestData = {
  categories: readonly { slug: string }[];
  topics: readonly { slug: string }[];
};

export const CORE_OFFLINE_ROUTES = [
  "/",
  "/path",
  "/review",
  "/practice",
  "/favorites",
  "/stats",
  "/settings",
  "/offline",
  "/daily",
  "/comeback",
  "/duel",
  "/lightning",
  "/tone-pairs",
  "/privacy",
] as const;

export const CORE_OFFLINE_ASSETS = [
  "/search-index.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
  "/favicon.ico",
] as const;

const MEDIA_RE = /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?|$)/i;

export function isOfflineAppUrlSafe(url: string): boolean {
  if (!url.startsWith("/")) return false;
  if (url.startsWith("//")) return false;
  if (url.includes("/video-proxy/")) return false;
  if (url.startsWith("/videos/") || MEDIA_RE.test(url)) return false;
  return true;
}

export function offlineAppManifestUrls(data: OfflineManifestData): string[] {
  const urls = [
    ...CORE_OFFLINE_ROUTES,
    ...CORE_OFFLINE_ASSETS,
    ...data.categories.map((category) => `/categories/${category.slug}`),
    ...data.topics.map((topic) => `/topics/${topic.slug}`),
  ];
  return [...new Set(urls)].filter(isOfflineAppUrlSafe);
}
