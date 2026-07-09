const SAFE_TAG = /^[A-Za-z0-9._-]+$/;
const SAFE_MP4_FILE = /^[A-Za-z0-9._-]+\.mp4$/i;

export function githubReleaseAssetUrl(tag: string, file: string): string | null {
  if (!SAFE_TAG.test(tag) || !SAFE_MP4_FILE.test(file)) return null;
  return `https://github.com/aliceagent/learn-10-mandarin-words/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`;
}

export function proxyVideoResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const copy = [
    "accept-ranges",
    "cache-control",
    "content-disposition",
    "content-length",
    "content-range",
    "etag",
    "last-modified",
  ];
  for (const key of copy) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  // GitHub serves release assets as application/octet-stream. The browser video
  // element is happier when the same-origin proxy presents the actual media type.
  headers.set("content-type", "video/mp4");
  headers.set("accept-ranges", headers.get("accept-ranges") ?? "bytes");
  return headers;
}
