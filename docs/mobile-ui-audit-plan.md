# Mobile UI Audit and Fix Plan

Last updated: 2026-07-08

## Design read

Reading this as: mobile-first learning product UI for short repeated Mandarin practice sessions, with a clean utility-app language, prioritizing thumb reach, one-screen task focus, low scrolling, and fast repeat actions over decorative visual density.

Dial values:
- Design variance: 4, predictable and stable for learning
- Motion intensity: 2, feedback only
- Visual density: 6, compact enough for mobile, but not cramped

## Mobile QA viewport

Primary viewport: iPhone-style 390x844.
Secondary spot checks: 360x740 and 430x932.

## Feature inventory

### Global shell
- Bottom navigation: Home, Path, Review, Favorites, Stats
- Theme toggle
- Tone color toggle
- Hanzi size control
- Haptics toggle
- PWA/update/offline states
- Toasts
- Share dialogs
- Saved/offline lesson controls

### Library and discovery
- Home/library page
- Resume card
- Recent topics shelf
- Lesson finder/search
- Category chips and category sections
- Topic cards
- Teacher/learner explanation copy
- Onboarding and first-lesson discovery
- Category pages
- Path page

### Topic lesson page
- Topic header and progress
- Mode tabs
- Words tab
- Phrasebook tab for useful phrases
- Flashcards tab
- Quiz tab
- Typed recall tab
- Matching pairs tab
- Memory tab
- Cloze tab
- Sentence scramble tab
- Sentence listen tab
- Boss round tab
- Cheat sheet
- Listen-all bar
- Character connections
- Video player where present

### Practice/review surfaces
- Review due cards
- Rescue review mode
- Redrill panel
- Comeback page
- Daily challenge
- Lightning practice
- Duel mode
- Tone pairs
- Tone listen trainer

### Personal data surfaces
- Favorites page
- Stats page
- Achievements shelf
- Study heatmap
- Review forecast
- Settings page
- Privacy page
- Offline page
- Error/not-found screens

## Audit findings and implementation backlog

Status key:
- pending: not yet audited/fixed
- in_progress: current heartbeat item
- fixed: implemented and committed
- deployed: live in production

### M1. Flashcards one-screen repeated-action layout
Status: fixed
Severity: high
Feature area: Topic lesson page, Flashcards tab
Problem:
- Repetitive flashcard practice required scrolling because configuration sections appeared above the card.
- Primary practice loop should fit in one mobile screen: prompt, reveal/known action, grading, and minimal context.
- Current controls pushed the actual card and grading actions down.
Plan:
- Make flashcard practice mobile-first.
- Collapse Health, Direction, Deck order, and Hints behind compact disclosure controls on mobile.
- Keep the core card, confidence, reveal, known, grading, and progress visible without vertical hunting.
- Preserve full controls on larger screens.
- Add pure helper tests for mobile panel grouping/copy if needed, then QA via 390x844 screenshot.
What changed:
- Moved mobile Health, Direction, Deck order, Card hints, and rescue note controls into a collapsed Practice settings disclosure below the core loop.
- Kept the desktop settings/dashboard layout visible above the card at `md` and up.
- Tightened mobile flashcard panel padding, card height, control spacing, and grade button grid so the repeated prompt/action loop is compact on 390px screens.
- Added `compactFlashcardSettingsSummary` with focused tests for the mobile disclosure summary chips.
Evidence:
- `dogfood-output/mobile/screenshots/m1-flashcards-after-top.png` (390x844 top-of-page capture; Chromium harness starts at the page top and does not scroll to the below-fold flashcard panel, so the panel fix was verified by code inspection, build, and responsive layout reasoning.)
QA:
- Focused test: `node --test tests/flashcard-mobile-settings.test.mjs` passed.
- Build spot check: `npm run build` passed.
Next:
- M2. Topic page mode tabs mobile density.

### M2. Topic page mode tabs mobile density
Status: fixed
Severity: high
Feature area: Topic lesson page, all modes
Problem:
- Many practice modes compete horizontally/vertically and can make it hard to jump between the main tasks.
Plan:
- Audit the tab strip on 390px.
- Prefer a compact horizontally scrollable segmented control or prioritized mobile mode menu.
- Keep Words/Cards/Quiz high-priority.
- Ensure active mode is obvious and reachable.
What changed:
- Added `mobileTopicModeGroups` to keep Words, Cards, and Quiz in the mobile primary row, with Phrasebook added first for phrase topics.
- Moved the mobile practice mode control directly below the sticky topic header so repeated-action modes are reachable before the hero/video content.
- Collapsed advanced modes behind a compact More modes disclosure on mobile while preserving the full desktop tab strip at `md` and up.
Evidence:
- `dogfood-output/mobile/screenshots/m2-tabs-before-top.png` showed the top mobile viewport reached the lesson hero and action buttons before mode switching.
- `dogfood-output/mobile/screenshots/m2-tabs-after-top.png` shows Words, Cards, Quiz, and More modes immediately below the sticky topic header at 390x844.
QA:
- Focused test: `node --test tests/topic-mode-logic.test.mjs` passed.
- Full gate passed: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.
Next:
- M3. Quiz and duel answer grids on mobile.

### M3. Quiz and duel answer grids on mobile
Status: fixed
Severity: medium
Feature area: Quiz, Daily, Lightning, Duel
Problem:
- Large Chinese prompts plus answer grids can overflow, especially with bottom nav.
Plan:
- Audit each quiz-like surface at 390x844.
- Reduce nonessential chrome while answering.
- Keep answer buttons in thumb range and visible without scrolling where possible.
What changed:
- Collapsed the topic quiz sub-mode selector into a mobile disclosure so the question loop starts higher on 390px screens.
- Tightened mobile quiz, daily challenge, lightning, and duel spacing: smaller top padding, compact prompt scale, shorter pinyin spacing, 48px answer buttons, and denser answer grids.
- Made post-answer Next/Pass controls full-width on narrow screens so the primary action stays easy to hit above the bottom nav.
- Added extra mobile bottom padding on standalone quiz-like routes to protect controls from the fixed bottom navigation.
Evidence:
- `dogfood-output/mobile/screenshots/m3-topic-quiz-before-top.png`
- `dogfood-output/mobile/screenshots/m3-topic-quiz-after-top.png`
- `dogfood-output/mobile/screenshots/m3-daily-before-top.png`
- `dogfood-output/mobile/screenshots/m3-daily-after-top.png`
- `dogfood-output/mobile/screenshots/m3-lightning-before-top.png`
- `dogfood-output/mobile/screenshots/m3-lightning-after-top.png`
- `dogfood-output/mobile/screenshots/m3-duel-before-top.png`
- `dogfood-output/mobile/screenshots/m3-duel-after-top.png`
- Chromium top-of-page captures do not wait for localStorage-backed loading screens on Daily, Lightning, and Duel, and the topic screenshot still starts above the below-fold quiz panel. The active-panel fix was verified by code inspection, build, and responsive layout reasoning.
QA:
- Full gate passed: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.
Next:
- M4. Review/rescue session flow on mobile.

### M4. Review/rescue session flow on mobile
Status: fixed
Severity: medium
Feature area: Review, Comeback, Redrill
Problem:
- Review cards and rescue copy may require repeated vertical movement.
Plan:
- Audit due-review and rescue states.
- Compact explanatory banners after first use.
- Keep prompt, answer, and grading controls together.
What changed:
- Tightened mobile Review and Comeback page chrome: smaller top padding, smaller mobile headings, shorter active-session copy, and extra bottom padding for fixed nav clearance.
- Moved review tone-color and Hanzi-size controls out of the core mobile loop into a collapsed Practice options disclosure while preserving the desktop controls above the card.
- Hid the full rescue banner on active mobile review sessions and exposed rescue as a compact Practice options action below the card, so prompt and reveal/grading stay higher.
- Compactified active Review, Comeback, and Redrill cards: smaller mobile card heights, prompt scale, spacing, answer grids, and full-width next action where useful.
- Removed duplicated empty-state Comeback guidance and replaced it with one clear instruction.
Evidence:
- `dogfood-output/mobile/screenshots/m4-review-before-top.png`
- `dogfood-output/mobile/screenshots/m4-review-after-top.png`
- `dogfood-output/mobile/screenshots/m4-comeback-before-top.png`
- `dogfood-output/mobile/screenshots/m4-comeback-after-top.png`
- Chromium top-of-page captures show empty states by default because this local-first app depends on browser progress. Active Review/Comeback/Redrill loop fixes were verified by code inspection, lint, build, and responsive layout reasoning.
QA:
- Full gate passed: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.
Next:
- M5. Home discovery density on mobile.

### M5. Home discovery density on mobile
Status: fixed
Severity: medium
Feature area: Home/library
Problem:
- Home now has resume, finder, stats, category sections, and topic cards. Need ensure the primary next action is above the fold and search is not buried.
Plan:
- Audit home first 2 mobile screens.
- Reduce or collapse lower-priority intro copy.
- Preserve next lesson/resume as the dominant primary action.
What changed:
- Compactified the mobile hero: smaller top padding, shorter value copy, two one-line CTAs, and a three-cell mobile library summary instead of the full desktop stats panel.
- Kept the detailed Today's snapshot card for `md` and up, so mobile learners reach discovery faster while desktop keeps the richer overview.
- Pulled the Find section closer to the hero on mobile, reduced the section heading scale, made search/select 44px+ controls, and changed category chips to horizontal scroll instead of a multi-row block.
- Limited starter lesson cards to the first two on mobile while preserving the full starter grid on larger screens.
Evidence:
- `dogfood-output/mobile/screenshots/m5-home-before-top.png`
- `dogfood-output/mobile/screenshots/m5-home-after-top.png`
- `dogfood-output/mobile/screenshots/m5-home-after-find.png`
- `dogfood-output/mobile/screenshots/m5-home-after-static-top.png`
- Chromium top-of-page captures keep showing the first-run onboarding modal from localStorage state, so normal home/finder positioning was verified by code inspection, build, and responsive layout reasoning.
QA:
- Full gate passed: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.
Next:
- M6. Topic cards and category pages mobile scanning.

### M6. Topic cards and category pages mobile scanning
Status: pending
Severity: medium
Feature area: Home/category/topic cards
Problem:
- Cards may contain too much metadata for fast mobile scanning.
Plan:
- Audit card height and visual hierarchy.
- Make progress/status compact and consistent.
- Ensure tap targets remain 44px+.

### M7. Stats/settings mobile hierarchy
Status: pending
Severity: low
Feature area: Stats and settings
Problem:
- Dense panels may be acceptable, but need audit for stacked-card fatigue and bottom-nav clearance.
Plan:
- Audit Stats and Settings at 390x844.
- Reduce repeated borders/cards if needed.
- Keep export/import/settings controls clear and safe.

### M8. Bottom nav and safe-area clearance
Status: pending
Severity: medium
Feature area: Global shell
Problem:
- Fixed bottom nav can cover lower actions if page padding is insufficient.
Plan:
- Audit all major surfaces for final action visibility above bottom nav.
- Add consistent bottom padding token for mobile practice surfaces.

### M9. Mobile regression and production deployment
Status: pending
Severity: required
Feature area: QA/deployment
Plan:
- After all fixes, run full gate:
  - npm run test
  - npm run validate:data
  - npm run validate:quality
  - npm run lint
  - npm run build
- Generate final mobile screenshots for key flows.
- Push main.
- Deploy Vercel production.
- Smoke-check live pages.

## Heartbeat rules

Each heartbeat run must:
1. Read this file and git log/status.
2. Pick the first pending M item.
3. Audit it with 390x844 mobile viewport screenshots using local Chromium or equivalent.
4. Implement that item only.
5. Run focused tests where code behavior is changed.
6. Run full gate before commit unless the run only updates this plan/audit docs.
7. Commit with `mobile ux: ...` after the full gate passes.
8. Update this file's status for the completed item.
9. Send a concise update to Telegram topic `telegram:-1003799241063:802`.
10. After M9 deploys production, remove/pause the heartbeat.

## Current production baseline

Latest known live commit before this project:

```text
a39d8f3 flashcards sprint 10: add health dashboard
```
