"use client";

function youtubeId(src: string): string | null {
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

function isMp4(src: string): boolean {
  return /\.mp4(\?|$)/i.test(src);
}

interface VideoPlayerProps {
  src: string;
  title: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  const ytId = youtubeId(src);

  if (ytId) {
    return (
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 h-full w-full rounded-[1.5rem]"
          src={`https://www.youtube.com/embed/${ytId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (isMp4(src)) {
    return (
      <video
        controls
        className="w-full rounded-[1.5rem] bg-slate-950"
        aria-label={title}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <div className="flex aspect-video items-center justify-center rounded-[1.5rem] bg-slate-950 text-center">
      <div className="px-8">
        <p className="text-2xl font-semibold text-white">Video lesson slot</p>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          The generated MP4 for this topic will plug in here once the hosting source is connected.
        </p>
        <p className="mt-4 rounded-full bg-white/[0.06] px-4 py-2 text-xs text-slate-400">{src}</p>
      </div>
    </div>
  );
}
