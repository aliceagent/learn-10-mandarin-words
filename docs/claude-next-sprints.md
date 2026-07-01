# Claude Code — Next Sprints

Five small, self-contained sprints. Each is scoped for **one Claude Code run under
30 turns**, is fully automatic (no external credentials, no payments, no fake data,
no network content), and preserves all existing app features.

Ground rules for every sprint:

- Do not deploy to Vercel or push to GitHub unless explicitly asked.
- Do not install packages unless absolutely necessary; prefer zero installs.
- Do not invent HSK levels, video URLs, analytics providers, or vocabulary content.
- Always finish by running the sprint's validation commands and confirming they pass.
- Keep the diff focused on the sprint's stated scope.

Recommended order: **Sprint 1 → 2 → 3 → 4 → 5**. Sprint 1 is the recommended first
run because it adds a safety net (tests) around the pure logic the later sprints touch.

---

## Sprint 1 — Unit tests for pure logic, data, and video utils

**Goal:** Add a lightweight, zero-network test suite around the pure functions that
already exist, so future refactors (SRS, tone parsing) are safe.

**Why it's small:** The functions are already pure and exported; this run only adds
tests and a script — no product behavior changes.

**Tasks:**
- Add Node's built-in test runner (`node --test`, no new dependency) targeting
  `.mjs`/`.test` files under `tests/`.
- Cover `src/lib/data.ts`: `getTopic`, `wordKey`, `allWords` counts,
  `recommendedPath` (falls back correctly when slugs are missing),
  `nextRecommendedTopic` (learned-topic skipping + final fallback).
- Cover `src/components/video-player.tsx` helpers by extracting `youtubeId`,
  `remoteMp4`, and `resolveSource` into a testable pure module
  (`src/lib/video.ts`) and re-importing them in the component (no behavior change).
- Cover `src/components/use-progress.ts` pure helpers: extract `normalizeProgress`,
  `uniqueToggle`, `computeStreak`, and the SRS interval math into
  `src/lib/progress-logic.ts` and test edge cases (empty state, legacy save
  without `onboarding`, streak across day boundaries).
- Add `"test": "node --test"` to `package.json` scripts.

**Files likely touched:** `package.json`, `tests/*.test.mjs` (new),
`src/lib/video.ts` (new), `src/lib/progress-logic.ts` (new),
`src/components/video-player.tsx`, `src/components/use-progress.ts`.

**Validation:**
```bash
npm run test
npm run validate:data
npm run lint
npm run build
```

**Acceptance criteria:**
- `npm run test` runs with no new dependency and all tests pass.
- Extractions are pure refactors: the components import the moved helpers and
  behavior is unchanged (build + lint stay green).
- Tests assert exact counts (100 topics, 1000 words) and the documented fallbacks.

---

## Sprint 2 — Tone parsing + tone-practice scaffolding (pinyin only)

**Goal:** Derive tone numbers from the **existing** tone-marked pinyin and add a
small, self-contained "tone check" practice widget on the topic page. No new
vocabulary, no audio content, no external data.

**Why it's small:** Pure string parsing over data already present; one new
component wired into an existing page.

**Tasks:**
- Add `src/lib/pinyin.ts` with pure functions: `toneOfSyllable(pinyin)` →
  1–4 or 5 (neutral), and `tonesOf(pinyin)` → number[] for multi-syllable words,
  using the same tone-mark table as `scripts/validate-data.mjs`.
- Add a `TonePractice` component: show a word's hanzi + pinyin with tone marks
  stripped, ask the user to pick the tone sequence, reveal correctness locally.
- Wire it as an optional panel on `/topics/[slug]` below the existing quiz;
  do not remove or alter the existing quiz.
- Reuse `src/lib/analytics.ts` `track()` with a new event (add
  `"tone_practice_completed"` to the `AnalyticsEvent` union).

**Files likely touched:** `src/lib/pinyin.ts` (new),
`src/components/tone-practice.tsx` (new), `src/components/topic-app.tsx`,
`src/lib/analytics.ts`, `tests/pinyin.test.mjs` (new, if Sprint 1 landed).

**Validation:**
```bash
npm run test   # if present
npm run lint
npm run build
```

**Acceptance criteria:**
- Tone parsing handles multi-syllable words, `ü`/`v`, and neutral tone.
- The tone widget is additive; all existing topic-page features still work.
- No hardcoded per-word tone data — tones are derived from existing pinyin.

---

## Sprint 3 — SRS algorithm improvement + safe migration

**Goal:** Replace the ad-hoc interval math in `use-progress.ts` with a clearer,
documented SM-2-style scheduler, and migrate existing saved `flashcardStats`
without data loss.

**Why it's small:** One localized algorithm change plus a versioned migration;
mostly pure logic.

**Tasks:**
- Extract current SRS math (`gradeWord`) into a pure `scheduleReview(stat, grade,
  now)` function (in `src/lib/progress-logic.ts` if Sprint 1 landed, else new file).
- Implement a documented SM-2-ish update: track `ease`, `intervalDays`,
  `reviewCount`, `dueAt`; clamp ease to a sane floor; keep the existing
  `"again" | "hard" | "good" | "easy"` grades.
- Add a `schemaVersion` field to `ProgressState` and a one-time migration in
  `normalizeProgress` that upgrades old saves (missing fields get sensible
  defaults; never throw; never drop favorites/learned topics).
- Update `src/lib/types.ts` accordingly.

**Files likely touched:** `src/components/use-progress.ts`, `src/lib/types.ts`,
`src/lib/progress-logic.ts`, `tests/progress-logic.test.mjs`.

**Validation:**
```bash
npm run test   # if present
npm run lint
npm run build
```

**Acceptance criteria:**
- Loading a pre-migration save (no `schemaVersion`, no `onboarding`) yields a
  valid state with all prior favorites/learned topics intact.
- New scheduling is deterministic given a fixed `now` and covered by tests.
- Review page (`/review`) behavior remains correct; no feature removed.

---

## Sprint 4 — Local video mapping workflow polish

**Goal:** Make the existing `scripts/map-videos.mjs` workflow robust and
documented for the day real, locally generated MP4s exist under `public/videos/`.
No real URLs invented; work only with placeholders and a dry-run.

**Why it's small:** Tightens an existing script + docs; adds a `--dry-run` and a
local-file mode. No app UI changes required.

**Tasks:**
- Add a `--dry-run` flag to `scripts/map-videos.mjs` that reports what *would*
  change without writing `topics.json`.
- Support a local mode: when a map entry is `{ "provider": "mp4", "source":
  "/videos/<slug>.mp4" }` and the file exists under `public/videos/`, promote it;
  if the file is missing, emit a warning and skip (never write a broken path).
- Extend `scripts/validate-data.mjs` to optionally verify that any `video`
  metadata with a local `/videos/*.mp4` source has a corresponding file in
  `public/videos/` (warning only, so CI stays green when videos aren't present).
- Update the README "Video integration" section and `scripts/videos.example.json`
  to document the local-file + dry-run flow.

**Files likely touched:** `scripts/map-videos.mjs`, `scripts/validate-data.mjs`,
`scripts/videos.example.json`, `README.md`.

**Validation:**
```bash
npm run map:videos -- --dry-run   # against a temporary local map
npm run validate:data
npm run lint
npm run build
```

**Acceptance criteria:**
- `--dry-run` prints a summary and writes nothing.
- Missing local files are warned about and skipped, never written as broken paths.
- No real/placeholder URLs are committed into `topics.json`.

---

## Sprint 5 — Accessibility, focus, and keyboard pass

**Goal:** A focused a11y sweep over the interactive surfaces added recently
(onboarding modal, install prompt, video placeholder, quizzes) without visual
redesign.

**Why it's small:** Attribute/handler-level changes to existing components.

**Tasks:**
- Trap focus within `OnboardingModal` while open, restore focus to the trigger on
  close, and close on `Escape`; ensure `aria-modal`/labelling is complete.
- Ensure the PWA install prompt and bottom nav are keyboard reachable with visible
  focus rings; add `:focus-visible` styles in `globals.css` where missing.
- Audit quiz option buttons and flashcard grade controls for `aria-pressed` /
  `aria-label` correctness and keyboard operability (Enter/Space).
- Verify all interactive targets meet a 44px minimum tap size and that decorative
  SVGs are `aria-hidden`.

**Files likely touched:** `src/components/onboarding.tsx`,
`src/components/pwa-register.tsx`, `src/components/topic-app.tsx`,
`src/components/review-app.tsx`, `src/components/bottom-nav.tsx`,
`src/app/globals.css`.

**Validation:**
```bash
npm run lint
npm run build
# Manual: keyboard-only walkthrough of home → onboarding → topic quiz → review
```

**Acceptance criteria:**
- Onboarding modal traps focus, closes on Escape, and restores focus on close.
- Every interactive control is reachable and operable by keyboard with a visible
  focus indicator.
- No visual regressions and no existing feature removed.
