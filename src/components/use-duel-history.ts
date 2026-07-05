"use client";

import { useCallback, useEffect, useState } from "react";
import {
  appendDuelRecord,
  emptyDuelHistory,
  normalizeDuelHistory,
  type DuelHistory,
  type DuelRecord,
} from "@/lib/duel-logic";

// Device-local store for the pass-and-play duel: remembered player names and the
// last DUEL_HISTORY_LIMIT results. Deliberately its OWN localStorage key, NOT
// ProgressState — a duel is two people sharing a device, so its data must never
// touch the owner's progress export/import, quiz stats, streak, or goal ring.
//
// Load-once / save-on-change, mirroring use-progress.ts: the load reads through a
// try/finally so `loaded` always flips even if a corrupt payload throws (the empty
// default then stands), and the save is wrapped so blocked storage never breaks the
// session. `loaded` gates the save effect so the first mount can't clobber stored
// history with the empty default.
const STORAGE_KEY = "learn-10-mandarin-duel-v1";

export function useDuelHistory(): {
  history: DuelHistory;
  loaded: boolean;
  setNames: (names: [string, string]) => void;
  recordResult: (record: DuelRecord) => void;
} {
  const [history, setHistory] = useState<DuelHistory>(emptyDuelHistory);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(normalizeDuelHistory(JSON.parse(stored)));
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage blocked — the in-memory value still drives this session.
    }
  }, [loaded, history]);

  const setNames = useCallback((names: [string, string]) => {
    setHistory((h) => ({ ...h, names }));
  }, []);

  const recordResult = useCallback((record: DuelRecord) => {
    setHistory((h) => appendDuelRecord(h, record));
  }, []);

  return { history, loaded, setNames, recordResult };
}
