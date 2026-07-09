# Flashcards mobile app-mode plan

Goal: On mobile, entering the Cards tab should feel like launching a focused fullscreen practice app. It should use the whole viewport, hide normal page chrome, keep the repeated action loop inside one screen, and provide an obvious Exit button that returns the learner to the normal lesson page.

## Design target

- Mobile only by default. Desktop keeps the existing embedded flashcards panel.
- A learner taps an entry control, then the flashcard session becomes a fixed fullscreen surface.
- Fullscreen surface uses `100dvh`, safe-area padding, and no bottom nav overlap.
- Top bar contains compact progress and an explicit `Exit` button.
- Main area prioritizes card content and reveal/grading controls.
- Advanced settings live behind a compact settings drawer/disclosure.
- Exit returns to the lesson page without losing current card/progress.
- Accessibility: region/dialog semantics, focusable Exit, ESC support when practical, screen-reader label.

## Sprints

### F1 - Mobile app-mode shell and Exit
Status: complete

Added the state model and mobile-only fullscreen shell:
- pure helper for CSS/state labels
- mobile launch button in the embedded Cards tab
- fixed `inset-0 z-*` mobile shell once launched
- explicit Exit button
- body scroll lock while app-mode is open
- desktop remains embedded

QA:
- `npm run test -- tests/flashcard-mobile-app-mode.test.mjs` ✅
- `npm run lint` ✅
- `npm run build` ✅
- full gate (`npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`) ✅

### F2 - One-screen practice layout
Status: complete

Optimized the fullscreen content hierarchy:
- shell is a flex column using the full `100dvh`
- compact top area stays fixed at the top of the app surface
- card area gets flexible `min-h-0 flex-1` space
- reveal / known / grade controls live in a shrink-wrapped bottom action zone
- embedded desktop/mobile mode remains unchanged outside fullscreen
- mobile settings disclosure is hidden in app-mode until F3 replaces it with a proper drawer

QA:
- `npm run test -- tests/flashcard-mobile-app-mode.test.mjs` ✅
- `npm run lint` ✅
- `npm run build` ✅
- Browser tool timed out on local dev, so visual screenshot evidence is deferred to F3/F5; this sprint is backed by helper tests, TypeScript build, and layout code inspection.
- full gate (`npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`) ✅

### F3 - Mobile settings drawer
Status: complete

Moved non-core controls into a lightweight in-app Settings drawer inside fullscreen mobile app-mode:
- explicit Settings button next to Exit in the fullscreen top bar
- drawer open/close copy and positioning covered by pure helper tests
- direction, deck order, card hints/pinyin/English visibility controls in the drawer
- compact health summary plus optional health metrics
- rescue note or session-complete summary surfaced inside the drawer
- embedded mobile settings outside fullscreen remain unchanged

QA:
- RED verified: `npm run test -- tests/flashcard-mobile-settings.test.mjs` failed on missing drawer helper exports ✅
- `npm run test -- tests/flashcard-mobile-settings.test.mjs` ✅
- `npm run test -- tests/flashcard-mobile-settings.test.mjs tests/flashcard-mobile-app-mode.test.mjs` ✅
- `npm run lint` ✅
- `npm run build` ✅
- full gate (`npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`) ✅

### F4 - Accessibility, gestures, and exit polish
Status: complete

Polished the app-mode interactions:
- fullscreen shell now uses explicit dialog labelling/description only while launched
- Exit advertises Escape and the shell handles Escape to close settings first, then exit app-mode
- focus moves to Exit on launch, into the settings drawer when opened, back to Settings when drawer Escape closes, and back to the launcher after exiting
- concise mobile gesture hints explain tap/reveal and swipe grading without cluttering the card loop
- reduced-motion path remains instant for fling grading, with motion-reduce-safe app controls

QA:
- RED verified: `npm run test -- tests/flashcard-mobile-app-mode.test.mjs` failed on missing a11y/keyboard/gesture helper exports ✅
- `npm run test -- tests/flashcard-mobile-app-mode.test.mjs` ✅
- `npm run test -- tests/flashcard-mobile-app-mode.test.mjs tests/flashcard-mobile-settings.test.mjs` ✅
- `npm run lint` ✅
- `npm run build` ✅
- full gate (`npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`) ✅

### F5 - Production deploy and live smoke
Status: pending

After F1-F4 are complete:
- final full QA gate
- mobile screenshot regression
- push main
- deploy Vercel production
- smoke home/topic flashcards/favorites/search-index

## Notes

This plan deliberately does not rely on browser fullscreen APIs. It uses an app-like fixed viewport surface because browser fullscreen is inconsistent and intrusive on mobile web.
