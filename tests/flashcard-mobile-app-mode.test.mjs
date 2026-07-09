import test from "node:test";
import assert from "node:assert/strict";

import {
  flashcardMobileActionZoneClass,
  flashcardMobileAppModeCopy,
  flashcardMobileCardWrapClass,
  flashcardMobileContentClass,
  flashcardMobileShellClass,
} from "../src/lib/flashcard-mobile-app-mode.ts";

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
  assert.match(fullscreen, /flex/);
  assert.match(fullscreen, /flex-col/);
  assert.match(fullscreen, /md:static/);
});

test("mobile app-mode layout classes reserve flexible card space and a bottom action zone", () => {
  assert.equal(flashcardMobileContentClass(false), "");

  const content = flashcardMobileContentClass(true);
  assert.match(content, /flex/);
  assert.match(content, /min-h-0/);
  assert.match(content, /flex-1/);
  assert.match(content, /flex-col/);

  const card = flashcardMobileCardWrapClass(true);
  assert.match(card, /flex-1/);
  assert.match(card, /min-h-0/);
  assert.match(card, /items-center/);

  const actions = flashcardMobileActionZoneClass(true);
  assert.match(actions, /shrink-0/);
  assert.match(actions, /pb-1/);
});
