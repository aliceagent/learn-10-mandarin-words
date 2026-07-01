"use client";

import type { VideoMeta } from "@/lib/types";
import { resolveSource } from "@/lib/video";

interface VideoPlayerProps {
  src: string;
  title: string;
  video?: VideoMeta;
}

export function VideoPlayer({ src, title, video }: VideoPlayerProps) {
  const resolved = resolveSource(src, video);

  if (resolved.kind === "youtube") {
    return (
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 h-full w-full rounded-[1.5rem]"
          src={`https://www.youtube.com/embed/${resolved.id}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (resolved.kind === "mp4") {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        poster={resolved.poster}
        className="w-full rounded-[1.5rem] bg-slate-950"
        aria-label={title}
      >
        <source src={resolved.src} type="video/mp4" />
        {resolved.captions?.map((c) => (
          <track key={c.lang} kind="subtitles" srcLang={c.lang} label={c.label} src={c.src} />
        ))}
        Your browser does not support the video tag.
      </video>
    );
  }

  // Intentional "lesson coming soon" placeholder until a real video is connected.
  return (
    <div className="flex aspect-video items-center justify-center rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 text-center">
      <div className="px-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="#34d399" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Video lesson coming soon</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
          Practice the ten words below now. The drill video for this list plugs in here as soon as
          it&apos;s produced — your progress carries over.
        </p>
      </div>
    </div>
  );
}
