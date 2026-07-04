"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_RATE, pickChineseVoice } from "@/lib/speech";
import {
  WORD_GAP_MS,
  nextStepIndex,
  stepTimeoutMs,
  type ListenStep,
} from "@/lib/listen-logic";

// Chains Web Speech synthesis across every word of a topic for the "Play all"
// listening drill. The sequencing/timeout/label math is unit-tested in
// src/lib/listen-logic.ts; this hook is the thin browser glue that speaks each
// step and advances, hardened against the two Web Speech quirks that make naïve
// chaining stall or misbehave:
//
//  - `utterance.onend` can silently never fire on some Chrome/Android builds, so
//    every step also arms a `stepTimeoutMs()` timeout that races onend — a dead
//    onend costs a few extra seconds, never a stuck run.
//  - `speechSynthesis.cancel()` surfaces as an `error` ("canceled"/"interrupted")
//    on the in-flight utterance. Our own cancels (restart/stop/next-step) always
//    bump the generation counter first, so those errors land "stale" and are
//    ignored; a *live*-generation cancel means another control (e.g. a
//    SpeakButton tap) interrupted us, so we stop the drill cleanly.
//
// Speaks with the same params as SpeakButton (zh-CN, rate 0.85, explicit Chinese
// voice) so a topic sounds identical whether tapped one word at a time or played
// straight through.

export type ListenStatus = "idle" | "playing" | "done";

export interface UseListenAllResult {
  status: ListenStatus;
  activeIndex: number | null;
  playAll: () => void;
  stop: () => void;
}

export function useListenAll(
  steps: ListenStep[],
  onComplete?: () => void,
): UseListenAllResult {
  const [status, setStatus] = useState<ListenStatus>("idle");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Bumped on every playAll()/stop()/interruption/unmount so that callbacks from
  // a superseded run (stale onend/onerror/timeouts) become no-ops.
  const generationRef = useRef(0);
  // The between-word pause timer and the onend-race fallback timer — both owned
  // here and cleared on every transition so nothing fires after a run ends.
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Retain the current utterance for its whole lifetime so Chrome can't GC it
  // mid-speech (same workaround as useSpeech).
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Latest onComplete without making playAll's identity depend on it.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimers = useCallback(() => {
    if (gapTimerRef.current !== null) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
    if (stepTimerRef.current !== null) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  }, []);

  const playAll = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (steps.length === 0) return;
    const synth = window.speechSynthesis;

    // Start a fresh run: invalidate any in-flight one, clear its timers, and
    // silence whatever is speaking (our own utterance's resulting "canceled"
    // error is now stale and ignored).
    const gen = ++generationRef.current;
    clearTimers();
    synth.resume();
    synth.cancel();
    utteranceRef.current = null;
    setStatus("playing");

    const finishRun = () => {
      if (gen !== generationRef.current) return;
      clearTimers();
      utteranceRef.current = null;
      setStatus("done");
      setActiveIndex(null);
      onCompleteRef.current?.();
    };

    // Live-generation external interruption (e.g. a SpeakButton tap called
    // cancel()): stop the drill without cancelling again — the other control now
    // owns the speech queue and we must not kill its utterance.
    const interrupt = () => {
      if (gen !== generationRef.current) return;
      generationRef.current += 1;
      clearTimers();
      utteranceRef.current = null;
      setStatus("idle");
      setActiveIndex(null);
    };

    const speakStep = (index: number) => {
      const step = steps[index];
      if (!step) return;
      setActiveIndex(index);

      // Guards both handlers and the timeout so a step advances exactly once.
      let settled = false;
      const advance = () => {
        if (settled) return;
        settled = true;
        if (stepTimerRef.current !== null) {
          clearTimeout(stepTimerRef.current);
          stepTimerRef.current = null;
        }
        if (gen !== generationRef.current) return;
        const next = nextStepIndex(index, steps.length);
        if (next === null) {
          finishRun();
          return;
        }
        gapTimerRef.current = setTimeout(() => {
          gapTimerRef.current = null;
          if (gen !== generationRef.current) return;
          speakStep(next);
        }, WORD_GAP_MS);
      };

      // Clear anything still lingering (e.g. a word that overran its timeout);
      // that utterance is already `settled`, so its "canceled" error is ignored.
      synth.resume();
      synth.cancel();

      const utt = new SpeechSynthesisUtterance(step.text);
      utt.lang = "zh-CN";
      utt.rate = SPEECH_RATE;
      const voice = pickChineseVoice(synth.getVoices());
      if (voice) utt.voice = voice;
      utteranceRef.current = utt;

      utt.onend = advance;
      utt.onerror = (event) => {
        const err = (event as SpeechSynthesisErrorEvent).error;
        // Our own cancels bumped the generation first, so they read as stale.
        if (gen !== generationRef.current) return;
        if (settled) return; // already moved on (overran timeout) — ignore late cancel
        if (err === "canceled" || err === "interrupted") {
          interrupt();
          return;
        }
        // A genuine speech error: skip this word rather than stall the run.
        advance();
      };

      // onend is unreliable — race it against a length-scaled fallback so a dead
      // onend never freezes the drill.
      stepTimerRef.current = setTimeout(advance, stepTimeoutMs(step.text));
      synth.speak(utt);
    };

    speakStep(0);
  }, [steps, clearTimers]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    clearTimers();
    utteranceRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus("idle");
    setActiveIndex(null);
  }, [clearTimers]);

  // Tearing down (unmount, tab switch that unmounts the panel, or the steps
  // changing on topic navigation) stops any run and silences audio — no orphaned
  // playback. Bumping the generation neutralises pending callbacks.
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      clearTimers();
      utteranceRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [steps, clearTimers]);

  return { status, activeIndex, playAll, stop };
}
