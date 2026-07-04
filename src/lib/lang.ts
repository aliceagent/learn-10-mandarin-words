// BCP-47 language tags and helpers for marking rendered Chinese / pinyin text.
//
// Every element that renders hanzi or pinyin should carry a `lang` attribute so
// screen readers switch to a Chinese voice for hanzi (instead of spelling out
// Unicode) and stop applying English pronunciation/spellcheck rules to pinyin,
// and so browsers pick the correct Han glyph variants. The document root stays
// `lang="en"` (the page chrome is English); these tags apply per-element.
//
// Pure and DOM-free so the constants/helpers can be unit-tested under
// `node --test`. `QuizMode` is a type-only import (erased at runtime, so the
// `@/` alias never needs resolving in the Node test runner).
import type { QuizMode } from "@/lib/quiz-logic";

/** BCP-47 tag for rendered Simplified Chinese (hanzi). */
export const HANZI_LANG = "zh-Hans";

/** BCP-47 tag for Hanyu Pinyin (IANA-registered `pinyin` variant of zh-Latn). */
export const PINYIN_LANG = "zh-Latn-pinyin";

/**
 * lang for a quiz prompt: hanzi in every mode except `english-hanzi`, whose
 * prompt is the English meaning and should inherit the root `lang="en"`.
 * Returns `undefined` (not `"en"`) so React omits the attribute entirely.
 */
export function quizPromptLang(mode: QuizMode): string | undefined {
  return mode === "english-hanzi" ? undefined : HANZI_LANG;
}

/**
 * lang for a quiz choice, keyed off which field supplies the answer:
 * hanzi in `english-hanzi`, pinyin in `hanzi-pinyin`, and English (→ inherit)
 * in `hanzi-english` / `listening`.
 */
export function quizChoiceLang(mode: QuizMode): string | undefined {
  switch (mode) {
    case "english-hanzi":
      return HANZI_LANG;
    case "hanzi-pinyin":
      return PINYIN_LANG;
    default:
      return undefined;
  }
}
