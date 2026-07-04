"use client";

import { useEffect, useRef } from "react";
import {
  resolvePracticeShortcut,
  type PracticePhase,
} from "@/lib/shortcut-logic";

// Client hook that wires the pure practice key-mapping (shortcut-logic.ts) to a
// single document-level keydown listener. The mapping decisions live in the
// pure lib; this hook only reads the DOM event, classifies its target, and
// dispatches the resolved intent. One listener is attached on mount (mirroring
// onboarding.tsx's keydown effect) and the latest handlers are read from a ref
// so the listener never needs re-attaching as state changes each render.

export type PracticeShortcutHandlers = {
  /** When false the listener is a no-op (loading / empty-state / etc.). */
  enabled: boolean;
  phase: PracticePhase;
  choiceCount: number;
  onChoose: (index: number) => void;
  onNext: () => void;
  onSpeak: () => void;
  onAgain: () => void;
};

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

export function usePracticeShortcuts(handlers: PracticeShortcutHandlers): void {
  // Keep the freshest handlers in a ref so the mount-only listener always sees
  // current phase/choiceCount/callbacks without being re-subscribed. The ref is
  // refreshed in an effect (never during render) so it stays commit-consistent;
  // keydown only fires after commit, so the listener always reads live values.
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const h = ref.current;
      if (!h.enabled) return;

      const intent = resolvePracticeShortcut(e.key, {
        phase: h.phase,
        choiceCount: h.choiceCount,
        hasModifier: e.ctrlKey || e.metaKey || e.altKey,
        repeat: e.repeat,
        targetIsEditable: isEditableTarget(e.target),
        targetIsButton: isActivationTarget(e.target),
      });
      if (!intent) return;

      e.preventDefault();
      switch (intent.type) {
        case "choose":
          h.onChoose(intent.index);
          break;
        case "next":
          h.onNext();
          break;
        case "speak":
          h.onSpeak();
          break;
        case "again":
          h.onAgain();
          break;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
