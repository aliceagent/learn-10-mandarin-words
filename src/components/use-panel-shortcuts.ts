"use client";

import { useEffect, useRef } from "react";
import type { PanelTargetContext } from "@/lib/panel-shortcut-logic";

// Generic client adapter that wires a pure panel key→intent resolver
// (panel-shortcut-logic.ts) to a single document-level keydown listener. Mirrors
// use-practice-shortcuts.ts exactly: one listener attached on mount, the latest
// props read from a ref so the listener never needs re-attaching, and
// preventDefault called ONLY when an intent resolves (so unclaimed keys stay
// native). The resolver decides everything panel-specific; this hook only reads
// the DOM event and classifies its target.

/** input/textarea/select/contenteditable — never hijack keys during text entry. */
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/** button/a — a focused one activates on Enter natively, so guard against double-fire. */
function isActivationTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "BUTTON" || tag === "A";
}

export function usePanelShortcuts<Intent>(opts: {
  /** When false the listener is a no-op (overlay open, wrong tab, empty state, …). */
  enabled: boolean;
  resolve: (key: string, target: PanelTargetContext) => Intent | null;
  onIntent: (intent: Intent) => void;
}): void {
  // Keep the freshest props in a ref so the mount-only listener always reads live
  // resolve/onIntent closures without being re-subscribed. Refreshed in an effect
  // (never during render) so it stays commit-consistent; keydown only fires after
  // commit, so the listener always reads current values.
  const ref = useRef(opts);
  useEffect(() => {
    ref.current = opts;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { enabled, resolve, onIntent } = ref.current;
      if (!enabled) return;

      const intent = resolve(e.key, {
        hasModifier: e.ctrlKey || e.metaKey || e.altKey,
        repeat: e.repeat,
        targetIsEditable: isEditableTarget(e.target),
        targetIsButton: isActivationTarget(e.target),
      });
      if (intent === null || intent === undefined) return;

      e.preventDefault();
      onIntent(intent);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
