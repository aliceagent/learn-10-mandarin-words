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
Status: pending

Optimize the fullscreen content hierarchy:
- compact top bar
- card area sized with flex, not page scroll
- reveal / known / grade controls pinned to the app bottom action zone
- keep 44px tap targets
- ensure card + actions fit in 390x844 and 390x700-ish viewports

QA: screenshot evidence at 390x844 and full gate.

### F3 - Mobile settings drawer
Status: pending

Move non-core controls into a lightweight in-app Settings panel:
- direction
- deck order
- hints/pinyin/English visibility
- health summary
- rescue/session summary placement

QA: settings interaction smoke + full gate.

### F4 - Accessibility, gestures, and exit polish
Status: pending

Polish the app-mode interactions:
- ESC/back affordance if feasible
- focus management on open/close
- aria labels/descriptions
- gesture hints fit without clutter
- reduced-motion behavior still clean

QA: keyboard/AT inspection, lint/build/full gate.

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
