// Pure, DOM-free logic for the shareable score card (Sprint 6). Everything here
// is unit-testable under `node --test` (see tests/share-card-logic.test.mjs);
// the canvas/DOM layer lives separately in share-card-canvas.ts and the delivery
// UI in components/share-score-button.tsx. Value imports use explicit `.ts`
// extensions so Node's native TS test runner resolves them (mirrors
// progress-logic.ts).
import type { Grade } from "./progress-logic.ts";

// ─── Card data model ──────────────────────────────────────────────────────────

// One featured word on the card. Pinyin ALWAYS accompanies the hanzi (project
// rule), so every consumer that renders `hanzi` renders `pinyin` beside it.
export type ShareCardWord = { hanzi: string; pinyin: string; english: string };

// A discriminated union over the three surfaces that can produce a card. Each
// variant carries only fields already derivable from computeStats (stats),
// practice completion state (practice), or ReviewSession.counts / toughestCards
// (review) — nothing invented, no vocabulary that isn't already in scope.
export type ShareCardData =
  | {
      kind: "stats";
      streak: number;
      reviewedWords: number;
      totalWords: number;
      learnedTopics: number;
      daysStudied: number;
    }
  | { kind: "practice"; score: number; total: number; missed: ShareCardWord[] }
  | { kind: "review"; total: number; counts: Record<Grade, number>; toughest: ShareCardWord[] };

// ─── Layout + color constants ─────────────────────────────────────────────────
// 4:5 portrait — the friendliest aspect ratio for a mobile share sheet / feed.
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

// Colors copied from src/app/globals.css so the canvas matches the live UI. The
// source line/token is noted for each so a future palette change has one place to
// mirror. (globals.css @theme inline block.)
export const SHARE_CARD_COLORS = {
  background: "#020617", // --background (:root) / viewport.themeColor
  surface: "#0d1220", // --color-surface (surface-1 card fill)
  surfaceWell: "#020617", // --color-surface-2 (inset well)
  border: "rgba(255,255,255,0.10)", // --color-border hairline
  accent: "#34d399", // --color-accent (emerald brand)
  accentSoft: "#6ee7b7", // emerald-300, used for pinyin lines
  warn: "#fbbf24", // --color-warn (streak/amber)
  danger: "#fb7185", // --color-danger (rose)
  inkHigh: "#f8fafc", // --color-ink-high (primary text)
  inkMid: "#94a3b8", // --color-ink-mid
  inkLow: "#64748b", // --color-ink-low
  // Tone palette (--color-tone-1…5): 1 red, 2 green, 3 blue, 4 purple, 5 gray.
  tone: ["#f87171", "#4ade80", "#60a5fa", "#c084fc", "#94a3b8"] as const,
} as const;

// Emoji tiles for the Wordle-style score bar.
const SQUARE_HIT = "🟩";
const SQUARE_MISS = "🟥";

// ─── Derived score fraction ───────────────────────────────────────────────────

// Coerce to a whole, in-range count so a corrupt/NaN field can never leak a
// "NaN"/"undefined" into rendered text.
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// Success share in [0, 1] for the tiered headline. Practice: score / total.
// Review: cards not failed = (total − again) / total (a card recalled at all,
// even "hard", counts as success); clamped so a requeued-Again tally can't push
// it out of range. Stats has no single fraction — it's headlined by streak.
export function scoreFraction(data: ShareCardData): number {
  if (data.kind === "practice") {
    if (data.total <= 0) return 0;
    return clampInt(data.score, 0, data.total) / data.total;
  }
  if (data.kind === "review") {
    if (data.total <= 0) return 0;
    const again = Math.max(0, Math.round(data.counts?.again ?? 0));
    return Math.min(1, Math.max(0, (data.total - again) / data.total));
  }
  return 0;
}

// ─── Headline ─────────────────────────────────────────────────────────────────

// Perfect / almost / keep-going tiers, or a streak-led line for the stats card.
// Boundary: exactly 80% lands in the "So close" tier; a perfect fraction (≥ 1)
// is "Perfect round!". Stats with a zero streak falls back to a words-reviewed
// line so the card always says something true and encouraging.
export function shareTitle(data: ShareCardData): string {
  if (data.kind === "stats") {
    if (data.streak > 0) return `🔥 ${data.streak}-day streak`;
    return `${clampInt(data.reviewedWords, 0, Number.MAX_SAFE_INTEGER)} words reviewed`;
  }
  const fraction = scoreFraction(data);
  if (fraction >= 1) return "Perfect round! 🎉";
  if (fraction >= 0.8) return "So close to perfect 💪";
  return "Reps in — keep going 🌱";
}

// ─── Emoji score bar ──────────────────────────────────────────────────────────

// A 🟩/🟥 bar summarizing score/total for the text snippet. Never emits for a
// zero (or non-positive) total. Capped at `maxSquares` tiles: when total exceeds
// the cap the bar is drawn proportionally over `maxSquares` tiles and suffixed
// with ` ×<total>` so the true denominator is still legible.
export function scoreEmojiBar(score: number, total: number, maxSquares = 10): string {
  if (!Number.isFinite(total) || total <= 0) return "";
  const cap = Math.max(1, Math.round(maxSquares));
  const safeScore = clampInt(score, 0, total);
  const squares = Math.min(total, cap);
  const hits = Math.min(squares, Math.round((safeScore / total) * squares));
  const bar = SQUARE_HIT.repeat(hits) + SQUARE_MISS.repeat(squares - hits);
  return total > cap ? `${bar} ×${total}` : bar;
}

// ─── Text snippet ─────────────────────────────────────────────────────────────

// One "hanzi pinyin — english" line for a featured word. Pinyin always follows
// the hanzi so the Chinese line is never bare.
function wordLine(word: ShareCardWord): string {
  return `${word.hanzi} ${word.pinyin} — ${word.english}`;
}

// The full multi-line text snippet (Wordle-style). Shared brand line first, then
// a variant body, then any featured words, then the site host last. `siteHost`
// is injected (from SITE_URL's host) so this stays DOM-free and testable.
export function buildShareText(data: ShareCardData, siteHost: string): string {
  const lines: string[] = ["🀄 Learn 10 Mandarin Words"];

  if (data.kind === "practice") {
    const total = clampInt(data.total, 0, Number.MAX_SAFE_INTEGER);
    const score = clampInt(data.score, 0, total);
    const bar = scoreEmojiBar(score, total);
    lines.push(`${bar ? `${bar} ` : ""}${score}/${total} tricky words`.trim());
    for (const word of data.missed.slice(0, 3)) lines.push(wordLine(word));
  } else if (data.kind === "review") {
    const total = clampInt(data.total, 0, Number.MAX_SAFE_INTEGER);
    const c = data.counts ?? { again: 0, hard: 0, good: 0, easy: 0 };
    const again = clampInt(c.again, 0, Number.MAX_SAFE_INTEGER);
    const hard = clampInt(c.hard, 0, Number.MAX_SAFE_INTEGER);
    const good = clampInt(c.good, 0, Number.MAX_SAFE_INTEGER);
    const easy = clampInt(c.easy, 0, Number.MAX_SAFE_INTEGER);
    lines.push(`Reviewed ${total} card${total !== 1 ? "s" : ""}`);
    lines.push(`${again} again · ${hard} hard · ${good} good · ${easy} easy`);
    for (const word of data.toughest.slice(0, 3)) lines.push(wordLine(word));
  } else {
    lines.push(shareTitle(data));
    const reviewed = clampInt(data.reviewedWords, 0, Number.MAX_SAFE_INTEGER);
    const totalWords = clampInt(data.totalWords, 0, Number.MAX_SAFE_INTEGER);
    const topics = clampInt(data.learnedTopics, 0, Number.MAX_SAFE_INTEGER);
    const days = clampInt(data.daysStudied, 0, Number.MAX_SAFE_INTEGER);
    lines.push(`${reviewed}/${totalWords} words reviewed · ${topics} topics · ${days} days studied`);
  }

  lines.push(siteHost);
  return lines.join("\n");
}

// ─── Greedy line wrapper (for canvas layout) ──────────────────────────────────

// Wrap `text` to fit `maxWidth`, measuring each candidate with the injected
// `measure` callback so it's testable without a real canvas context. Greedy:
// words are packed onto a line until the next word would overflow. A single word
// wider than `maxWidth` still gets its own line (never dropped or split). An
// empty / whitespace-only string yields `[]`.
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
