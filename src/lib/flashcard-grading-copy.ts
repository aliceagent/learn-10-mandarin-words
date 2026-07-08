import type { Grade } from "./progress-logic";

export type FlashcardGradeLabel = "Forgot" | "Struggled" | "Remembered" | "Instant";

type GradeCopy = {
  label: FlashcardGradeLabel;
  microcopy: string;
};

const GRADE_COPY: Record<Grade, GradeCopy> = {
  again: { label: "Forgot", microcopy: "I could not recall it yet." },
  hard: { label: "Struggled", microcopy: "I got there, but it took effort." },
  good: { label: "Remembered", microcopy: "I remembered it with steady recall." },
  easy: { label: "Instant", microcopy: "It came to mind instantly." },
};

export const FLASHCARD_RECALL_PROMPT = "How well did you recall it before seeing the answer?";

export const flashcardGradeSegments = [
  { grade: "again", label: "Forgot", rule: "border-rose-400/60" },
  { grade: "hard", label: "Struggled", rule: "border-amber-400/60" },
  { grade: "good", label: "Remembered", rule: "border-slate-400/50" },
  { grade: "easy", label: "Instant", rule: "border-emerald-400/60" },
] as const satisfies ReadonlyArray<{ grade: Grade; label: FlashcardGradeLabel; rule: string }>;

export function flashcardGradeLabel(grade: Grade): FlashcardGradeLabel {
  return GRADE_COPY[grade].label;
}

export function flashcardGradeMicrocopy(grade: Grade): string {
  return GRADE_COPY[grade].microcopy;
}

export function flashcardGradePreviewLabel(_grade: Grade, intervalDays: number): string {
  if (intervalDays <= 0) return "Review again today";
  return `Next review in ${intervalDays} day${intervalDays === 1 ? "" : "s"}`;
}

export function flashcardGradeAriaLabel(grade: Grade, intervalDays: number): string {
  return `${flashcardGradeLabel(grade)}, schedules ${grade} — ${flashcardGradeMicrocopy(grade)} ${flashcardGradePreviewLabel(grade, intervalDays)}`;
}
