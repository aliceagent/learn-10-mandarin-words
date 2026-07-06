// Pure, DOM-free helpers for Web Speech synthesis reliability. All voice
// selection and support-classification logic lives here so it can be unit-tested
// under `node --test` (no browser). The React glue that actually touches
// `window.speechSynthesis` lives in `src/components/use-speech.ts`, mirroring the
// pure-logic / hook split of `gesture-logic.ts` + `use-card-drag.ts`.
//
// Why explicit voice selection: setting only `utterance.lang = "zh-CN"` lets the
// browser pick any voice (often an English one that mangles hanzi, or none at
// all). Picking a real Chinese voice from `getVoices()` when one exists is far
// more reliable, and knowing when the list is populated-but-Chinese-less lets the
// UI be honest instead of failing silently.

/** The subset of `SpeechSynthesisVoice` this module needs — kept minimal so the
 *  helpers are trivially testable with plain object fixtures. */
export type SpeechVoiceLike = {
  lang: string;
  name?: string;
  localService?: boolean;
};

/**
 * Speech-support state for the UI:
 * - `loading`      — API present, voice list not yet settled (Chrome reports
 *                    `[]` until `voiceschanged` fires); also the SSR-safe default.
 * - `unsupported`  — no `speechSynthesis` API at all.
 * - `no-chinese-voice` — API present, a *populated* voice list with no zh voice.
 * - `ready`        — API present and either a zh voice exists or the list settled
 *                    empty (optimistic: Android Chrome lies with `[]` yet speaks).
 */
export type SpeechSupport = "loading" | "unsupported" | "no-chinese-voice" | "ready";

/** Utterance rate for Mandarin practice — slightly slowed so tones are audible. */
export const SPEECH_RATE = 0.85;
/** Absolute utterance rate for the slow-replay control (~0.6×) — slow enough to
 *  expose tone contours (rising 2nd, dipping 3rd, falling 4th) that blur together
 *  at normal speed, yet above the ~0.5 floor where many engines sound glitchy. */
export const SLOW_SPEECH_RATE = 0.6;

/** Which of the two speak controls was tapped — maps to an utterance rate. */
export type SpeechPace = "normal" | "slow";

/** Map a pace to its absolute utterance rate, so the hook/component never
 *  hardcode numbers and the mapping stays unit-testable. */
export function speechRateFor(pace: SpeechPace): number {
  return pace === "slow" ? SLOW_SPEECH_RATE : SPEECH_RATE;
}
/** How long to wait for `getVoices()` to populate before treating an empty list
 *  as "settled" (see the optimistic empty-list rule in `classifySupport`). */
export const VOICES_SETTLE_MS = 1500;
/** Interval for the `resume()` keep-alive that defeats Chrome's ~15s pause bug
 *  on longer (sentence-length) utterances. */
export const KEEPALIVE_MS = 10_000;

/** Lowercase and normalise a BCP-47-ish tag so `zh_CN`, `ZH-Hans-CN`, etc. all
 *  compare consistently. */
export function normalizeLang(tag: string): string {
  return tag.toLowerCase().replace(/_/g, "-");
}

/** True for a Mandarin/Chinese voice (`zh` or `cmn`), excluding Cantonese
 *  (`yue`), which sounds wrong reading Simplified Mandarin content. */
export function isChineseVoice(voice: SpeechVoiceLike): boolean {
  const lang = normalizeLang(voice.lang ?? "");
  if (lang.startsWith("yue")) return false;
  return lang === "zh" || lang.startsWith("zh-") || lang === "cmn" || lang.startsWith("cmn-");
}

/**
 * Rank a voice for Mandarin playback — lower is better; `Infinity` for a
 * non-Chinese voice. Preference order: `zh-cn` > `zh-hans*` > `cmn` >
 * generic `zh`/other > `zh-tw` > `zh-hk`. Within one base rank, a `localService`
 * voice wins (offline-capable and generally more reliable than a network voice).
 */
export function rankChineseVoice(voice: SpeechVoiceLike): number {
  if (!isChineseVoice(voice)) return Infinity;
  const lang = normalizeLang(voice.lang);
  let base: number;
  if (lang === "zh-cn" || lang.startsWith("zh-cn-")) base = 0;
  else if (lang.startsWith("zh-hans")) base = 1;
  else if (lang === "cmn" || lang.startsWith("cmn-")) base = 2;
  else if (lang === "zh-tw" || lang.startsWith("zh-tw-")) base = 4;
  else if (lang === "zh-hk" || lang.startsWith("zh-hk-")) base = 5;
  else base = 3; // generic `zh` and other zh-* regions/scripts
  // Base rank dominates; localService only breaks a same-base tie.
  return base * 2 + (voice.localService ? 0 : 1);
}

/** Pick the best-ranked Chinese voice, or `null` if the list has none. */
export function pickChineseVoice<V extends SpeechVoiceLike>(voices: readonly V[]): V | null {
  let best: V | null = null;
  let bestRank = Infinity;
  for (const voice of voices) {
    const rank = rankChineseVoice(voice);
    if (rank < bestRank) {
      best = voice;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * Classify speech support for the UI from the three observable facts. See the
 * `SpeechSupport` doc for the states. The empty-list case is deliberately
 * optimistic once settled: some engines (notably Android Chrome) report `[]` yet
 * speak fine, so only a *populated* list with no zh voice proves absence.
 */
export function classifySupport(
  hasApi: boolean,
  voices: readonly SpeechVoiceLike[],
  voicesSettled: boolean,
): SpeechSupport {
  if (!hasApi) return "unsupported";
  if (pickChineseVoice(voices)) return "ready";
  if (voices.length > 0) return "no-chinese-voice";
  return voicesSettled ? "ready" : "loading";
}

/** Whether tapping a speak control could plausibly produce audio. False only
 *  when we're certain it can't (no API, or a populated list with no zh voice). */
export function canAttemptSpeech(status: SpeechSupport): boolean {
  return status === "ready" || status === "loading";
}
