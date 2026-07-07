export type FlashcardVisibilitySetting =
  | "showPinyinBeforeReveal"
  | "showEnglishBeforeReveal"
  | "showEnglishAfterReveal";

export type FlashcardVisibility = Record<FlashcardVisibilitySetting, boolean>;

export const FLASHCARD_VISIBILITY_STORAGE_KEY = "learn-10-mandarin-flashcard-visibility";

// Default preserves the pre-sprint card behavior: front = hanzi only; reveal =
// hanzi + pinyin + English.
export const DEFAULT_FLASHCARD_VISIBILITY: FlashcardVisibility = {
  showPinyinBeforeReveal: false,
  showEnglishBeforeReveal: false,
  showEnglishAfterReveal: true,
};

export const FLASHCARD_VISIBILITY_OPTIONS: readonly {
  key: FlashcardVisibilitySetting;
  label: string;
  description: string;
}[] = [
  {
    key: "showPinyinBeforeReveal",
    label: "Pinyin hint",
    description: "Show pronunciation before reveal.",
  },
  {
    key: "showEnglishBeforeReveal",
    label: "English hint",
    description: "Show translation before reveal.",
  },
  {
    key: "showEnglishAfterReveal",
    label: "English answer",
    description: "Keep translation visible after reveal.",
  },
] as const;

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeFlashcardVisibility(raw: unknown): FlashcardVisibility {
  if (typeof raw !== "string") return { ...DEFAULT_FLASHCARD_VISIBILITY };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_FLASHCARD_VISIBILITY };
    }
    const value = parsed as Partial<Record<FlashcardVisibilitySetting, unknown>>;
    return {
      showPinyinBeforeReveal: boolOrDefault(
        value.showPinyinBeforeReveal,
        DEFAULT_FLASHCARD_VISIBILITY.showPinyinBeforeReveal,
      ),
      showEnglishBeforeReveal: boolOrDefault(
        value.showEnglishBeforeReveal,
        DEFAULT_FLASHCARD_VISIBILITY.showEnglishBeforeReveal,
      ),
      showEnglishAfterReveal: boolOrDefault(
        value.showEnglishAfterReveal,
        DEFAULT_FLASHCARD_VISIBILITY.showEnglishAfterReveal,
      ),
    };
  } catch {
    return { ...DEFAULT_FLASHCARD_VISIBILITY };
  }
}

export function serializeFlashcardVisibility(value: FlashcardVisibility): string {
  return JSON.stringify({
    showPinyinBeforeReveal: Boolean(value.showPinyinBeforeReveal),
    showEnglishBeforeReveal: Boolean(value.showEnglishBeforeReveal),
    showEnglishAfterReveal: Boolean(value.showEnglishAfterReveal),
  });
}

export function toggleFlashcardVisibility(
  value: FlashcardVisibility,
  key: FlashcardVisibilitySetting,
): FlashcardVisibility {
  return { ...value, [key]: !value[key] };
}
