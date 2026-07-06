// Privacy-first analytics scaffolding.
//
// This module NEVER sends data over the network and collects NO personal data.
// It exists so product events have a single, typed choke point. By default it is
// a no-op. Enable local/dev behaviour with the public env var:
//
//   NEXT_PUBLIC_ANALYTICS=off      → do nothing (default in production)
//   NEXT_PUBLIC_ANALYTICS=console  → console.debug each event (default in dev)
//   NEXT_PUBLIC_ANALYTICS=local    → keep anonymous per-event counters in
//                                    localStorage (no payloads, no identifiers)
//
// To wire a real, consented analytics provider later, add the transport inside
// `dispatch()` — do NOT scatter tracking calls or fetches across the app.

export type AnalyticsEvent =
  | "onboarding_completed"
  | "onboarding_skipped"
  | "topic_start"
  | "quiz_completed"
  | "tone_practice_completed"
  | "tone_listen_completed"
  | "tone_pairs_completed"
  | "listen_all_completed"
  | "review_completed"
  | "comeback_completed"
  | "rescue_drill_completed"
  | "redrill_completed"
  | "practice_session_completed"
  | "daily_challenge_completed"
  | "boss_round_completed"
  | "duel_completed"
  | "lightning_completed"
  | "typed_recall_completed"
  | "matching_completed"
  | "memory_completed"
  | "daily_goal_met"
  | "streak_freeze_earned"
  | "streak_freeze_used"
  | "score_card_shared"
  | "favorite_saved"
  | "tone_colors_toggled"
  | "search_result_opened"
  | "recent_topic_resumed"
  | "connection_opened"
  | "install_prompt_shown"
  | "install_accepted"
  | "lesson_saved_offline"
  | "lesson_removed_offline";

// Props are intentionally constrained to non-identifying primitives.
export type AnalyticsProps = Record<string, string | number | boolean>;

type AnalyticsMode = "off" | "console" | "local";

const COUNTER_KEY = "learn-10-mandarin-analytics-v1";

function resolveMode(): AnalyticsMode {
  const raw = process.env.NEXT_PUBLIC_ANALYTICS;
  if (raw === "console" || raw === "local" || raw === "off") return raw;
  // No explicit config: chatty in dev, silent in production.
  return process.env.NODE_ENV === "development" ? "console" : "off";
}

function bumpLocalCounter(event: AnalyticsEvent) {
  try {
    const stored = window.localStorage.getItem(COUNTER_KEY);
    const counts: Record<string, number> = stored ? JSON.parse(stored) : {};
    counts[event] = (counts[event] ?? 0) + 1;
    window.localStorage.setItem(COUNTER_KEY, JSON.stringify(counts));
  } catch {
    // Storage unavailable (private mode / SSR) — analytics must never throw.
  }
}

function dispatch(event: AnalyticsEvent, props: AnalyticsProps | undefined, mode: AnalyticsMode) {
  if (mode === "console") {
    console.debug(`[analytics] ${event}`, props ?? {});
    return;
  }
  if (mode === "local") {
    bumpLocalCounter(event);
  }
}

/** Record a product event. Safe to call anywhere; never throws, never networks. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return; // client-only
  const mode = resolveMode();
  if (mode === "off") return;
  try {
    dispatch(event, props, mode);
  } catch {
    // Analytics is best-effort; failures must not affect the app.
  }
}

/** Read the anonymous local counters (only populated in "local" mode). */
export function readLocalCounters(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(COUNTER_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/** True when any collection mode is active (used to show a privacy note). */
export function analyticsEnabled(): boolean {
  return resolveMode() !== "off";
}
