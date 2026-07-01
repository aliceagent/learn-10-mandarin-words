import type { Topic, VideoMeta } from "./types";

// Pure video-source helpers, extracted from video-player.tsx so they can be
// unit-tested without rendering. The component imports resolveSource from here.

export function youtubeId(src: string): string | null {
  // handles full URLs and bare IDs
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (m) return m[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(src)) return src;
  return null;
}

// A remotely hosted, playable MP4 (http/https). Bare local "/videos/*.mp4"
// paths are treated as not-yet-connected placeholders unless promoted via
// explicit `video` metadata (see scripts/map-videos.mjs).
export function remoteMp4(src: string): boolean {
  return /^https?:\/\/.+\.mp4(\?|$)/i.test(src);
}

export type Resolved =
  | { kind: "youtube"; id: string }
  | { kind: "mp4"; src: string; poster?: string; captions?: VideoMeta["captions"] }
  | { kind: "placeholder" };

// Prefer explicit metadata, then fall back to interpreting the legacy videoPath.
export function resolveSource(src: string, video?: VideoMeta): Resolved {
  if (video && video.provider !== "none" && video.source) {
    if (video.provider === "youtube") {
      const id = youtubeId(video.source);
      if (id) return { kind: "youtube", id };
    }
    if (video.provider === "mp4") {
      return { kind: "mp4", src: video.source, poster: video.poster, captions: video.captions };
    }
  }

  const ytId = youtubeId(src);
  if (ytId) return { kind: "youtube", id: ytId };
  if (remoteMp4(src)) return { kind: "mp4", src, poster: video?.poster, captions: video?.captions };

  return { kind: "placeholder" };
}

// A topic has a playable video when its source resolves to something the player
// can actually show (a YouTube embed or a remote MP4) rather than the
// "coming soon" placeholder. Used to drive availability badges.
export function hasPlayableVideo(topic: Pick<Topic, "videoPath" | "video">): boolean {
  return resolveSource(topic.videoPath, topic.video).kind !== "placeholder";
}

// Direct MP4 URL suitable for an "Open video" / download link, or null when the
// topic has no downloadable MP4 (YouTube embeds and placeholders return null).
export function downloadableMp4Url(topic: Pick<Topic, "videoPath" | "video">): string | null {
  const resolved = resolveSource(topic.videoPath, topic.video);
  return resolved.kind === "mp4" ? resolved.src : null;
}
