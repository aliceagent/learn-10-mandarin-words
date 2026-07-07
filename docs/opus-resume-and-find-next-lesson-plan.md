# Opus Plan — Resume Last Activity & Find Your Next Lesson

**Author:** Claude Code Opus (planning pass)
**Date:** 2026-07-07
**Scope:** Make the front page work as a public product for learners and teachers: a clear *resume* path back into the last thing practiced, a clear *find the lesson you need* path, and clearer public-product framing/onboarding.
**Architecture guardrails (unchanged):** free · static · local-first. No backend, database, login, paid services, external provider dependencies, or tracking services. All state stays in the existing `localStorage` progress blob (`learn-10-mandarin-progress-v1`). No changes to `src/data/topics.json`. No invented vocabulary.

---

## 1. Problem statement (from Jonathan)

1. There is no good way to **jump back into the last thing** the learner was playing/practicing.
2. It is **not clear enough how to find the lesson** the learner needs from the front page.
3. The **front page should read as a public product** for a learner/teacher: clearer entry points, clearer next lesson, clearer resume path.

## 2. What already exists (grounded in the code)

I inspected the live codebase before planning. The relevant machinery already shipped:

| Capability | Where | Notes |
| --- | --- | --- |
| Recently-opened topics (slugs only) | `src/lib/progress-logic.ts:329` `recordRecentTopic`; persisted field `recentTopics` (`types.ts:205`, schema **v10**) | Cap `RECENT_TOPICS_MAX = 8` (`progress-logic.ts:73`); most-recent-first, deduped. |
| "Jump back in" shelf (3 cards) | `src/components/recent-topics-shelf.tsx` (`RecentTopicsShelf`), rendered by `home-app.tsx` via `resolveRecentTopics(topics, progress.recentTopics)` (`data-logic.ts:217`) | Links to `/topics/{slug}`, shows `{studied}/10 studied`. Renders nothing when history is empty. |
| Topic visit recording | `topic-app.tsx:162-165` effect → `recordTopicVisit(slug)` (`use-progress.ts:183-186`) | Records the slug **only** — never `studiedDates`/`dailyActivity`. Referential no-op keeps the effect loop-free. |
| Next-lesson recommendation | `nextRecommendedTopic(topics, learnedTopics)` (`data-logic.ts:179`), `nextTopicAfter` (`data-logic.ts:196`), `recommendedPath` (`data-logic.ts:168`) | Drives `ContinueLearningCard` (`onboarding.tsx:161`). |
| Word/topic search | `searchWords(topics, query, {categorySlug})` (`src/lib/search-logic.ts`), diacritic-tolerant via `normalizePinyin` (`highlight.ts`) | Home library search box lazy-loads `/search-index.json` on focus. |
| First-run onboarding | `OnboardingModal` (`onboarding.tsx:27`); `onboarding` state (`types.ts:139` `OnboardingState`) | Goal picker (Casual 5 / Steady 10 / Serious 20) → routes to a starter `/topics/{slug}`. |
| Progress hook + persistence | `use-progress.ts` — `STORAGE_KEY = "learn-10-mandarin-progress-v1"` (line 30); `normalizeProgress` migration (`progress-logic.ts:357`), `CURRENT_PROGRESS_SCHEMA_VERSION = 11` (line 50). | Every mutator returns a new state or a referential no-op; import/export round-trips through `normalizeProgress`. |

### The core gaps

1. **Practice mode is not addressable or persisted.** In `topic-app.tsx:71` the mode is local React state — one of `phrasebook | words | flashcards | quiz | typed | match | memory | cloze | scramble | sentence-listen | boss` — plus `quizMode` (`hanzi-english | english-hanzi | hanzi-pinyin | listening`, line 76). The URL never changes when you switch modes, and nothing is stored. **Reloading or coming back always drops you on `words`/`phrasebook`.** So "jump back into the last thing I was *playing*" is impossible today — the shelf only knows the topic, not the activity.
2. **The front page buries findability.** The search box lives in the "Vocabulary library" section far down the page (`home-app.tsx` library section), below hero, banners, feature grid, and category grid. A learner/teacher who lands cold cannot quickly answer "how do I find *my* lesson?"
3. **Two competing "resume" affordances, neither adaptive.** `ContinueLearningCard` shows the *recommended next* topic; `RecentTopicsShelf` shows *recently opened* topics. Neither is a single, obvious "pick up exactly where you left off" action in the hero.
4. **No public-product framing.** No "what is this / how it works" for a first-time learner or a teacher evaluating the tool.

## 3. Design approach

- **Reuse the progress blob.** One new persisted field, `lastActivity`, added via the established schema-migration pattern (v11 → v12). No new storage keys.
- **Make practice modes URL-addressable** (`/topics/{slug}?m={mode}`), so a stored resume target is just an href — sharable, static-friendly, and re-usable by the shelf, the hero, and teachers linking a specific drill.
- **One canonical mode registry** (labels + valid ids) so the union in `topic-app.tsx:71` stops being duplicated across surfaces.
- **Pure logic first.** Every decision (what to resume, which CTA to show, which starter lessons to surface) lands in a pure `src/lib/*-logic.ts` helper with `node --test` coverage, mirroring the house pattern (`progress-logic.ts`, `search-logic.ts`, `session-logic.ts`).
- **Copy-only UI changes stay copy-only.** No visual framework churn; Tailwind classes already in `home-app.tsx` are reused.

---

## 4. Roadmap at a glance

| # | Sprint | Primary theme | Ships | New persisted state | New pure module |
| --- | --- | --- | --- | --- | --- |
| 1 | URL-addressable practice modes | Continue last practice mode/topic | `?m=` deep links into any topic mode; shared mode registry | none | `topic-mode-logic.ts` |
| 2 | Persist & resume last activity | Resume last activity | `lastActivity` recorded on every mode switch; home "Resume where you left off" card | `lastActivity` (schema **v12**) | `resume-logic.ts` |
| 3 | Adaptive hero primary action | Front-page findability + resume | Hero shows one smart action (Resume / Continue / Start) + explainer line | none | `home-cta-logic.ts` |
| 4 | Front-page lesson finder | Front-page findability | "Find your lesson" search + category chips + starter lessons, lifted near the top | none | `lesson-finder-logic.ts` |
| 5 | Learner/teacher clarity | Learner/teacher clarity | "How it works" 3-step strip; clearer lesson-card status/metadata | none | `lesson-card-logic.ts` |
| 6 | Onboarding → first-lesson discovery | Public-product onboarding/lesson discovery | Onboarding routes into a "pick your first lesson" step; returning visitors offered resume | none | `onboarding-next-logic.ts` |

**Dependency chain:** 1 → 2 → 3; 4 is independent of 2/3 but benefits from 1; 5 and 6 layer on top. Build strictly in order.

## 5. Success metrics (all measurable locally, no tracking service)

The repo already has a local, no-network `track()` shim (`src/lib/analytics.ts`) used for dev-only events (e.g. `recent_topic_resumed`, `daily_goal_met`). Metrics below are validated through **unit tests on pure logic** and **manual QA**, plus optional local dev-only `track()` events — never an external analytics provider.

1. **Resume works:** From a cold reload, a learner who last did `quiz` on topic X can return to `quiz` on topic X in **one tap** from the front page. (QA + `resume-logic` tests.)
2. **Mode is addressable:** `/topics/{slug}?m=flashcards` opens directly on Flashcards; an unknown/absent `m` falls back to the topic default with no error. (`topic-mode-logic` tests + QA.)
3. **Findability is above the fold:** The lesson finder (search + chips) is reachable without scrolling past the hero on a laptop viewport. (QA.)
4. **Clarity:** A first-time visitor can state, from the front page alone, (a) what the product does and (b) the 3-step loop (Watch → Practice → Review). (QA copy review.)
5. **No regressions:** `npm test`, `npm run lint`, `npm run build`, `npm run validate:data` all green; schema migration preserves every existing field for legacy saves (`progress-logic.test.mjs` extended). Zero changes to `topics.json`.

## 6. Shared validation gate (run at the end of every sprint)

```bash
npm run validate:data     # prebuild dataset check (must stay green; we never touch topics.json)
npm test                  # node --test over tests/*.test.mjs
npm run lint              # eslint
npm run build             # next build (also runs validate:data via prebuild)
```

Per the task rules: **do not commit** — leave changes uncommitted for Hermes verification. Read `AGENTS.md` and the relevant guide under `node_modules/next/dist/docs/` before any framework-sensitive edit (routing, `useSearchParams`, `router.replace`, Suspense).

---

# Sprint 1 — URL-addressable practice modes

### Product goal
Make every topic practice mode reachable and shareable by URL (`/topics/{slug}?m={mode}`), and centralize the mode list into one registry. This is the foundation the resume feature deep-links into, and it independently lets a teacher hand a learner a link straight to, say, Flashcards or the Boss round.

### User story
> As a learner, when I open `/topics/ten-types-of-drinks?m=quiz`, I land directly on the Quiz for that topic — and when I switch modes, the URL updates so I can bookmark or share exactly this drill.

### Current-state findings
- Mode is local state only: `topic-app.tsx:71` (`const [mode, setMode] = useState<…>(isPhrasebook ? "phrasebook" : "words")`), `quizMode` at `topic-app.tsx:76`. The 11-member union is inlined here and nowhere reusable.
- The URL never reflects the mode; nothing reads `useSearchParams`. Switching topics resets mode via the "adjust state while rendering" block (`topic-app.tsx:171-180`).
- Next.js version is **16.2.9** (`package.json`). `useSearchParams` in a client component requires a Suspense boundary; URL updates should use `router.replace(pathname + query, { scroll: false })` to avoid history spam. **Read `node_modules/next/dist/docs/` for the exact App-Router API before editing.**

### Exact files likely touched
- **New:** `src/lib/topic-mode-logic.ts` — the mode registry + URL (de)serialization (pure).
- **New:** `tests/topic-mode-logic.test.mjs`.
- `src/components/topic-app.tsx` — read initial `mode`/`quizMode` from search params; write them on change; keep the topic-switch reset correct.
- Possibly `src/app/topics/[slug]/page.tsx` — ensure the client tree is wrapped so `useSearchParams` is Suspense-safe (verify against Next 16 docs; may already be fine).

### Data / localStorage implications
**None.** This sprint adds no persisted state. URL query params are ephemeral and static-export friendly (client-side only; no server params required, topic pages keep their `generateStaticParams`).

### Pure logic / helpers to add (`src/lib/topic-mode-logic.ts`)
```ts
// Single source of truth for the practice modes (replaces the inline union in
// topic-app.tsx:71) and their URL param codes + human labels.
export type TopicMode =
  | "phrasebook" | "words" | "flashcards" | "quiz" | "typed"
  | "match" | "memory" | "cloze" | "scramble" | "sentence-listen" | "boss";

export const TOPIC_MODES: readonly TopicMode[]; // canonical order (matches current tab order)
export const MODE_LABELS: Record<TopicMode, string>;      // e.g. quiz → "Quiz"

// Quiz sub-mode reuses quiz-logic's QuizMode; keep its codes here too.
export type ResumableQuizMode = "hanzi-english" | "english-hanzi" | "hanzi-pinyin" | "listening";

// Parse a mode from a raw query value; return null if absent/invalid so the
// caller can fall back to the topic default (phrasebook vs words).
export function parseMode(raw: string | null | undefined): TopicMode | null;
export function parseQuizMode(raw: string | null | undefined): ResumableQuizMode | null;

// Build the query string for a mode (+ optional quiz sub-mode). Omits params
// that equal the topic default so a plain "/topics/slug" stays canonical.
// e.g. modeQuery("quiz", "english-hanzi") -> "?m=quiz&q=english-hanzi"
export function modeQuery(
  mode: TopicMode,
  quizMode?: ResumableQuizMode | null,
  opts?: { defaultMode?: TopicMode },
): string;

// Full href helper used by the shelf/hero/resume card.
export function topicModeHref(
  slug: string,
  mode?: TopicMode | null,
  quizMode?: ResumableQuizMode | null,
): string; // "/topics/{slug}" + modeQuery(...)
```
Keep it dependency-light: import `QuizMode` type from `quiz-logic.ts` if convenient, but do **not** pull React or DOM in. `boss` and `sentence-listen` are speech/dynamic-gated — the parser still accepts them; `topic-app` already guards their availability, so an unavailable mode in the URL should degrade to the topic default (add a `isModeAvailable` note in the component, not the pure module).

### UI copy
No visible copy changes. (Mode labels in `MODE_LABELS` should match the existing tab labels already rendered in `topic-app.tsx`.)

### Tests to add/update (`tests/topic-mode-logic.test.mjs`)
- `parseMode` accepts every id in `TOPIC_MODES`; returns `null` for `""`, `"nope"`, `undefined`, wrong case.
- `parseQuizMode` accepts the four quiz codes; `null` otherwise.
- `modeQuery("words", null, {defaultMode:"words"})` → `""` (default omitted); `modeQuery("quiz","english-hanzi")` → `"?m=quiz&q=english-hanzi"`; `modeQuery("quiz")` → `"?m=quiz"`.
- `topicModeHref("ten-types-of-tea","flashcards")` → `"/topics/ten-types-of-tea?m=flashcards"`; `topicModeHref("x")` → `"/topics/x"`.
- `TOPIC_MODES` length/order matches the union in `topic-app.tsx` (guards against drift).

### QA checklist
- [ ] `/topics/{slug}?m=flashcards` opens on Flashcards; `?m=quiz&q=english-hanzi` opens Quiz in English→Hanzi.
- [ ] Switching modes updates the URL without adding a history entry per click (back button returns to the previous *page*, not each tab).
- [ ] Unknown `?m=zzz` silently falls back to the topic default; no console error, no crash.
- [ ] Useful-Phrases topics still default to `phrasebook` when no `m` param is present.
- [ ] Switching to a different topic still resets to that topic's default mode (existing `topic-app.tsx:171-180` behavior intact).
- [ ] SSR/prerender unaffected: `npm run build` succeeds; no `useSearchParams`-without-Suspense error.

### Risks / non-goals
- **Risk:** `useSearchParams` bailout / hydration. Mitigate by following the Next 16 docs exactly (Suspense boundary; `router.replace` with `{ scroll: false }`). **Non-goal:** persisting *within-mode* position (current card index, quiz question number) — modes still start fresh; only the mode selection is addressable.
- **Non-goal:** encoding `toneMode` (`read|listen`, `topic-app.tsx:79`) — out of scope; tone practice is a sub-section, not a top-level tab.

### Ready-to-run implementation prompt
```
You are Claude Code Opus implementing Sprint 1 (URL-addressable practice modes) from
docs/opus-resume-and-find-next-lesson-plan.md.

First read AGENTS.md, then read the App-Router routing + useSearchParams docs under
node_modules/next/dist/docs/ (this is a modified Next.js 16 — do not trust memory).

Do:
1. Create src/lib/topic-mode-logic.ts exactly per the plan: TopicMode type, TOPIC_MODES,
   MODE_LABELS, parseMode, parseQuizMode, modeQuery, topicModeHref. Pure, no React/DOM.
   Labels must match the current tab labels in src/components/topic-app.tsx.
2. Refactor topic-app.tsx to import TopicMode/TOPIC_MODES from the new module (replace the
   inline union at line 71). Initialize `mode`/`quizMode` from useSearchParams (fallback to
   the topic default when absent/invalid or when the mode is unavailable, e.g. speech-gated).
   On mode/quizMode change, reflect it to the URL with router.replace(pathname + query,
   { scroll: false }). Keep the topic-switch reset (lines 171-180) working.
3. Ensure useSearchParams is Suspense-safe (wrap per Next 16 docs if needed).
4. Add tests/topic-mode-logic.test.mjs per the plan (node --test, import the .ts module).

Constraints: no changes to src/data/topics.json; local-first only; no new deps. Do NOT commit.
Run the shared validation gate (validate:data, test, lint, build) and report results.
```

---

# Sprint 2 — Persist & resume last activity

### Product goal
Record the last (topic, mode, quiz sub-mode) the learner touched, and surface a single, prominent **"Resume where you left off"** card on the front page that deep-links straight back into that exact activity using Sprint 1's `topicModeHref`.

### User story
> As a returning learner, the first thing I see on the home page is "Resume: Drinks — Quiz," and tapping it drops me exactly into the Quiz I was doing yesterday.

### Current-state findings
- `recordTopicVisit` (`use-progress.ts:183-186`) already records the *topic*; we extend the same choke-point pattern to also capture the *activity*.
- `RecentTopicsShelf` (`recent-topics-shelf.tsx`) links only to `/topics/{slug}` (bare). It will be upgraded to deep-link via `topicModeHref` when a last-mode is known for that slug (optional refinement) — but the primary deliverable is a distinct top-of-page resume card.
- Schema is at **v11** (`progress-logic.ts:50`). Adding `lastActivity` bumps to **v12** with the standard migration comment.

### Exact files likely touched
- `src/lib/types.ts` — add `LastActivity` type + `lastActivity: LastActivity | null` to `ProgressState`.
- `src/lib/progress-logic.ts` — bump `CURRENT_PROGRESS_SCHEMA_VERSION` to 12, add to `emptyProgress`, add `normalizeLastActivity`, wire into `normalizeProgress`, add pure `recordLastActivity(prev, {slug, mode, quizMode})`.
- `src/components/use-progress.ts` — add `recordLastActivity` mutator (referential no-op when unchanged, mirroring `recordTopicVisit`).
- `src/components/topic-app.tsx` — call `recordLastActivity` when mode/quizMode changes (piggyback on the same effect that already records the visit).
- **New:** `src/lib/resume-logic.ts` — build the resume target (href + label) from `lastActivity` + dataset, tolerant of dropped slugs.
- **New:** `src/components/resume-card.tsx` — the presentational home card (mirrors `RecentTopicsShelf` styling).
- `src/components/home-app.tsx` — render the resume card near the top (above the recent shelf).
- **New tests:** `tests/resume-logic.test.mjs`; **extend** `tests/progress-logic.test.mjs`.

### Data / localStorage implications
- New persisted field on the existing blob (no new storage key):
  ```ts
  export type LastActivity = {
    topicSlug: string;
    mode: TopicMode;                 // from topic-mode-logic
    quizMode?: ResumableQuizMode;    // only when mode === "quiz"
    updatedAt: string;               // ISO
  };
  // ProgressState gains: lastActivity: LastActivity | null;
  ```
- **Migration v11 → v12:** older saves lack the field and migrate to `null`, losing nothing else. Add the comment block to the version ledger at the top of `progress-logic.ts` (same style as v9/v10/v11).
- `normalizeLastActivity` must never throw: validate `topicSlug` is a string, `mode` via `parseMode`, `quizMode` via `parseQuizMode`, `updatedAt` via the existing `isValidISO`; any failure → `null`. **Do not** validate the slug against the dataset here (keep `progress-logic` dataset-independent, per house style) — resolution/dropping happens in `resume-logic` against the live topics.

### Pure logic / helpers to add (`src/lib/resume-logic.ts`)
```ts
import type { LastActivity } from "./types";
// Resolve lastActivity into a ready-to-render target, or null when there is no
// resumable activity or the topic slug no longer exists (dataset drift).
export type ResumeTarget = {
  slug: string;
  href: string;         // topicModeHref(slug, mode, quizMode)
  topicTitleEn: string;
  topicTitleCn: string;
  modeLabel: string;    // MODE_LABELS[mode] (+ quiz sub-mode label when relevant)
};
export function resolveResumeTarget<T extends Pick<Topic,"slug"|"titleEn"|"titleCn">>(
  topics: T[],
  lastActivity: LastActivity | null | undefined,
): ResumeTarget | null;
```
And in `progress-logic.ts`:
```ts
export function recordLastActivity(
  prev: LastActivity | null | undefined,
  next: { slug: string; mode: TopicMode; quizMode?: ResumableQuizMode },
  now: Date = new Date(),
): LastActivity; // returns prev UNCHANGED (referential) when slug+mode+quizMode already match,
                 // so the topic-app effect stays loop-free like recordRecentTopic.
```

### UI copy (`resume-card.tsx`)
- Eyebrow: `Pick up where you left off`
- Title: `Resume: {topicTitleEn}`
- Sub: `{modeLabel} · {topicTitleCn}`  (e.g. `Quiz · English → Hanzi · 饮料`)
- Button / link text: `Resume →`
- aria-label on the link: `Resume {topicTitleEn} — {modeLabel}`
- Renders **nothing** when `resolveResumeTarget` returns `null` (first-time visitors and dropped slugs see the existing Start-here flow untouched).

### Tests to add/update
`tests/resume-logic.test.mjs`:
- `resolveResumeTarget([], someActivity)` → `null` (empty dataset).
- Known slug + `mode:"quiz"` + `quizMode:"english-hanzi"` → href `"/topics/{slug}?m=quiz&q=english-hanzi"`, `modeLabel` includes the sub-mode label.
- Unknown slug (drift) → `null`.
- `lastActivity: null` → `null`.
- `mode:"words"` default → href is bare `"/topics/{slug}"` (default omitted).

`tests/progress-logic.test.mjs` (extend):
- `normalizeProgress({})` now includes `lastActivity: null` and `schemaVersion === 12`; `deepEqual(normalizeProgress({}), emptyProgress)` still holds.
- Legacy save without `lastActivity` migrates to `null`, preserving all other fields.
- `normalizeLastActivity` repairs: bad mode → `null`; bad ISO → `null`; valid blob passes through.
- `recordLastActivity` returns the **same reference** when nothing changed (loop-free contract); returns a new object with fresh `updatedAt` when the mode changes.

### QA checklist
- [ ] Do a Quiz on topic A, reload the home page → "Resume: A — Quiz" card appears at top and deep-links into the Quiz.
- [ ] Switch to Flashcards on topic B → resume card now shows B — Flashcards (most recent wins).
- [ ] Export progress, clear storage, re-import → resume card returns identically (round-trips through `normalizeProgress`).
- [ ] A legacy v11 export (hand-edit `schemaVersion` down, remove `lastActivity`) imports cleanly with no console error and no resume card.
- [ ] First-time visitor (empty storage) sees **no** resume card — only the existing Start-here CTA.
- [ ] `recordLastActivity` does not create a study day or affect the streak/goal (it must be as inert as `recordTopicVisit`).

### Risks / non-goals
- **Risk:** double-recording causing render loops. Mitigate via the referential-no-op contract, unit-tested. **Risk:** a resume target pointing at a speech-gated mode (`sentence-listen`, `boss`, `quiz?q=listening`) on a device without audio — the deep-link still works because `topic-app` degrades unavailable modes to the default (Sprint 1). Note this in the QA.
- **Non-goal:** resuming mid-question / mid-card position. **Non-goal:** a history list of activities — one "last" is enough. **Non-goal:** cross-device sync (local-first).

### Ready-to-run implementation prompt
```
You are Claude Code Opus implementing Sprint 2 (Persist & resume last activity) from
docs/opus-resume-and-find-next-lesson-plan.md. Sprint 1 (topic-mode-logic.ts) must be done first.

Read AGENTS.md. This touches the persisted schema — study progress-logic.ts's migration
ledger (lines 26-50) and follow the exact v11→v12 pattern.

Do:
1. types.ts: add LastActivity type and `lastActivity: LastActivity | null` to ProgressState.
2. progress-logic.ts: bump CURRENT_PROGRESS_SCHEMA_VERSION to 12; add `lastActivity: null` to
   emptyProgress; add normalizeLastActivity (never throws; validates via parseMode/parseQuizMode/
   isValidISO); wire it into normalizeProgress; add recordLastActivity (referential no-op when
   unchanged). Add the v11→v12 comment to the ledger.
3. use-progress.ts: add a recordLastActivity mutator (no-op-safe, like recordTopicVisit; must NOT
   route through withPractice/recordStudyToday — a mode switch is not practice).
4. topic-app.tsx: record last activity when mode/quizMode changes.
5. Create src/lib/resume-logic.ts (resolveResumeTarget) and src/components/resume-card.tsx.
6. home-app.tsx: render the resume card above the "Jump back in" shelf; render nothing when null.
7. Tests: tests/resume-logic.test.mjs (new) and extend tests/progress-logic.test.mjs per the plan.

Constraints: no topics.json changes; local-first; no new deps; do NOT commit. Run the shared
validation gate and report results.
```

---

# Sprint 3 — Adaptive hero primary action

### Product goal
Collapse the hero's competing entry points into one **smart primary action** that adapts to the learner's state — Resume (returning mid-activity), Continue (has learned topics, nothing to resume), or Start here (brand-new) — plus a plain-language explainer line so a cold visitor immediately understands the product.

### User story
> As any visitor, the hero's big button always says the single most useful next thing for *me*: "Resume Quiz — Drinks," or "Continue: Farm Animals," or "Start your first lesson."

### Current-state findings
- The hero (`home-app.tsx`) currently offers `Start learning` (scrolls to `#library`) and `Daily review` (`/review`), plus quiet desktop links (Learning path / Your stats / Settings). Separately, `ContinueLearningCard` and (after Sprint 2) the resume card live *below* the hero.
- `nextRecommendedTopic(topics, learnedTopics)` (`data-logic.ts:179`) already computes the "continue" target; Sprint 2's `resolveResumeTarget` computes the "resume" target.

### Exact files likely touched
- **New:** `src/lib/home-cta-logic.ts` — pure decision function returning the primary CTA descriptor.
- **New:** `tests/home-cta-logic.test.mjs`.
- `src/components/home-app.tsx` — render the primary CTA from the descriptor; keep a secondary "Browse all lessons" action.

### Data / localStorage implications
**None.** Reads existing `progress` (`learnedTopics`, `lastActivity`, `onboarding`). No new fields.

### Pure logic / helpers to add (`src/lib/home-cta-logic.ts`)
```ts
export type PrimaryCta =
  | { kind: "resume";   href: string; label: string; sub: string }   // from resolveResumeTarget
  | { kind: "continue"; href: string; label: string; sub: string }   // from nextRecommendedTopic
  | { kind: "start";    href: string; label: string; sub: string };  // first recommendedPath topic

// Precedence: resume > continue (has learnedTopics) > start.
export function primaryCta<T extends Pick<Topic,"slug"|"titleEn">>(
  topics: T[],
  progress: Pick<ProgressState,"learnedTopics"|"lastActivity">,
): PrimaryCta;
```
Reuses `resolveResumeTarget` (Sprint 2), `nextRecommendedTopic`, and `recommendedPath` — no duplicated topic-selection logic.

### UI copy
- Resume: label `Resume: {titleEn}`, sub `{modeLabel} · one tap back in`.
- Continue: label `Continue: {titleEn}`, sub `{n} lists learned · keep going`.
- Start: label `Start your first lesson`, sub `10 words, one short video, then practice`.
- Secondary action (always): `Browse all lessons` → scrolls to the finder (`#library` today; `#find` after Sprint 4).
- Hero explainer line (always visible, learner/teacher framing): `Free Mandarin vocabulary lessons — watch a short video, practice with quizzes and flashcards, and track what sticks. Everything stays on your device.`

### Tests to add/update (`tests/home-cta-logic.test.mjs`)
- Empty progress → `kind:"start"`, href = first `recommendedPath` topic.
- `learnedTopics:["a"]`, no `lastActivity` → `kind:"continue"`, href from `nextRecommendedTopic`.
- `lastActivity` present + slug resolvable → `kind:"resume"` regardless of learned count (precedence).
- `lastActivity` slug dropped from dataset → falls through to continue/start (never a broken href).

### QA checklist
- [ ] Fresh visitor: hero shows "Start your first lesson"; explainer line reads clearly.
- [ ] Learner with progress but no in-flight activity: "Continue: {topic}".
- [ ] Learner mid-activity (Sprint 2 populated): "Resume: {topic}" with correct mode sub-label; tap lands in the exact mode.
- [ ] Secondary "Browse all lessons" scrolls to the finder section.
- [ ] Keyboard focus order sane; primary button is the first interactive element in the hero.

### Risks / non-goals
- **Risk:** hero + below-the-fold cards feel redundant. Mitigate: once the hero adapts, drop the standalone resume card's eyebrow to a lighter treatment or hide it when the hero already shows Resume (decide in-code; keep the shelf of *other* recent topics). **Non-goal:** removing `ContinueLearningCard`/`RecentTopicsShelf` — they still serve the "other lessons" browsing case.

### Ready-to-run implementation prompt
```
You are Claude Code Opus implementing Sprint 3 (Adaptive hero primary action) from
docs/opus-resume-and-find-next-lesson-plan.md. Sprints 1-2 must be done first.

Read AGENTS.md.

Do:
1. Create src/lib/home-cta-logic.ts: primaryCta(topics, progress) with precedence
   resume > continue > start, reusing resolveResumeTarget, nextRecommendedTopic, recommendedPath.
   No new topic-selection logic.
2. home-app.tsx: render the hero primary action from primaryCta; add the explainer line; make the
   secondary action "Browse all lessons" scroll to the finder. Avoid duplicate Resume prompts
   (soften/hide the standalone resume card when the hero already shows Resume).
3. Add tests/home-cta-logic.test.mjs per the plan.

Constraints: copy + logic only; no topics.json changes; local-first; do NOT commit. Run the
shared validation gate and report results.
```

---

# Sprint 4 — Front-page lesson finder

### Product goal
Lift findability to the top of the page: a dedicated **"Find your lesson"** block directly under the hero, combining the existing word/topic search with one-tap **category chips** and a short **starter-lessons** row — so a learner or teacher can locate the right list in seconds without scrolling through the whole library.

### User story
> As a teacher, I land on the site, type "fruit" (or tap the "Food & Drink" chip), and immediately see the matching lessons to assign — no scrolling past marketing.

### Current-state findings
- Search already exists and is good: `searchWords` (`search-logic.ts`), lazy `/search-index.json`, diacritic-tolerant, category filter dropdown, word + topic results. It just lives too far down (the "Vocabulary library" section).
- Categories are available on `HomeIndexData.categories`; `topicCategoryHref` / category pages (`/categories/{slug}`) already exist.
- `recommendedPath(topics)` (`data-logic.ts:168`) gives a stable, sensible starter ordering.

### Exact files likely touched
- **New:** `src/lib/lesson-finder-logic.ts` — pure helpers for chips + starter lessons.
- **New:** `tests/lesson-finder-logic.test.mjs`.
- `src/components/home-app.tsx` — add a `#find` finder block high on the page (reuse the existing search state/handlers; consider extracting the search input + results into a small component to share between the new block and the existing library section, or move the library search up and anchor it).

### Data / localStorage implications
**None.** Chips derive from `categories`; starter lessons from `recommendedPath`. Optional: read `learnedTopics` to hide already-learned topics from the starter row (pure input, no new state).

### Pure logic / helpers to add (`src/lib/lesson-finder-logic.ts`)
```ts
// Category chips with topic counts, in dataset order, for the finder.
export function categoryChips(
  categories: Pick<Category,"name"|"slug"|"topics">[],
): { name: string; slug: string; href: string; count: number }[];

// A short, stable set of starter lessons (default 6): recommendedPath order,
// skipping already-learned topics, falling back to the head of the path when the
// learner has finished most of them.
export function starterLessons<T extends Pick<Topic,"slug"|"titleEn"|"titleCn">>(
  topics: T[],
  learnedTopics: string[],
  limit?: number,
): T[];
```

### UI copy
- Section eyebrow: `Find your lesson`
- Heading: `Search 200+ words or browse by theme`  (use the real count via `datasetSummary(topics)` — do **not** hardcode; e.g. `Search {formattedWordCount} words or browse by theme`)
- Search placeholder (reuse existing): `Search words, pinyin, English`
- Chips row label (aria): `Browse by category`
- Starter row eyebrow: `New here? Start with one of these`
- Empty-search hint (before typing): `Try “fruit”, “gǒu”, or tap a category.`

### Tests to add/update (`tests/lesson-finder-logic.test.mjs`)
- `categoryChips` returns one entry per category with the correct `count` and `href = /categories/{slug}`, dataset order preserved.
- `starterLessons` skips learned topics; respects `limit`; when all-but-few are learned, still returns `limit` items (falls back to path head) and never returns duplicates.
- Empty `topics` → `[]` for both.

### QA checklist
- [ ] The finder block is visible under the hero without scrolling on a 1366×768 laptop.
- [ ] Typing filters words + topics exactly as the current library search does (no regression); diacritic-tolerant ("gou" matches "gǒu").
- [ ] Category chips navigate to `/categories/{slug}`; counts match the dataset.
- [ ] Starter lessons hide topics already marked learned; tapping one opens the topic.
- [ ] The original "Vocabulary library" section still works (or is cleanly merged) — no duplicated, desynced search state.
- [ ] Lazy `/search-index.json` still loads on focus/first keystroke; failure still degrades to title/hanzi search.

### Risks / non-goals
- **Risk:** two search inputs with separate state drifting apart. Mitigate by extracting a single shared search component or by moving (not duplicating) the library search into the finder. **Non-goal:** server-side search, fuzzy ranking changes, or new search index shape — reuse `searchWords` as-is.

### Ready-to-run implementation prompt
```
You are Claude Code Opus implementing Sprint 4 (Front-page lesson finder) from
docs/opus-resume-and-find-next-lesson-plan.md.

Read AGENTS.md. Reuse the existing search (searchWords, /search-index.json lazy load) — do not
reimplement it. Prefer extracting one shared search component over duplicating search state.

Do:
1. Create src/lib/lesson-finder-logic.ts: categoryChips + starterLessons per the plan (pure).
2. home-app.tsx: add a #find "Find your lesson" block directly under the hero with the search
   input, category chips, and a starter-lessons row. Wire the hero's secondary CTA (Sprint 3) to
   scroll to #find. Keep the existing library search working (merge or share state — no duplication).
   Use datasetSummary for real counts; never hardcode word/list counts.
3. Add tests/lesson-finder-logic.test.mjs per the plan.

Constraints: no topics.json changes; local-first; no new deps; do NOT commit. Run the shared
validation gate and report results.
```

---

# Sprint 5 — Learner/teacher clarity

### Product goal
Make the front page self-explanatory for a first-time learner or an evaluating teacher: a compact **"How it works" 3-step strip** (Watch → Practice → Review) and **clearer lesson-card metadata** (status label, word count, video badge) so every card communicates what it is and where the learner stands.

### User story
> As a teacher evaluating the tool, I see in one glance that each lesson is "10 words · video · quiz + flashcards," and on a returning learner's screen each card shows "3/10 studied" or "Mastered," so I trust what it does before I commit.

### Current-state findings
- Feature cards already describe capabilities (`home-app.tsx` feature row) but read as marketing, not a "how to use it" loop.
- Topic cards already show per-topic progress via `topicProgress` (`progress-logic.ts:521`) and mastery via `topicWordStatuses`/`masterySummary` (`progress-logic.ts:1068/1081`), and crowns via `isCrowned`. We consolidate these into one clear status label per card.

### Exact files likely touched
- **New:** `src/lib/lesson-card-logic.ts` — pure per-card status label + metadata.
- **New:** `tests/lesson-card-logic.test.mjs`.
- `src/components/home-app.tsx` — add the "How it works" strip; pass a status label into the topic cards (or into `TopicCard`).
- Possibly `src/components/topic-card.tsx` (the card component used by the library grid) — render the status label/metadata line.

### Data / localStorage implications
**None.** Derives from existing `flashcardStats`, `quizStats`, `bossStats`, `learnedTopics`.

### Pure logic / helpers to add (`src/lib/lesson-card-logic.ts`)
```ts
// A single, human status for a topic card, derived from existing stats.
// Precedence: crowned/learned > mastered-majority > in-progress > new.
export type LessonCardStatus =
  | { kind: "new";        label: "Not started" }
  | { kind: "started";    label: string }        // "3/10 studied"
  | { kind: "mastered";   label: "Mastered" }    // all/most words mastered
  | { kind: "learned";    label: "Learned ✓" }
  | { kind: "crowned";    label: "Crowned 👑" };
export function lessonCardStatus(
  topic: Pick<TopicSummary,"slug"|"items">,
  progress: Pick<ProgressState,"flashcardStats"|"quizStats"|"bossStats"|"learnedTopics">,
): LessonCardStatus;

// Static, dataset-derived metadata line (no progress): "10 words · video · quiz".
export function lessonCardMeta(
  topic: Pick<Topic,"items"|"video"|"videoPath">,
): string;
```
Reuse `topicProgress`, `wordStatus`/`masterySummary`, `isCrowned`, `hasPlayableVideo` — do not re-derive thresholds.

### UI copy
- "How it works" eyebrow: `How it works`
- Three steps:
  1. `1 · Watch` — `A short video introduces 10 words with Chinese, pinyin, and English.`
  2. `2 · Practice` — `Quizzes, flashcards, matching, and typing lock them in.`
  3. `3 · Review` — `Spaced repetition brings words back right before you forget.`
- Card status labels come from `lessonCardStatus` (above).
- Card meta line examples: `10 words · video · quiz` / `10 words · quiz` (when no playable video).

### Tests to add/update (`tests/lesson-card-logic.test.mjs`)
- New topic (no stats) → `{kind:"new", label:"Not started"}`.
- Some words studied → `{kind:"started", label:"3/10 studied"}` (count matches `topicProgress`).
- All/most words mastered → `mastered`.
- In `learnedTopics` → `learned`; crowned in `bossStats` → `crowned` (crowned outranks learned — pick and test the precedence).
- `lessonCardMeta` includes `video` only when `hasPlayableVideo` is true; word count matches `items.length`.

### QA checklist
- [ ] "How it works" strip renders three clear steps; copy matches the plan.
- [ ] Each library/topic card shows a correct status label reflecting real progress (studied count, learned ✓, crowned 👑).
- [ ] Meta line shows the right word count and only shows "video" when a playable video exists.
- [ ] No regression to existing crown/learned badges already on cards (avoid double badges — consolidate).
- [ ] Labels are screen-reader friendly (status conveyed as text, not color/emoji alone).

### Risks / non-goals
- **Risk:** duplicating badges the card already renders. Mitigate by consolidating existing badge logic into `lessonCardStatus`. **Non-goal:** a full teacher/classroom mode, printable lesson plans beyond the existing `print-logic`, or any new dataset fields.

### Ready-to-run implementation prompt
```
You are Claude Code Opus implementing Sprint 5 (Learner/teacher clarity) from
docs/opus-resume-and-find-next-lesson-plan.md.

Read AGENTS.md.

Do:
1. Create src/lib/lesson-card-logic.ts: lessonCardStatus + lessonCardMeta per the plan, reusing
   topicProgress, masterySummary/wordStatus, isCrowned, hasPlayableVideo. Define and test the
   status precedence (crowned > learned > mastered > started > new).
2. home-app.tsx: add the "How it works" 3-step strip. Pass a status label into the topic cards.
3. Consolidate any existing card badge logic into lessonCardStatus so cards don't double-badge;
   render the meta line. Keep status as text (a11y).
4. Add tests/lesson-card-logic.test.mjs per the plan.

Constraints: no topics.json changes; local-first; do NOT commit. Run the shared validation gate
and report results.
```

---

# Sprint 6 — Onboarding → first-lesson discovery

### Product goal
Turn first-run onboarding into a discovery on-ramp: after picking a daily goal, the learner chooses a **first lesson** from a small starter picker (reusing Sprint 4's `starterLessons`) instead of being auto-dropped on one topic — and returning visitors who reopen onboarding are offered **Resume** instead. This closes the loop from "public product landing" → "in a lesson."

### User story
> As a first-time visitor, after I pick "Steady · 10 words a day," I'm shown three good starter lessons with a "browse all" escape hatch, and I choose the one that speaks to me — I'm never dumped somewhere arbitrary.

### Current-state findings
- `OnboardingModal` (`onboarding.tsx:27`) captures the goal and links to a single starter `/topics/{firstTopic.slug}` with a "Browse on my own" / "Skip for now" escape.
- `completeOnboarding(dailyGoal)` / `skipOnboarding` (`use-progress.ts:128-135`) already persist onboarding state; no schema change needed.
- Sprint 4 gives `starterLessons`; Sprint 2 gives `resolveResumeTarget`.

### Exact files likely touched
- **New:** `src/lib/onboarding-next-logic.ts` — pure chooser for onboarding's next step.
- **New:** `tests/onboarding-next-logic.test.mjs`.
- `src/components/onboarding.tsx` — render the starter picker (goal step → lesson step); offer Resume for returning users.
- Possibly `src/components/home-app.tsx` — the modal is shown from here; confirm gating (`showOnboarding`) still correct.

### Data / localStorage implications
**None new.** Reuses `onboarding` state and `lastActivity`. Goal is still saved via `completeOnboarding`. (If the two-step flow needs to persist the goal before lesson choice, use the existing `setDailyGoal` then `completeOnboarding` — no new fields.)

### Pure logic / helpers to add (`src/lib/onboarding-next-logic.ts`)
```ts
// Decide what the onboarding modal should offer as the next action.
export type OnboardingNext =
  | { kind: "resume"; href: string; label: string }              // returning user with lastActivity
  | { kind: "pick";   lessons: { slug:string; titleEn:string; titleCn:string; href:string }[] }; // first-run picker
export function onboardingNext<T extends Pick<Topic,"slug"|"titleEn"|"titleCn">>(
  topics: T[],
  progress: Pick<ProgressState,"learnedTopics"|"lastActivity">,
  limit?: number,   // starter picker size, default 3
): OnboardingNext;
```
Reuses `resolveResumeTarget` + `starterLessons`. Pure; no new selection logic.

### UI copy (`onboarding.tsx`)
- Step 2 heading (first-run): `Pick your first lesson`
- Step 2 sub: `Ten words, one short video, then a quick quiz. You can switch anytime.`
- Per-lesson button: `{titleEn} · {titleCn}`
- Escape hatch (unchanged intent): `Browse all lessons` and `Skip for now`
- Returning-user variant heading: `Welcome back`
- Returning-user primary: `Resume: {titleEn} →`

### Tests to add/update (`tests/onboarding-next-logic.test.mjs`)
- Empty progress → `{kind:"pick", lessons:[…]}` of length `limit`, hrefs `/topics/{slug}`, skipping none.
- `learnedTopics` non-empty but no `lastActivity` → still `pick`, skipping learned topics.
- `lastActivity` resolvable → `{kind:"resume", href}` (returning-user precedence).
- `lastActivity` slug dropped → falls back to `pick`.

### QA checklist
- [ ] Fresh visitor: goal step → "Pick your first lesson" with N starters + "Browse all lessons" + "Skip for now"; choosing one opens that topic and marks onboarding complete.
- [ ] Starter picker excludes already-learned topics.
- [ ] A returning visitor who somehow reopens onboarding sees "Welcome back · Resume: {topic}".
- [ ] Skipping still completes onboarding (no modal re-nag) exactly as today.
- [ ] Focus trap and keyboard nav in the modal remain intact (existing behavior).
- [ ] No schema bump; export/import unaffected.

### Risks / non-goals
- **Risk:** onboarding gains a step and feels heavier. Mitigate: keep it to two quick steps, big tap targets, prominent skip. **Non-goal:** multi-page tutorial, account creation, or persisting a "chosen path" — the starter picker is a one-time nudge, not new state.

### Ready-to-run implementation prompt
```
You are Claude Code Opus implementing Sprint 6 (Onboarding → first-lesson discovery) from
docs/opus-resume-and-find-next-lesson-plan.md. Sprints 2 and 4 must be done first.

Read AGENTS.md.

Do:
1. Create src/lib/onboarding-next-logic.ts: onboardingNext(topics, progress, limit) per the plan,
   reusing resolveResumeTarget + starterLessons. Pure; no new selection logic.
2. onboarding.tsx: after the goal step, show a "Pick your first lesson" starter picker (with
   "Browse all lessons" + "Skip for now"); for returning users with lastActivity, show a
   "Welcome back · Resume" variant. Keep completeOnboarding/skipOnboarding semantics and the
   focus trap. No schema change.
3. Add tests/onboarding-next-logic.test.mjs per the plan.

Constraints: no topics.json changes; no new persisted fields; local-first; do NOT commit. Run the
shared validation gate and report results.
```

---

## 7. Cross-cutting conventions (apply to every sprint)

- **Pure logic in `src/lib/*-logic.ts`, tested with `node --test`** (`tests/*.test.mjs`, importing the `.ts` module directly, e.g. `import { … } from "../src/lib/resume-logic.ts";`). Follow the fixture style already in `tests/progress-logic.test.mjs` (`makeTopic(slug, hanziList)`).
- **Never throw on bad persisted input.** Any normalizer added must degrade to a safe default, matching `normalizeProgress`'s contract.
- **Referential no-ops** for any new `use-progress` mutator that can fire on every render (mirror `recordTopicVisit` / `recordBestCombo`).
- **Read the Next.js docs under `node_modules/next/dist/docs/`** before touching routing, `useSearchParams`, `router.replace`, or Suspense (Sprint 1 especially). This is a modified Next 16 — do not rely on memory (`AGENTS.md`).
- **No `topics.json` edits, no invented content, no new dependencies, no network/tracking services.** Leave every sprint's changes **uncommitted** for Hermes verification.
- **Copy lives in the components**, but keep it consistent with the strings quoted above so QA can grep for them.

## 8. What this plan deliberately does NOT do

- No mid-activity position resume (question index / card index) — only the mode is remembered.
- No accounts, cloud sync, or server-side rendering of personalized state — everything stays local-first.
- No redesign of the practice modes themselves, the SRS scheduler, or the search ranking.
- No new vocabulary, categories, or dataset schema changes.
