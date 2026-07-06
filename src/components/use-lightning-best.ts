"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LIGHTNING_STORAGE_KEY,
  mergeRunIntoBest,
  normalizeLightningBest,
  type LightningBest,
  type LightningRun,
} from "@/lib/lightning-logic";

// Device-local personal-best store for the Lightning Round (Sprint 2). The best
// lives under its OWN localStorage key (never in ProgressState), so it doesn't
// touch the progress schema or export/import — the same standalone-preference
// pattern as use-tone-colors.ts / the video-rate control.
//
// Hydration-safe by construction: the first render (server + client) shows the
// zero-state with `loaded === false`, and the stored best is read in a post-mount
// effect, so there is never an SSR/client mismatch. All storage access is
// try/catch-wrapped for private-mode safety.

const ZERO_BEST: LightningBest = { bestScore: 0, bestCorrect: 0, runs: 0, updatedAt: null, history: [] };

function readStored(): LightningBest {
  try {
    const raw = window.localStorage.getItem(LIGHTNING_STORAGE_KEY);
    return normalizeLightningBest(raw ? JSON.parse(raw) : null);
  } catch {
    return ZERO_BEST;
  }
}

export function useLightningBest(): {
  best: LightningBest;
  loaded: boolean;
  recordRun: (run: LightningRun) => boolean;
} {
  const [best, setBest] = useState<LightningBest>(ZERO_BEST);
  const [loaded, setLoaded] = useState(false);

  // Read the stored best post-mount (so the server + first client render both
  // paint the zero-state and there's no hydration mismatch). Only overwrite state
  // when a stored value actually differs from the zero-state, mirroring
  // use-progress's conditional load.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(LIGHTNING_STORAGE_KEY);
        if (raw) setBest(normalizeLightningBest(JSON.parse(raw)));
      } catch {
        // Storage blocked (private mode) — keep the in-memory zero-state.
      } finally {
        setLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  // Fold a finished run into the best, persist, and report whether it set a new
  // record. Reads the freshest stored value first so a mid-session write can't
  // clobber a best saved in another tab. Never throws.
  const recordRun = useCallback((run: LightningRun): boolean => {
    const { best: next, isNewBest } = mergeRunIntoBest(readStored(), run);
    setBest(next);
    try {
      window.localStorage.setItem(LIGHTNING_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked (private mode) — the in-memory value still drives this tab.
    }
    return isNewBest;
  }, []);

  return { best, loaded, recordRun };
}
