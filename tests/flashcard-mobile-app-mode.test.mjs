import test from "node:test";
import assert from "node:assert/strict";

import { flashcardMobileAppModeCopy, flashcardMobileShellClass } from "../src/lib/flashcard-mobile-app-mode.ts";

test("flashcardMobileAppModeCopy describes embedded vs fullscreen state", () => {
  assert.deepEqual(flashcardMobileAppModeCopy(false), {
    title: "Cards",
    action: "Open full-screen cards",
    ariaLabel: "Open flashcards in a full-screen mobile practice view",
  });

  assert.deepEqual(flashcardMobileAppModeCopy(true), {
    title: "Flashcards",
    action: "Exit",
    ariaLabel: "Exit full-screen flashcard practice",
  });
});

test("flashcardMobileShellClass switches between embedded and mobile fixed app shell", () => {
  assert.equal(
    flashcardMobileShellClass(false),
    "mt-4 rounded-3xl border border-white/10 bg-surface p-3 text-center md:mt-6 md:p-6",
  );

  const fullscreen = flashcardMobileShellClass(true);
  assert.match(fullscreen, /fixed/);
  assert.match(fullscreen, /inset-0/);
  assert.match(fullscreen, /h-\[100dvh\]/);
  assert.match(fullscreen, /z-\[80\]/);
  assert.match(fullscreen, /md:static/);
});
