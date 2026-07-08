import type { FlashcardStat } from "./types";

// Keep these aligned with progress-logic.ts. Duplicated here deliberately so the
// confidence helper stays tiny, direct-testable, and free of scheduler runtime
// imports; confidence is a display model, not the scheduling source of truth.
const MASTERED_INTERVAL_DAYS = 7;
const LEECH_LAPSE_THRESHOLD = 4;

export type FlashcardConfidenceLabel = "New" | "Shaky" | "Learning" | "Solid" | "Mastered" | "Needs rescue";
export type FlashcardConfidenceTone = "slate" | "amber" | "sky" | "emerald" | "rose";

export type FlashcardConfidence = {
  /** 0–100, derived from review interval, review count, ease, and lapses. */
  score: number;
  label: FlashcardConfidenceLabel;
  tone: FlashcardConfidenceTone;
  explanation: string;
};

export function confidencePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function baseConfidence(stat: FlashcardStat): number {
  const intervalPart = Math.min(stat.intervalDays / MASTERED_INTERVAL_DAYS, 1) * 70;
  const reviewPart = Math.min(stat.reviewCount, 4) * 5;
  const easePart = Math.max(-5, Math.min(10, (stat.ease - 2.5) * 20));
  const lapsePenalty = Math.min(35, stat.lapses * 12);
  return confidencePercent(intervalPart + reviewPart + easePart - lapsePenalty);
}

export function flashcardConfidence(stat: FlashcardStat | undefined): FlashcardConfidence {
  if (!stat || stat.reviewCount <= 0) {
    return { score: 0, label: "New", tone: "slate", explanation: "Not reviewed yet" };
  }

  if (stat.lapses >= LEECH_LAPSE_THRESHOLD && stat.intervalDays < MASTERED_INTERVAL_DAYS) {
    return {
      score: 10,
      label: "Needs rescue",
      tone: "rose",
      explanation: "Repeated misses; use focused practice",
    };
  }

  if (stat.lapses > 0 && stat.intervalDays < 3) {
    return {
      score: 25,
      label: "Shaky",
      tone: "amber",
      explanation: "Missed before; keep it close",
    };
  }

  const score = baseConfidence(stat);

  if (stat.intervalDays >= MASTERED_INTERVAL_DAYS) {
    return {
      score: Math.max(85, score),
      label: "Mastered",
      tone: "emerald",
      explanation: "Long review interval with stable recall",
    };
  }

  if (stat.intervalDays >= 4) {
    return {
      score,
      label: "Solid",
      tone: "emerald",
      explanation: "Building a longer review interval",
    };
  }

  return {
    score,
    label: "Learning",
    tone: "sky",
    explanation: "Reviewed, but still early in spacing",
  };
}

export function confidenceAriaLabel(confidence: FlashcardConfidence): string {
  return `Confidence ${confidence.score}%, ${confidence.label} — ${confidence.explanation}`;
}
