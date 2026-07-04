// Pure sequencing/timeout/label helpers for the "Play all" listening drill,
// kept DOM-free so they can be unit-tested without a browser (mirrors
// src/lib/video-controls.ts). The client hook (use-listen-all.ts) imports these
// and drives Web Speech synthesis off the ordered steps they produce.

import type { Topic, VocabItem } from "./types";

// Pause between words so the ear has a beat to register each one.
export const WORD_GAP_MS = 900;
// onend is unreliable on some Chrome/Android builds (it can silently never
// fire), so every step also arms a timeout that races it. The floor keeps even a
// single-character word from timing out before a slow voice finishes; the
// per-char term scales the budget for longer strings.
export const MIN_STEP_TIMEOUT_MS = 4000;
export const PER_CHAR_TIMEOUT_MS = 500;

export type ListenStep = {
  key: string;
  text: string;
  pinyin: string;
  english: string;
  index: number;
};

// One ordered step per word in the topic, in topic order. `text` is the hanzi we
// speak. Items with empty hanzi are skipped defensively (nothing to say); the
// remaining steps are re-indexed 0..n-1 so `index` always matches array position
// and the progress counter stays continuous.
export function buildListenSteps(
  topic: Topic,
  keyFor: (item: VocabItem) => string,
): ListenStep[] {
  const steps: ListenStep[] = [];
  for (const item of topic.items) {
    if (!item.hanzi) continue;
    steps.push({
      key: keyFor(item),
      text: item.hanzi,
      pinyin: item.pinyin,
      english: item.english,
      index: steps.length,
    });
  }
  return steps;
}

// The next step to play after `current`, or null when the run is finished.
export function nextStepIndex(current: number, total: number): number | null {
  const next = current + 1;
  return next < total ? next : null;
}

// The onend-never-fires safety fallback for a given word.
export function stepTimeoutMs(text: string): number {
  return MIN_STEP_TIMEOUT_MS + text.length * PER_CHAR_TIMEOUT_MS;
}

// Human progress line, e.g. listenProgressLabel(2, 10) -> "Playing 3 of 10".
export function listenProgressLabel(index: number, total: number): string {
  return `Playing ${index + 1} of ${total}`;
}
