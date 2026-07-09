import test from "node:test";
import assert from "node:assert/strict";

import {
  flashcardMobileActionZoneClass,
  flashcardMobileAppModeA11y,
  flashcardMobileAppModeCopy,
  flashcardMobileAppModeKeyboardAction,
  flashcardMobileCardFrameClass,
  flashcardMobileCardWrapClass,
  flashcardMobileContentClass,
  flashcardMobileGestureHint,
  flashcardMobilePrimaryActionsClass,
  flashcardMobileStatusRowClass,
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

test("mobile app-mode hides duplicate chrome, enlarges the card, and keeps actions side by side", () => {
  assert.equal(flashcardMobileStatusRowClass(false), "flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400");
  assert.match(flashcardMobileStatusRowClass(true), /hidden/);
  assert.match(flashcardMobileStatusRowClass(true), /md:flex/);

  const frame = flashcardMobileCardFrameClass(true);
  assert.match(frame, /min-h-\[44dvh\]/);
  assert.match(frame, /rounded-\[2rem\]/);

  const actions = flashcardMobilePrimaryActionsClass(true);
  assert.match(actions, /grid-cols-2/);
  assert.match(actions, /w-full/);
});

test("mobile app-mode a11y state exposes dialog labelling only while fullscreen", () => {
  assert.deepEqual(flashcardMobileAppModeA11y(false), {
    role: "region",
    ariaModal: undefined,
    labelledBy: undefined,
    describedBy: undefined,
  });

  assert.deepEqual(flashcardMobileAppModeA11y(true), {
    role: "dialog",
    ariaModal: true,
    labelledBy: "flashcard-mobile-app-title",
    describedBy: "flashcard-mobile-app-desc",
  });
});

test("mobile app-mode keyboard action lets Escape close drawer before exiting app", () => {
  assert.equal(flashcardMobileAppModeKeyboardAction({ open: false, settingsOpen: false, key: "Escape" }), "none");
  assert.equal(flashcardMobileAppModeKeyboardAction({ open: true, settingsOpen: true, key: "Escape" }), "close-settings");
  assert.equal(flashcardMobileAppModeKeyboardAction({ open: true, settingsOpen: false, key: "Escape" }), "close-app");
  assert.equal(flashcardMobileAppModeKeyboardAction({ open: true, settingsOpen: false, key: "Enter" }), "none");
});

test("mobile app-mode gesture hint stays concise for revealed and unrevealed cards", () => {
  assert.equal(flashcardMobileGestureHint(false), "Tap to reveal · swipe right to reveal");
  assert.equal(flashcardMobileGestureHint(true), "Swipe left again · right easy");
});
