"use client";

import { useEffect, useMemo, useState } from "react";
import {
  appOfflineStatus,
  prepareAppOffline,
  type OfflineAppPackStatus,
  type OfflineAppPackResult,
} from "@/lib/offline-app-pack";
import {
  offlineAppPackButtonLabel,
  offlineAppPackCopy,
  offlineAppPackProgressLabel,
  type OfflineAppPackProgress,
} from "@/lib/offline-app-pack-ui";
import { supportsCacheStorage } from "@/lib/offline";
import { useOnlineStatus } from "./use-online-status";

type OfflineAppPackCardProps = {
  manifestUrls: string[];
  compact?: boolean;
};

const TONE_CLASS = {
  amber: "border-amber-300/25 bg-amber-400/[0.08] text-amber-100",
  sky: "border-sky-300/25 bg-sky-400/[0.08] text-sky-100",
  emerald: "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100",
} as const;

const BUTTON_CLASS = {
  amber: "bg-amber-300 text-slate-950 hover:bg-amber-200",
  sky: "bg-sky-300 text-slate-950 hover:bg-sky-200",
  emerald: "bg-emerald-400 text-slate-950 hover:bg-cta",
} as const;

function defaultStatus(total: number): OfflineAppPackStatus {
  return { state: "not-ready", total, cached: 0, missing: [] };
}

export function OfflineAppPackCard({ manifestUrls, compact = false }: OfflineAppPackCardProps) {
  const online = useOnlineStatus();
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<OfflineAppPackStatus>(() => defaultStatus(manifestUrls.length));
  const [progress, setProgress] = useState<OfflineAppPackProgress | null>(null);
  const [lastResult, setLastResult] = useState<OfflineAppPackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preparing = progress !== null;

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!supportsCacheStorage()) {
        if (active) setReady(true);
        return;
      }
      if (active) setSupported(true);
      try {
        const next = await appOfflineStatus(manifestUrls);
        if (active) setStatus(next);
      } catch {
        if (active) setError("Couldn't read offline storage on this device.");
      } finally {
        if (active) setReady(true);
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [manifestUrls]);

  const copy = useMemo(() => offlineAppPackCopy(status.state, status), [status]);
  const progressLabel = offlineAppPackProgressLabel(progress);

  async function onPrepare() {
    if (!supported || preparing) return;
    setError(null);
    setLastResult(null);
    try {
      const result = await prepareAppOffline(manifestUrls, {
        onProgress: setProgress,
      });
      setLastResult(result);
      setStatus(await appOfflineStatus(manifestUrls));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't prepare the app for offline use.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <section
      className={`rounded-3xl border p-4 text-left md:p-5 ${TONE_CLASS[copy.tone]} ${compact ? "mx-auto w-full max-w-md" : "mx-auto max-w-7xl"}`}
      aria-label="Offline mode readiness"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold opacity-90">Offline mode</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">{copy.title}</h2>
          <p className="mt-2 text-sm font-semibold text-white/90">{ready ? copy.status : "Checking offline readiness…"}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{copy.body}</p>
          {progressLabel ? <p className="mt-2 text-sm font-semibold text-white">{progressLabel}</p> : null}
          {!online && status.state !== "ready" ? (
            <p className="mt-2 text-sm text-slate-300">You&apos;re offline now — reconnect before preparing the app pack.</p>
          ) : null}
          {lastResult && !lastResult.complete ? (
            <p className="mt-2 text-sm text-slate-300">
              Cached {lastResult.cached} of {lastResult.total}; {lastResult.failed.length} failed{lastResult.skipped ? `, ${lastResult.skipped} skipped` : ""}.
            </p>
          ) : null}
          {error ? <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p> : null}
          {!supported && ready ? (
            <p role="alert" className="mt-2 text-sm text-rose-200">This browser doesn&apos;t expose Cache Storage, so true offline mode isn&apos;t available here.</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onPrepare}
          disabled={!supported || preparing || (!online && status.state !== "ready")}
          aria-busy={preparing || undefined}
          className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_CLASS[copy.tone]}`}
        >
          {offlineAppPackButtonLabel(status.state, preparing)}
        </button>
      </div>
    </section>
  );
}
