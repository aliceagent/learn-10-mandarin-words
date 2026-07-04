/**
 * Shared copy for the branded failure screens (404 / error boundaries).
 *
 * Kept as a pure, dependency-free module so it can be imported by both server
 * files (`not-found.tsx`) and client files (`error.tsx`, `global-error.tsx`),
 * and exercised directly under `node --test`.
 *
 * The featured word is REAL dataset vocabulary — the "sorry" entry from the
 * `ten-ways-to-apologize` topic in `src/data/topics.json`. A failure screen
 * that literally teaches a word stays on-brand and invents nothing.
 * `tests/error-copy.test.mjs` asserts this stays in sync with the dataset.
 */

export type ErrorWord = {
  hanzi: string;
  pinyin: string;
  english: string;
  /** Real topic slug in src/data/topics.json this word is drawn from. */
  topicSlug: string;
};

export type ScreenCopy = { title: string; body: string };

export const ERROR_WORD: ErrorWord = {
  hanzi: "对不起",
  pinyin: "duì bu qǐ",
  english: "sorry",
  topicSlug: "ten-ways-to-apologize",
};

/** Root 404: any unmatched URL app-wide. */
export const NOT_FOUND_COPY: ScreenCopy = {
  title: "Page not found",
  body: "This page doesn't exist — but your saved progress does. Everything you've learned is safe on your device.",
};

/** Contextual 404 for an unknown topic slug (topics/[slug]/not-found). */
export const LESSON_NOT_FOUND_COPY: ScreenCopy = {
  title: "Lesson not found",
  body: "That lesson isn't in the library. Pick a starter topic below, or head back to browse every list. Your saved progress is safe on your device.",
};

/** Contextual 404 for an unknown category slug (categories/[slug]/not-found). */
export const CATEGORY_NOT_FOUND_COPY: ScreenCopy = {
  title: "Category not found",
  body: "That category isn't in the library. All topics are waiting back at the home screen, and your saved progress is safe on your device.",
};

/** Runtime error boundary (error.tsx / global-error.tsx). */
export const ERROR_COPY: ScreenCopy = {
  title: "Something went wrong",
  body: "An unexpected error interrupted this page. Your progress is stored in your browser and hasn't been touched.",
};
