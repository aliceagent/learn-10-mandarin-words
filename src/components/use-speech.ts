"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KEEPALIVE_MS,
  SPEECH_RATE,
  VOICES_SETTLE_MS,
  classifySupport,
  pickChineseVoice,
  type SpeechSupport,
} from "@/lib/speech";

// Single hardened entry point for Web Speech synthesis. Every speak control in
// the app goes through this hook so the browser-quirk workarounds live in one
// place instead of being copy-pasted (and drifting) across call sites:
//
//  - Voice selection: pick a real Chinese voice from getVoices() instead of
//    trusting `utterance.lang` to resolve one.
//  - Stuck-pause: Chrome parks the engine in a paused state after tab
//    backgrounding, silencing every later utterance until reload — resume()
//    before each speak(), plus a keep-alive interval while speaking, clears it.
//  - GC bug: Chrome can garbage-collect an in-flight utterance, cutting it off —
//    retain it in a ref for its lifetime.
//  - cancel→speak race: on Chrome/Android a synchronous cancel() then speak()
//    intermittently drops the new utterance — defer the speak() briefly, but
//    only when something was already speaking so the common path stays instant.
//
// Hydration-safe: the initial status is "loading" (never DOM-derived) so SSR and
// first client render agree; real detection runs in a mount effect.

export interface UseSpeechResult {
  status: SpeechSupport;
  speaking: boolean;
  /** True briefly after a non-cancel utterance error; auto-clears. */
  failed: boolean;
  speak: (text: string, opts?: { lang?: string; rate?: number }) => void;
  stop: () => void;
}

const CANCEL_RACE_DELAY_MS = 60;

export function useSpeech(): UseSpeechResult {
  const [status, setStatus] = useState<SpeechSupport>("loading");
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);

  // The current utterance is held in a ref for its whole lifetime so Chrome
  // can't GC it mid-speech.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Timers we own and must clear on unmount: the keep-alive resume() interval,
  // the deferred-speak timeout, and the failed-flag auto-clear timeout.
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deferRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  // ── Mount-only voice detection (browser-only APIs) ──
  useEffect(() => {
    let active = true;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      // Deferred so the effect body never calls setState synchronously (avoids a
      // cascading render — matches the feature-detection idiom in
      // save-offline-button.tsx).
      queueMicrotask(() => {
        if (active) setStatus("unsupported");
      });
      return () => {
        active = false;
      };
    }
    const synth = window.speechSynthesis;
    let settled = false;

    const refresh = () => {
      if (!active) return;
      setStatus(classifySupport(true, synth.getVoices(), settled));
    };

    // Chrome returns [] until `voiceschanged` fires; other engines populate
    // synchronously. Read once now (in a microtask), then react to the event.
    queueMicrotask(refresh);
    synth.addEventListener?.("voiceschanged", refresh);
    // After the settle window, treat a still-empty list as "ready" (optimistic —
    // see classifySupport). A populated list would already have resolved above.
    const settleTimer = setTimeout(() => {
      settled = true;
      refresh();
    }, VOICES_SETTLE_MS);

    return () => {
      active = false;
      clearTimeout(settleTimer);
      synth.removeEventListener?.("voiceschanged", refresh);
    };
  }, []);

  // ── Cleanup our timers on unmount (but not global speech — another mounted
  //    button may still own the utterance). ──
  useEffect(() => {
    return () => {
      clearKeepAlive();
      if (deferRef.current !== null) clearTimeout(deferRef.current);
      if (failedTimerRef.current !== null) clearTimeout(failedTimerRef.current);
    };
  }, [clearKeepAlive]);

  const speak = useCallback(
    (text: string, opts?: { lang?: string; rate?: number }) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (!text) return;
      const synth = window.speechSynthesis;

      setFailed(false);
      if (failedTimerRef.current !== null) {
        clearTimeout(failedTimerRef.current);
        failedTimerRef.current = null;
      }

      // Clear any stuck pause before we touch the queue.
      synth.resume();
      const wasBusy = synth.speaking || synth.pending;
      synth.cancel();
      if (deferRef.current !== null) {
        clearTimeout(deferRef.current);
        deferRef.current = null;
      }

      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = opts?.lang ?? "zh-CN";
      utt.rate = opts?.rate ?? SPEECH_RATE;
      const voice = pickChineseVoice(synth.getVoices());
      if (voice) utt.voice = voice;
      utteranceRef.current = utt;

      utt.onstart = () => {
        setSpeaking(true);
        clearKeepAlive();
        // Keep the engine awake for longer (sentence-length) utterances.
        keepAliveRef.current = setInterval(() => {
          window.speechSynthesis.resume();
        }, KEEPALIVE_MS);
      };
      const finish = () => {
        clearKeepAlive();
        if (utteranceRef.current === utt) utteranceRef.current = null;
        setSpeaking(false);
      };
      utt.onend = finish;
      utt.onerror = (event) => {
        finish();
        // cancel()/interrupt from a newer tap is expected — don't surface it.
        const err = (event as SpeechSynthesisErrorEvent).error;
        if (err !== "canceled" && err !== "interrupted") {
          setFailed(true);
          failedTimerRef.current = setTimeout(() => setFailed(false), 4000);
        }
      };

      const fire = () => {
        deferRef.current = null;
        window.speechSynthesis.speak(utt);
      };
      // Only pay the deferral when we actually interrupted something (the
      // cancel→speak race); a cold tap speaks immediately.
      if (wasBusy) {
        deferRef.current = setTimeout(fire, CANCEL_RACE_DELAY_MS);
      } else {
        fire();
      }
    },
    [clearKeepAlive],
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (deferRef.current !== null) {
      clearTimeout(deferRef.current);
      deferRef.current = null;
    }
    clearKeepAlive();
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, [clearKeepAlive]);

  return { status, speaking, failed, speak, stop };
}
