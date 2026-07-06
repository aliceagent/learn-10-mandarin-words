"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoMeta } from "@/lib/types";
import { resolveSource, type Resolved } from "@/lib/video";
import {
  DEFAULT_RATE,
  PLAYBACK_RATES,
  normalizeRate,
  rateLabel,
  type PlaybackRate,
} from "@/lib/video-controls";

interface VideoPlayerProps {
  src: string;
  title: string;
  video?: VideoMeta;
}

const RATE_STORAGE_KEY = "learn-10-mandarin-video-rate";

// MP4 lessons get speed + replay controls on top of the native player. Split
// into its own component so the player-only hooks never run for the YouTube or
// placeholder branches (hooks can't be called conditionally).
function Mp4Player({
  resolved,
  title,
}: {
  resolved: Extract<Resolved, { kind: "mp4" }>;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState<PlaybackRate>(DEFAULT_RATE);
  const [loaded, setLoaded] = useState(false);

  // Read the persisted rate on mount only — never during render. Mirrors the
  // read-in-effect pattern in use-progress.ts (state already defaults to
  // DEFAULT_RATE, so we only override when a value was stored).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RATE_STORAGE_KEY);
      if (stored) {
        setRate(normalizeRate(stored));
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  // Apply the rate to the element, re-apply once metadata loads (playbackRate
  // resets across some loads), and mirror native-control changes back to the
  // pills via ratechange.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = rate;
    const onLoadedMetadata = () => {
      el.playbackRate = rate;
    };
    const onRateChange = () => {
      setRate(normalizeRate(el.playbackRate));
    };
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("ratechange", onRateChange);
    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("ratechange", onRateChange);
    };
  }, [rate]);

  // Persist only after the initial load so we don't clobber a stored value with
  // the default before it has been read.
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(rate));
    } catch {
      // Storage may be unavailable (private mode, quota) — ignore.
    }
  }, [loaded, rate]);

  function replay() {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play();
  }

  return (
    <div>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={resolved.poster}
        className="w-full rounded-2xl bg-background"
        aria-label={title}
      >
        <source src={resolved.src} type="video/mp4" />
        {resolved.captions?.map((c) => (
          <track key={c.lang} kind="subtitles" srcLang={c.lang} label={c.label} src={c.src} />
        ))}
        Your browser does not support the video tag.
      </video>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Playback speed">
          {PLAYBACK_RATES.map((r) => {
            const active = r === rate;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRate(r)}
                aria-pressed={active}
                aria-label={`Playback speed ${rateLabel(r)}`}
                className={`min-h-[44px] min-w-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-emerald-300 bg-emerald-300/20 text-white"
                    : "border-white/10 bg-background text-slate-200 hover:border-emerald-300"
                }`}
              >
                {rateLabel(r)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={replay}
          aria-label="Replay from the start"
          className="min-h-[44px] rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300"
        >
          ↺ Replay
        </button>
      </div>
    </div>
  );
}

export function VideoPlayer({ src, title, video }: VideoPlayerProps) {
  const resolved = resolveSource(src, video);

  if (resolved.kind === "youtube") {
    return (
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 h-full w-full rounded-2xl"
          src={`https://www.youtube.com/embed/${resolved.id}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (resolved.kind === "mp4") {
    return <Mp4Player resolved={resolved} title={title} />;
  }

  // Intentional "lesson coming soon" placeholder until a real video is connected.
  // The only lists without a generated video today are the Useful Phrases topics,
  // so the copy is written to feel deliberate rather than broken.
  return (
    <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 text-center">
      <div className="px-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="#34d399" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Video lesson coming soon</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
          This list is fully ready to study — the walkthrough video just isn&apos;t recorded yet.
          Tap the speaker on each phrase to hear it, practice below, and your progress will be here
          when the video arrives.
        </p>
      </div>
    </div>
  );
}
