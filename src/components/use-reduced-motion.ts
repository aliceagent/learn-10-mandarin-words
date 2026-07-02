"use client";

import { useSyncExternalStore } from "react";

// Reports whether the user has requested reduced motion. Used by the flashcard
// deck (Sprint 9) to skip the drag-follow transform and grade immediately
// instead of playing the fling animation. Subscribes via useSyncExternalStore
// so it stays hydration-safe (server snapshot is always `false`).
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia
    ? window.matchMedia(QUERY).matches
    : false;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
