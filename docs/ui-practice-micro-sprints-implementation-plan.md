# UI & Practice Micro-Sprints — Implementation Plan

Ten independently shippable micro-sprints that improve the user interface and the practice activities that help learners memorize sets of words. Written against the codebase as of commit `8746e5e` (branch `main`, clean tree). Each sprint is scoped to one focused Opus implementation run and ends with the standard validation gate.

**Product constraints (fixed):** no backend, no database, no login/accounts, no new infrastructure, no large rewrites. Everything is local-first: static Next.js pages plus `localStorage`. Opus implements one sprint at a time from this document; Hermes verifies, commits, pushes, and deploys.

---

## Global implementation principles

These apply to every sprint. Opus prompts below assume them.

1. **Local-first, static-only.** All pages remain statically prerendered in the `next build` output. All interactivity lives in `"use client"` components under `src/components/`; pages under `src/app/` stay thin server wrappers that pass `data` from `@/lib/data`. No API routes, no server actions, no fetches to external services.
2. **Obey AGENTS.md.** This repo runs Next.js **16.2.9** with breaking changes vs. training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing route code. Known conventions already in use here: dynamic route `params` is a `Promise` and must be awaited (see `src/app/topics/[slug]/page.tsx`), `generateStaticParams()` for SSG, `metadata`/`viewport` exports.
3. **No new dependencies.** The dependency set is `next`, `react`, `react-dom`, Tailwind v4 (`@tailwindcss/postcss`), TypeScript, ESLint. Everything below is achievable with CSS, SVG, React state, the Web Speech synthesis API (already used by `SpeakButton`), and `localStorage`.
4. **Pure logic in `src/lib/*-logic.ts`, tests in `tests/*.test.mjs`.** Follow the established split: pure, DOM-free, injectable-clock/injectable-shuffle functions in lib modules; components layer state on top. Runtime imports between lib modules use the explicit `.ts` extension (e.g. `import { wordKey } from "./data-logic.ts"`) so `node --test` resolves them. Tests use `node:test` + `node:assert/strict` and import lib files as `../src/lib/foo-logic.ts`.
5. **Persistence discipline.** There is exactly one progress store: `localStorage` key `learn-10-mandarin-progress-v1`, shape `ProgressState` (schema v3), loaded/saved by `useProgress` and migrated by `normalizeProgress`. Any schema change bumps `CURRENT_PROGRESS_SCHEMA_VERSION`, extends `normalizeProgress` (never throws, never drops data), and adds migration tests. Only Sprint 7 changes the schema; every other sprint must state "no schema change" and mean it.
6. **Mobile-first.** Primary device is a phone: 44px minimum touch targets (`min-h-[44px]` is the house pattern), bottom nav overlays content (`pb-24` on `<main>`), sticky topic header, swipe gestures via `useSwipe`. Test layouts at 360px width.
7. **Accessibility.** Keep the existing patterns: `aria-pressed` on toggles, `aria-label` on icon buttons, `role="status"` for async feedback, `role="group"`/`role="tab"` where used, global emerald `:focus-visible` ring (globals.css). Never encode meaning in color alone — pair dots/rings with text or `aria-label`s. Screen-reader text for every new visualization.
8. **Reduced motion.** Every new animation gets a `@media (prefers-reduced-motion: reduce)` override in `globals.css`, following the existing `.animate-*` pattern (animation removed, end state shown instantly). Gesture-driven transforms (Sprint 9) degrade to the current tap-only behavior.
9. **Analytics is local-only.** New product events extend the typed `AnalyticsEvent` union in `src/lib/analytics.ts` and are fired via `track()`. Never add a network transport.
10. **Copy tone.** Short, encouraging, no gamification-speak beyond the existing streak/🔥 vocabulary. Hanzi/pinyin always rendered with `className="font-hanzi"`.
11. **Validation gate for every sprint:** `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`. Sprints never touch `src/data/topics.json`, so `validate:data`/`validate:quality` should be unaffected — run them anyway.

---

## Current architecture map

### Routes (`src/app/`) — all static
| Route | Page wrapper | Client component |
|---|---|---|
| `/` | `page.tsx` | `home-app.tsx` (hero, snapshot metrics, onboarding modal, search/filter library, export/import progress) |
| `/topics/[slug]` | SSG, async `params` | `topic-app.tsx` (sticky header, video, tabs: Phrasebook*/Words/Cards/Quiz, next-step panel, tone practice) |
| `/categories/[slug]` | SSG | `category-app.tsx` |
| `/path` | static | `path-app.tsx` (guided sections from `pathSections`) |
| `/review` | static | `review-app.tsx` (SRS due queue, reveal + grade) |
| `/favorites` | static | `favorites-app.tsx` |
| `/stats` | static | `stats-app.tsx` (stat grid, streak chip, trickiest-words grid) |
| `/offline`, `/privacy` | static | — |

\* Phrasebook tab only on `useful-phrases` topics (`isUsefulPhraseTopic`).

### Libraries (`src/lib/`)
- **`types.ts`** — `Topic`, `VocabItem` (hanzi/pinyin/english/sentences), `FlashcardStat` (intervalDays/ease/dueAt/reviewCount), `QuizStat` (correct/attempts), `OnboardingState` (has `dailyGoal`), `ProgressState` (schema v3).
- **`progress-logic.ts`** — SM-2-ish scheduler (`scheduleReview`, `defaultStat`, `Grade`, ease clamps), `normalizeProgress` migrations, `computeStreak`, `computeStats` (the /stats grid), `topicProgress` + `MASTERED_INTERVAL_DAYS = 7`, `dueCards` (the /review queue), `computeWeakWords` (trickiest words), `updateQuizStats`.
- **`quiz-logic.ts`** — `QuizMode = "hanzi-english" | "english-hanzi" | "hanzi-pinyin"`, `QuizCard`, `ANSWER_FIELD` (an exhaustive record over QuizMode — the compiler forces every new mode through the whole module), similarity-ranked distractors (`rankedDistractors`, Dice bigrams, tone/char overlap), `buildQuiz`, `itemsForKeys`, injectable `shuffle`.
- **`pinyin.ts`** — `stripToneMarks`, `tonesOf` (vowel-cluster segmentation to a tone array, 5 = neutral), `toneOfSyllable`. Powers tone practice and distractor ranking.
- **`data.ts` / `data-logic.ts`** — dataset binding, `wordKey(topic, item)` = `topic.slug + ":" + item.hanzi`, `getTopic`, `allWords`, `recommendedPath`, `nextTopicAfter`, `pathSections`.
- **`stats-logic.ts`** — re-exports `computeStats`/`computeWeakWords`.
- **`analytics.ts`** — typed no-op/local `track()`.
- **`highlight.ts`, `video.ts`, `video-controls.ts`, `offline.ts`** — search highlighting, video resolution, offline save (not touched by these sprints).

### Client plumbing (`src/components/`)
- **`use-progress.ts`** — the single `useProgress()` hook: loads/saves `learn-10-mandarin-progress-v1`, exposes `progress`, `loaded`, `gradeWord`, `recordQuizAnswer`, `toggleLearnedTopic`, `toggleFavorite*`, `setDailyGoal`, `completeOnboarding`, `exportProgress`/`importProgress`. `recordStudyToday` stamps `studiedDates` on grade/quiz-answer.
- **`use-swipe.ts`** — touchstart/touchend, 50px threshold, `onLeft`/`onRight`. No move-tracking (relevant to Sprint 9).
- **`speak-button.tsx`** — Web Speech synthesis, `zh-CN`, rate 0.85, accepts `className`; renders `null` when `speechSynthesis` is unavailable.
- **`topic/words-panel.tsx`**, **`topic/flashcards-panel.tsx`**, **`topic/quiz-panel.tsx`** — presentational panels; all quiz/flashcard state lives in `topic-app.tsx`.
- **`tone-practice.tsx`** — per-syllable tone picker, a good reference implementation for a new self-contained drill.
- **`topic-card.tsx`** — library card with studied progress bar; **`bottom-nav.tsx`** — 5 fixed items (Home/Path/Review/Favorites/Stats), mobile only.
- **`onboarding.tsx`** — goal options (5/10/20 words/day) already captured into `progress.onboarding.dailyGoal`; `ContinueLearningCard` displays it. Focus-trap modal pattern lives here.

### Dataset facts that matter
`src/data/topics.json`: 14 categories, 102 topics, 1,020 words. Every item has 2+ example sentences, and **every one of the 2,040 sentences contains the item's exact hanzi string** (verified) — sentence cloze (Sprint 8) needs no data changes. Topics have exactly 10 items each.

### Test suite
`npm run test` runs `node --test` over `tests/*.test.mjs`; currently 146 passing tests. Fixture pattern: hand-built minimal topics (`makeTopic` in `tests/progress-logic.test.mjs`), injectable `now`/`shuffle` everywhere.

---

## Dependency & order recommendation

All ten sprints are **independently shippable** — none hard-depends on another. Recommended order balances user value, risk, and shared groundwork:

| Order | Sprint | Why here |
|---|---|---|
| 1 | **S1 Learning feedback polish** | Small, low-risk, and its `previewIntervals` helper + toast component are reused (optionally) by S6 and S9. Good calibration run. |
| 2 | **S3 Practice trickiest words** | Highest learning value per line of code; pure composition of existing `computeWeakWords` + `buildQuiz`. |
| 3 | **S2 Listening quiz mode** | Establishes the "extend `QuizMode`" pattern that S8 repeats. |
| 4 | **S8 Sentence cloze** | Second `QuizMode` extension; trivially safe after S2. |
| 5 | **S6 Review session upgrade** | Touches the most-used practice loop; do it once the feedback polish (S1) is in. |
| 6 | **S7 Daily goal loop** | The **only schema change** (v3 to v4). Isolate it in its own run so migration review is clean. |
| 7 | **S5 Matching pairs game** | New topic tab; includes the tab-bar layout change that S4 then reuses. |
| 8 | **S4 Typed recall** | New topic tab + the most intricate pure logic (pinyin input grading). |
| 9 | **S10 Topic mastery visualization** | Reads everything, writes nothing; best once statuses have data behind them (quiz + SRS activity from earlier sprints). |
| 10 | **S9 Premium flashcard deck feel** | Pure polish, highest CSS/gesture fiddliness, zero logic risk — save for last. |

Soft interactions to be aware of (not blockers):
- **S5 and S4 both add a tab** to the topic mode bar. Whichever ships first implements the scrollable tab bar (spec in S5 sec.6); the second just adds its tab.
- **S1's toast** is reused by S6's summary and S7's goal-met moment if present; both specify inline fallbacks.
- **S10's ring** and **S7's goal ring** share an SVG `ProgressRing` component; whichever ships first creates `src/components/progress-ring.tsx` (spec in S7 sec.3).

---

# Sprint 1 — Learning feedback polish

## 1. Objective and user story
Make every grading action visibly consequential. *As a learner grading flashcards, I want to see when each grade would schedule the next review, get a quick confirmation of what happened, and be warned on the home/stats page when today's inactivity is about to break my streak — so the SRS system feels legible instead of magical.*

## 2. Existing code/data it builds on
- `scheduleReview(existing, grade, now)` and `defaultStat(now)` in `src/lib/progress-logic.ts` — already pure and clock-injectable; interval preview is just calling it without persisting.
- Grade buttons in `src/components/topic/flashcards-panel.tsx` (lines ~75–86) and `src/components/review-app.tsx` (lines ~152–163).
- `computeStreak(studiedDates, today)` and `todayISO()` in `progress-logic.ts`; streak chips already render in `home-app.tsx` (~line 93) and `stats-app.tsx` (~line 83).

## 3. Detailed implementation plan
- **`src/lib/progress-logic.ts`**: add `previewIntervals`, `formatIntervalDays`, and `streakAtRisk` (see sec.5).
- **`src/components/toast.tsx`** (new): minimal transient status component. Props: `{ message: string | null; onDone: () => void }`. Renders a fixed chip above the bottom nav (`fixed bottom-20 left-1/2 -translate-x-1/2 z-50`), `role="status"` `aria-live="polite"`, auto-clears via `setTimeout` (2000 ms) in an effect keyed on `message`. One CSS class `animate-toast-in` in `globals.css` with a reduced-motion override.
- **`flashcards-panel.tsx`**: accept a new prop `stat: FlashcardStat | undefined` (the current word's stat, passed from `topic-app.tsx` as `progress.flashcardStats[currentKey]`). Under each grade button label, render the projected interval, e.g. `good` over `4d`, from `previewIntervals(stat, new Date())`. Small text (`text-[11px] text-slate-500`), inside the existing button (buttons become two-line, keep `min-h-[44px]`).
- **`review-app.tsx`**: same two-line grade buttons using the current card's stat (`progress.flashcardStats[current.key]`). After grading, set toast message `"{hanzi}" scheduled in {formatIntervalDays(n)}` where `n` is the chosen grade's projected interval computed *before* the grade is applied.
- **`topic-app.tsx`**: hold `const [toast, setToast] = useState<string | null>(null)`; set it in the flashcards `onGrade` handler; render `<Toast …/>` once at the end of `<main>`.
- **Streak-at-risk chip**: in `home-app.tsx` and `stats-app.tsx`, where the streak chip renders, branch: if `streakAtRisk(progress.studiedDates ?? [])` show an amber-outline variant: `🔥 {streak}-day streak — practice today to keep it`, linking to `/review`. The existing filled chip stays for the already-studied-today case.

## 4. New/changed TypeScript types
None persisted. Local: `previewIntervals` returns `Record<Grade, number>`.

## 5. Pure logic functions to add (exact behavior)
In `src/lib/progress-logic.ts`:
```ts
/** Projected next interval (whole days) per grade, without persisting anything. */
export function previewIntervals(existing: FlashcardStat | undefined, now: Date): Record<Grade, number>
// = for each grade g: scheduleReview(existing ?? defaultStat(now), g, now).intervalDays

/** "1d" | "6d" | "2w" | "3mo" — days < 7 gives d + "d"; < 60 gives round(d/7) + "w"; else round(d/30) + "mo". */
export function formatIntervalDays(days: number): string

/**
 * True when there is a live streak that today's inactivity would break:
 * computeStreak(dates, today) > 0 AND dates does not include today.
 * (computeStreak already anchors on today-or-yesterday, so this is exactly
 * "streak alive courtesy of yesterday, nothing logged today".)
 */
export function streakAtRisk(studiedDates: string[], today: string = todayISO()): boolean
```
Edge behavior: `previewIntervals(undefined, now)` must equal previews for a brand-new card (`again 1d / hard 1d / good 2d / easy 4d`). `formatIntervalDays(1) === "1d"`, `formatIntervalDays(14) === "2w"`, `formatIntervalDays(90) === "3mo"`. `streakAtRisk([], …) === false`; `streakAtRisk(["<today>"], today) === false`.

## 6. UI/UX details
- Grade buttons: label (capitalize) on top line, projected interval beneath in muted small text; the interval is informational, so wrap it in `aria-hidden="true"` and extend the button's `aria-label` to `Grade as good — next review in 4 days`.
- Toast copy: `"狗" scheduled in 4d` (hanzi in `font-hanzi`). One toast at a time; a new grade replaces the message (and restarts the timer).
- Streak-at-risk chip: amber border, transparent bg (`border-amber-400/60 text-amber-300`), copy above; on `/stats` it replaces the filled chip when at risk. On `/` it renders in the snapshot-card header slot where the filled chip/`Local first` badge sits today.
- Mobile: toast sits above the bottom nav (bottom-20), max-width `max-w-[90vw]`, truncates long hanzi rows.
- Empty states: no due cards means the review page is unchanged; no streak means no chip (unchanged).
- Reduced motion: `.animate-toast-in { animation: none; opacity: 1 }` under the existing media query.

## 7. Persistence/schema impact
**None.** Reads existing `flashcardStats`/`studiedDates` only.

## 8. Test plan
Extend `tests/progress-logic.test.mjs`:
- `previewIntervals` on a fresh card matches `{again:1, hard:1, good:2, easy:4}`; on `{intervalDays:10}` matches `{again:1, hard:11, good:20, easy:30}`; does not mutate its input.
- `formatIntervalDays`: 1, 6, 7, 13, 14, 59, 60, 90.
- `streakAtRisk`: yesterday-only true; today included false; empty false; gap of 2 days (dead streak) false. Use explicit `today` args.

## 9. Manual QA checklist
- [ ] Topic, Cards tab: reveal, see per-grade day labels; grade fires a toast that auto-dismisses.
- [ ] `/review`: same behavior; interval preview matches the "Current interval" line's growth after grading.
- [ ] Study yesterday (fake by editing localStorage `studiedDates`), reload `/` and `/stats` today: at-risk chip; grade one card: chip flips to normal streak chip.
- [ ] VoiceOver/NVDA: grade button reads the projected interval; toast is announced once.
- [ ] `prefers-reduced-motion`: toast appears/disappears with no animation.

## 10. Risks/pitfalls and mitigations
- **Preview drift vs. actual scheduling**: never reimplement interval math in the UI — `previewIntervals` must call `scheduleReview`. Test asserts equality.
- **Toast timer leaks**: clear timeout on unmount/message change in the effect cleanup.
- **`todayISO` is UTC-based** (existing behavior): keep the at-risk chip consistent with `computeStreak` by using the same helpers; do not introduce local-time day math.

## 11. Non-goals
No notification/PWA push, no per-grade undo, no changes to the scheduling algorithm, no toast queueing system.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 1 ("Learning feedback polish") exactly as specified in `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first and follow the repo's conventions (pure logic in `src/lib/progress-logic.ts` with `.ts`-extension runtime imports, tests in `tests/progress-logic.test.mjs` using `node:test`). Add `previewIntervals`, `formatIntervalDays`, and `streakAtRisk` to `src/lib/progress-logic.ts` with the exact signatures/behavior in the doc; add `src/components/toast.tsx` plus an `animate-toast-in` keyframe with a reduced-motion override in `src/app/globals.css`; show projected intervals under the grade buttons in `src/components/topic/flashcards-panel.tsx` (new `stat` prop passed from `topic-app.tsx`) and `src/components/review-app.tsx`; fire a toast after each grade; add the streak-at-risk chip variant to `home-app.tsx` and `stats-app.tsx`. No schema change; do not touch `topics.json`. Do not commit, push, or deploy. Finish by running `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 2 — Listening quiz mode

## 1. Objective and user story
*As a learner, I want a quiz mode where I hear the Mandarin word (no text), pick its English meaning, and can replay the audio — with the hanzi and pinyin revealed after I answer — so I train listening comprehension, not just reading.*

## 2. Existing code/data it builds on
- `src/lib/quiz-logic.ts`: `QuizMode` union, `ANSWER_FIELD` exhaustive record, `distractorScore` switch, `buildQuizCard` (already carries `promptPinyin`), injectable shuffle. Adding a mode is compiler-guided: TypeScript errors at every switch/record until handled.
- `SpeakButton` (`speechSynthesis`, `zh-CN`, feature-detected) — the mode reuses `window.speechSynthesis` directly for a large play button.
- `QuizPanel` mode chips + prompt area; `topic-app.tsx` owns `quizMode` state and `recordQuizAnswer`.

## 3. Detailed implementation plan
- **`quiz-logic.ts`**:
  - `export type QuizMode = "hanzi-english" | "english-hanzi" | "hanzi-pinyin" | "listening"`.
  - `ANSWER_FIELD.listening = "english"`.
  - `distractorScore` case `"listening"`: same body as `"hanzi-english"` (English-answer similarity); refactor into a shared helper `englishAnswerScore(candidate, target)` used by both cases rather than duplicating.
  - `buildQuizCard`: for `listening`, `prompt = item.hanzi` and `promptPinyin = item.pinyin` (the panel decides visibility).
- **`src/components/topic/quiz-panel.tsx`**:
  - Add a 4th mode chip `{ key: "listening", label: "Listen 🔊" }`. Gate the chip behind speech support: detect `"speechSynthesis" in window` in a `useEffect` in `topic-app.tsx` (hydration-safe, default `false`) and pass `speechAvailable: boolean` into `QuizPanel`; hide the chip when false.
  - Prompt area for `listening`: while `quizState.picked === null`, do **not** render `currentQuiz.prompt`/`promptPinyin`; instead render a large circular play button (72px, emerald) with `aria-label="Play the word"` plus helper text "Listen, then pick the meaning". Tapping it calls a local `speak(currentQuiz.prompt)` helper (`speechSynthesis.cancel()` then speak, `zh-CN`, rate 0.85 — same params as `SpeakButton`). A smaller "Replay" text button sits beside it after first play.
  - After answering (`picked !== null`): reveal `prompt` (hanzi, `font-hanzi text-5xl`) and `promptPinyin` under the play button, with the existing right/wrong choice styling untouched.
  - Do **not** autoplay on question mount (browser gesture policies; avoids surprise audio). The learner taps play for each card.
- **`topic-app.tsx`**: no state changes beyond passing `speechAvailable`; `changeQuizMode("listening")` resets the run exactly like other modes.
- **`analytics.ts`**: no new event — the existing `quiz_completed` already carries `mode`, which now can be `"listening"`.

## 4. New/changed TypeScript types
`QuizMode` union extended (compile-time ripple through `ANSWER_FIELD`, `distractorScore`, mode-chip array). `QuizPanel` props gain `speechAvailable: boolean`.

## 5. Pure logic functions to add (exact behavior)
No new functions — one union member plus the `englishAnswerScore` extraction. Behavior contract for tests: `buildQuizCard(item, pool, "listening", keyFor, identityShuffle)` returns `prompt === item.hanzi`, `promptPinyin === item.pinyin`, `answer === item.english`, 4 unique choices containing the answer.

## 6. UI/UX details
- Copy: chip "Listen 🔊"; pre-answer helper "Listen, then pick the meaning"; post-answer reveal shows hanzi + pinyin exactly where other modes show the prompt.
- Mobile: play button centered, 72×72, thumb-reachable; choices grid unchanged.
- Empty/error: if speech is unsupported, the chip never renders — no dead mode. If a voice fails silently (some Android builds), replay still allows retries and the learner can switch modes; add a muted note under the play button: "No sound? Your device may lack a Chinese voice."
- Accessibility: play button `aria-label="Play the word"`; after answering, the revealed hanzi block gets `role="status"` so the reveal is announced. Choices remain buttons with the existing `aria-selected` pattern.
- Reduced motion: no new animation (reuses existing quiz feedback classes, already guarded).

## 7. Persistence/schema impact
**None.** Answers flow through the existing `recordQuizAnswer` into `quizStats`.

## 8. Test plan
Extend `tests/quiz-logic.test.mjs`:
- Listening card shape (contract in sec.5) with a deterministic identity shuffle.
- `rankedDistractors(item, pool, "listening", identity)` never contains the answer and dedupes identical English values (mirror the existing hanzi-english tests).
- Mode exhaustiveness: building a quiz over each of the 4 modes yields cards whose `answer` matches the expected field.

## 9. Manual QA checklist
- [ ] Topic, Quiz tab, "Listen 🔊": no hanzi/pinyin visible; play button speaks the word; replay works.
- [ ] Answer right/wrong: choice colors as today; hanzi + pinyin appear; "Next question" resets to hidden state.
- [ ] Missed listening words appear in the completion summary and "Retry missed" works.
- [ ] `/stats` trickiest words gains entries from listening mistakes (same `quizStats`).
- [ ] Chip hidden in a browser profile with `speechSynthesis` removed (devtools override).
- [ ] Keyboard-only: play button and choices fully operable.

## 10. Risks/pitfalls and mitigations
- **Hydration mismatch on speech detection**: detect in `useEffect` + state (default `false`), never during SSR render — `SpeakButton`'s inline `typeof window` check is safe only because it returns `null` consistently; for a mode chip, effect-based detection is required.
- **Answer leakage**: the card still contains `prompt`; ensure no `title`/`aria-label` on the play area includes the hanzi before answering.
- **TTS quality varies**: acceptable; the reveal after answering always shows the ground truth.

## 11. Non-goals
No speech *recognition*, no recorded native audio files, no autoplay, no listening mode for `/review` (topic quiz only), no per-mode stats split.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 2 ("Listening quiz mode") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. Extend `QuizMode` in `src/lib/quiz-logic.ts` with `"listening"` (answer field `english`, `prompt` = hanzi, `promptPinyin` = pinyin, distractor scoring shared with `hanzi-english` via an extracted `englishAnswerScore` helper). In `src/components/topic/quiz-panel.tsx` add the "Listen 🔊" mode chip (gated by a `speechAvailable` prop detected in a `useEffect` in `topic-app.tsx`), hide the prompt until answered, render a 72px play button + replay that speaks the hanzi with `speechSynthesis` (zh-CN, rate 0.85, cancel-before-speak), and reveal hanzi + pinyin (`role="status"`) after an answer. No autoplay. No schema change. Add the listening-mode tests described in the doc to `tests/quiz-logic.test.mjs`. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 3 — Practice your trickiest words (`/practice`)

## 1. Objective and user story
*As a learner with quiz history, I want a one-tap practice deck built from my weakest words across all topics — linked from the stats page — so I can attack exactly what I keep getting wrong without hunting through topics.*

## 2. Existing code/data it builds on
- `computeWeakWords(quizStats, opts)` in `progress-logic.ts` — already ranks weakest-first with stable tie-breaks (`minAttempts`/`limit` options).
- The key-to-item resolution pattern in `stats-app.tsx` (builds a Map from wordKey to item/topicSlug/topicTitle over `data.topics`) — to be extracted into a lib.
- `buildQuizCard` / `QuizPanel`-style quiz UI; `recordQuizAnswer`; static page wrapper pattern (`src/app/review/page.tsx` is the template).

## 3. Detailed implementation plan
- **`src/lib/practice-logic.ts`** (new): see sec.5. Resolution + deck building, pure and dataset-parameterized.
- **`src/app/practice/page.tsx`** (new): static wrapper, metadata title "Practice | Learn 10 Mandarin Words", renders `<PracticeApp data={data} />`.
- **`src/components/practice-app.tsx`** (new, `"use client"`): structure mirrors `review-app.tsx`:
  - `useProgress()`; while `!loaded` show `LoadingScreen`.
  - `entries = resolveWeakItems(data.topics, progress.quizStats, { minAttempts: 2, limit: 10 })` — but **snapshot once per session**: seed a `useState` from the first loaded value so answering questions (which mutates `quizStats`) doesn't reshuffle the live deck. Recompute only on "Practice again".
  - Deck: `buildPracticeQuiz(entries, "hanzi-english", defaultShuffle)`. Fixed mode for v1 (hanzi-to-English is the highest-signal recall direction and works for every word).
  - Quiz UI: reuse the visual language of `QuizPanel` (question counter, progress bar, prompt + `SpeakButton`, 4 choices, right/wrong classes, Next button). Implementation note: `QuizPanel` is topic-shaped (mode chips, retry-missed wiring), so build a lean local render rather than forcing that component to bend; each card additionally shows a muted `topicTitle` linking to its topic page (like the review card header).
  - Answers call `recordQuizAnswer(card.key, correct)`.
  - Completion screen: score, missed-word list; actions: "Practice again" (recompute entries from latest `quizStats`, rebuild deck) and "Back to stats".
- **`stats-app.tsx`**: in the "Trickiest words" section header row, add a primary button `Practice these words` linking to `/practice` (rendered when `weakWords.length > 0`).
- **`analytics.ts`**: add `"practice_session_completed"` to `AnalyticsEvent`; fire with count + score on completion.

## 4. New/changed TypeScript types
In `practice-logic.ts`:
```ts
export type PracticeEntry = {
  key: string;            // wordKey
  item: VocabItem;
  topicSlug: string;
  topicTitle: string;
  poolItems: VocabItem[]; // the entry's full topic item list (distractor pool)
  accuracy: number;       // from computeWeakWords
  attempts: number;
};
```

## 5. Pure logic functions to add (exact behavior)
```ts
/** Weakest words resolved to real dataset items. Keys that no longer resolve are dropped. */
export function resolveWeakItems(
  topics: Topic[],
  quizStats: Record<string, QuizStat> | undefined,
  opts: { minAttempts?: number; limit?: number } = {},
): PracticeEntry[]
// = computeWeakWords(quizStats, opts) mapped over a wordKey index of topics: keep resolvable,
//   preserve weak order, carry the owning topic's items as poolItems.

/** One QuizCard per entry; distractors drawn from the entry's own topic items. */
export function buildPracticeQuiz(
  entries: PracticeEntry[],
  mode: QuizMode,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): QuizCard[]
// = entries.map(e => buildQuizCard(e.item, e.poolItems, mode, () => e.key, shuffle))
```
Edge behavior: unresolvable keys (dataset edits) silently dropped; fewer than `limit` entries is fine; 0 entries yields an empty array (UI shows empty state). Distractor pool is per-word (its own 10-word topic), so choices are always same-topic and unique.

## 6. UI/UX details
- Page header: back link `← Stats` (to `/stats`), H1 "Practice", sub "Your trickiest words from every topic, weakest first."
- Empty state (fewer than **3** resolvable weak words): 🎯 icon, "Not enough quiz history yet", "Take a few topic quizzes and your trickiest words will collect here.", buttons "Browse topics" (`/`) and "Daily review" (`/review`). (Threshold 3 avoids a 1-question "deck".)
- Card: topic title link top-right; prompt hanzi `text-7xl font-hanzi` + `SpeakButton`; 4 English choices; progress bar; score.
- Completion: 🎉/💪 per score (reuse quiz-panel thresholds), score `x/n`, "Practice again", "Back to stats".
- Mobile: identical single-column layout to `/review`; `pb-24` for nav clearance.
- Accessibility: same choice-button semantics as `QuizPanel`; back link first in DOM.
- Reduced motion: reuses existing guarded classes only.
- **Nav**: `/practice` is deliberately *not* added to the 5-item bottom nav; entry point is `/stats`.

## 7. Persistence/schema impact
**No schema change.** Reads `quizStats`; writes via existing `recordQuizAnswer` (which also stamps `studiedDates` — streak credit for practicing, consistent with quizzes).

## 8. Test plan
New `tests/practice-logic.test.mjs`:
- `resolveWeakItems`: weak order preserved; unresolvable key dropped; `minAttempts` respected; empty stats yield `[]`; `poolItems` is the owning topic's full item list.
- `buildPracticeQuiz` with identity shuffle: one card per entry, `card.key === entry.key`, answer is the entry's English, choices unique and 4-long when the topic has 4+ distinct English values, distractors all from the entry's own topic.
- Fixtures: two `makeTopic`-style topics with crafted `quizStats`.

## 9. Manual QA checklist
- [ ] Fresh profile: `/practice` shows the empty state.
- [ ] After missing words in 2+ topics' quizzes (2+ attempts each), `/practice` builds a deck of up to 10 cards, weakest first, mixed topics.
- [ ] Deck does not reshuffle mid-run while answering.
- [ ] "Practice again" rebuilds from the updated stats.
- [ ] `/stats` shows "Practice these words" only when trickiest words exist.
- [ ] `next build` output lists `/practice` as static.

## 10. Risks/pitfalls and mitigations
- **Live-recomputing deck** (answers mutate `quizStats`, so a memo would reshuffle mid-session): the snapshot-on-load `useState` pattern in sec.3 is mandatory; add a code comment explaining it.
- **Tiny pools**: a topic with duplicate English glosses can yield fewer than 4 choices; `buildQuizCard` already tolerates fewer distractors — the UI must not assume exactly 4.
- **Key drift after dataset edits**: `resolveWeakItems` drops unresolvable keys by design (same policy as `stats-app`).

## 11. Non-goals
No SRS scheduling for practice (grades stay quiz-style correct/incorrect), no mode selector in v1, no bottom-nav change, no per-session history persistence.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 3 ("Practice your trickiest words") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. Create `src/lib/practice-logic.ts` with `PracticeEntry`, `resolveWeakItems`, and `buildPracticeQuiz` exactly as specified (pure, dataset-parameterized, `.ts`-extension imports of `quiz-logic.ts`/`progress-logic.ts`); create static route `src/app/practice/page.tsx` and client component `src/components/practice-app.tsx` modeled on `review-app.tsx`, with the session-snapshot pattern so the deck never reshuffles mid-run, hanzi-to-English cards with per-word topic distractor pools, `recordQuizAnswer` on each answer, the specified empty state (fewer than 3 entries), and a completion screen with "Practice again". Add a "Practice these words" button to the Trickiest words section of `stats-app.tsx`, and a `"practice_session_completed"` event to `src/lib/analytics.ts`. Add `tests/practice-logic.test.mjs` per the doc. No schema change; no bottom-nav change. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 4 — Typed recall (type the pinyin)

## 1. Objective and user story
*As a learner who wants production (not just recognition), I want to see a hanzi word and type its pinyin — accepted as tone numbers (`gou3`), tone marks (`gǒu`), or bare letters (`gou`) — with grading that tells me whether my letters and my tones were right, so typing effort turns into stronger recall.*

## 2. Existing code/data it builds on
- `src/lib/pinyin.ts`: `stripToneMarks`, `tonesOf` (vowel-cluster segmentation, neutral = 5), `TONE_MARK_TABLE` semantics. The dataset's `pinyin` field is always tone-marked.
- `tone-practice.tsx` for the self-contained-drill component shape and its `displaySyllables` fallback idea.
- Topic tab system in `topic-app.tsx` (`mode` union + `Tab` component); scrollable tab bar from Sprint 5 sec.6 if it shipped first (otherwise implement it here).
- `recordQuizAnswer` for persistence into `quizStats`.

## 3. Detailed implementation plan
- **`src/lib/typed-recall-logic.ts`** (new): grading engine, see sec.5.
- **`src/components/topic/typed-recall-panel.tsx`** (new): self-contained panel; state owned locally (independent of quiz state):
  - Deck = `shuffle(topic.items)` once per mount/restart, index cursor, `input` string, `result: TypedGrade | null`.
  - Layout: counter row ("Word 3 of 10"), hanzi prompt (`text-7xl font-hanzi`) + `SpeakButton` + English gloss beneath (`text-sm text-slate-500` — the meaning is shown; this drill targets *pronunciation recall*, not meaning recall).
  - `<input type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false}>` full-width, at least 16px font, centered; Enter submits (wrap in a `<form>`); "Check" button for touch; "Skip" ghost button advances without recording.
  - On submit: `grade = gradeTypedPinyin(input, current.pinyin)`; call `recordQuizAnswer(key, grade === "correct")`; show feedback block (`role="status"`): correct in emerald "Correct — gǒu."; `tones-off` in amber "Letters right, tones off — it's gǒu (gou3)."; incorrect in rose "It's gǒu (gou3)." Always display the tone-marked pinyin plus its tone-number form via `toneNumberForm(pinyin)`.
  - "Next word" advances; end-of-deck summary: `n/10 correct`, "Try again" reshuffles.
  - Input hint under the field (always visible, `text-xs text-slate-600`): "Type pinyin — tone marks (gǒu), numbers (gou3), or letters only (v = ü)".
- **`topic-app.tsx`**: extend `mode` union with `"typed"`; add `<Tab>` labeled "Type"; render the panel. If Sprint 5 hasn't shipped, also convert the tab `<nav>` from the fixed grid to the scrollable flex spec in Sprint 5 sec.6.
- **`analytics.ts`**: add `"typed_recall_completed"`; fire on deck completion with topic/correct/total.

## 4. New/changed TypeScript types
In `typed-recall-logic.ts`:
```ts
export type TypedGrade = "correct" | "tones-off" | "incorrect";
export type TypedSyllable = { letters: string; tone: Tone | null }; // null = tone not specified
```
`topic-app.tsx` mode union gains `"typed"`.

## 5. Pure logic functions to add (exact behavior)
All in `src/lib/typed-recall-logic.ts` (imports `./pinyin.ts`):
```ts
/** Canonical syllables of dataset (tone-marked) pinyin: lowercase, tone-stripped letters
 *  with ü normalized to v, plus the tone from tonesOf. Separators (space, hyphen, middot,
 *  apostrophe) removed. */
export function expectedSyllables(pinyin: string): TypedSyllable[]   // tone is never null here

/** Parse learner input. Accepts: tone marks (map via TONE_MARK_TABLE), digits 1-5 after a
 *  syllable (0 treated as 5), or no tone (tone: null). "u:" and "v" both mean ü (canonical "v").
 *  Splitting: explicit separators first; a digit always terminates a syllable; otherwise fall
 *  back to vowel-cluster segmentation consistent with tonesOf. Whitespace-only input yields []. */
export function parseTypedPinyin(input: string): TypedSyllable[]

/** Compare: letters must match syllable-by-syllable (concatenated-letters comparison as
 *  fallback when the user typed no separators/digits and cluster-splitting disagrees).
 *  Letters mismatch: "incorrect". Letters match, every syllable's tone specified AND
 *  right: "correct". Letters match but any tone omitted or wrong (incl. fully bare
 *  input): "tones-off". Neutral tone must be typed as 5 in tone-number input; a
 *  mark-free syllable counts as neutral only when the input carries tone marks elsewhere. */
export function gradeTypedPinyin(input: string, expectedPinyin: string): TypedGrade

/** toneNumberForm("gǒu") = "gou3"; multi-syllable concatenates: toneNumberForm("tùzi") = "tu4zi5"
 *  (neutral rendered as 5). */
export function toneNumberForm(pinyin: string): string
```
Concrete cases the implementation must satisfy (these become tests):
- `gradeTypedPinyin("gǒu", "gǒu") === "correct"`; `("gou3", "gǒu") === "correct"`; `("GOU3", "gǒu") === "correct"`.
- `("gou", "gǒu") === "tones-off"`; `("gou2", "gǒu") === "tones-off"`; `("mao", "gǒu") === "incorrect"`.
- ü handling: `("nv3", "nǚ") === "correct"`, `("nu:3", "nǚ") === "correct"`, `("nu3", "nǚ") === "incorrect"`.
- Multi-syllable: `("tu4zi5", "tùzi") === "correct"`, `("tu4zi", "tùzi") === "tones-off"` (second tone unspecified), `("tuzi", "tùzi") === "tones-off"`, `("tu zi", "tùzi") === "tones-off"`, `("zi4tu", "tùzi") === "incorrect"`.
- Apostrophes/spaces/hyphens ignored for letter comparison: `("dui4bu5qi3", "duì bu qǐ") === "correct"`; `("dui4 bu qi3", "duì bu qǐ") === "tones-off"` (the neutral `bu` typed without a tone digit).

## 6. UI/UX details
- Tab label "Type"; panel `aria-label="Typed recall practice"`.
- Feedback is text + color (never color alone); the correct pinyin is always shown after submit in both notations.
- Mobile: never autofocus on tab switch (avoids keyboard jump); input font at least 16px to prevent iOS zoom.
- Empty/error: whitespace-only submit ignored — Check disabled while `parseTypedPinyin(input).length === 0`.
- Accessibility: `<label className="sr-only">` "Type the pinyin for {hanzi}"; feedback `role="status"`; buttons at least 44px.
- Reduced motion: feedback appears without animation (no new keyframes needed).

## 7. Persistence/schema impact
**No schema change.** `recordQuizAnswer(key, grade === "correct")` — `tones-off` persists as incorrect (imperfect recall; usefully feeds Trickiest words and `/practice`). Skips record nothing.

## 8. Test plan
New `tests/typed-recall-logic.test.mjs` covering every literal case in sec.5 plus:
- `expectedSyllables("duì bu qǐ")`: 3 syllables, tones `[4,5,3]`, letters `["dui","bu","qi"]`.
- `parseTypedPinyin("")` and `"   "` yield `[]`; digits without letters (`"3"`) yield `[]` (submit stays disabled).
- `toneNumberForm("gǒu") === "gou3"`, `toneNumberForm("tùzi") === "tu4zi5"`.
- Dataset round-trip sweep: for the first 50 dataset words (import `topics.json` like `tests/data.test.mjs` does), `gradeTypedPinyin(toneNumberForm(p), p) === "correct"`.

## 9. Manual QA checklist
- [ ] Topic, Type tab: tone-marked, tone-number, and bare answers each grade per spec with the right copy.
- [ ] iOS/Android keyboard: no autocapitalize/autocorrect interference; no zoom on focus.
- [ ] Enter submits; Check disabled on empty input; Skip advances silently.
- [ ] Wrong answers surface later in `/stats` trickiest words.
- [ ] Tab bar scrolls/fits with 5–6 tabs on a 360px screen.

## 10. Risks/pitfalls and mitigations
- **Pinyin parsing is the sprint.** Keep every rule in the pure lib with the exact-case tests above; the component contains zero grading logic.
- **Cluster-splitting ambiguity** (e.g. `xian` as one or two syllables): when the user provides no separators/digits, compare concatenated letters (the spec'd fallback) and treat tones as unspecified where uncountable — worst case `tones-off`, never a false `incorrect` on right letters.
- **Keyboard autofocus jank**: focus only via explicit user interaction.

## 11. Non-goals
No hanzi typing/IME drills, no handwriting, no speech recognition, no fuzzy/Levenshtein "almost" scoring, no per-syllable visual diff in v1.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 4 ("Typed recall") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. Create `src/lib/typed-recall-logic.ts` (importing `./pinyin.ts`) with `TypedGrade`, `TypedSyllable`, `expectedSyllables`, `parseTypedPinyin`, `gradeTypedPinyin`, and `toneNumberForm`, satisfying every literal grading case listed in the doc — implement those as tests first in `tests/typed-recall-logic.test.mjs`, including the dataset round-trip sweep. Create `src/components/topic/typed-recall-panel.tsx` per the doc's UI spec (form submit on Enter, Check/Skip, tri-state feedback with `role="status"`, both pinyin notations shown after submit, `recordQuizAnswer(key, grade === "correct")`, Skip records nothing) and wire a new "Type" tab into `topic-app.tsx`'s mode union. If the topic tab bar is still a fixed grid, convert it to the scrollable flex bar specified in Sprint 5 sec.6. Add `"typed_recall_completed"` to `src/lib/analytics.ts`. No schema change. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 5 — Matching pairs game

## 1. Objective and user story
*As a learner, I want a fast tap-to-match game — hanzi tiles on one side, English tiles on the other, five pairs at a time, two rounds per topic — so I get a playful, low-pressure way to bind characters to meanings.*

## 2. Existing code/data it builds on
- Topics always have exactly 10 items, which splits into two clean rounds of 5.
- `defaultShuffle` (injectable) from `quiz-logic.ts`; `wordKey`; `recordQuizAnswer`; quiz feedback CSS (`animate-quiz-correct/wrong`, already reduced-motion-guarded).
- Tab system in `topic-app.tsx`.

## 3. Detailed implementation plan
- **`src/lib/matching-logic.ts`** (new): round building + a pure selection reducer (sec.5). The component holds `useState<MatchingState>` and calls the reducer — all rules testable without React.
- **`src/components/topic/matching-panel.tsx`** (new):
  - Builds rounds once per mount/restart: `buildMatchingRounds(topic.items, keyFor, defaultShuffle)` yields 2 rounds of 5 pairs.
  - Layout: heading row ("Round 1 of 2", matched counter "3/5", attempts counter); two columns (`grid grid-cols-2 gap-3`): left = hanzi tiles (`font-hanzi text-2xl`), right = English tiles (`text-sm font-semibold`, `line-clamp-2`). Each tile at least 56px tall.
  - Interaction (from reducer): tap a tile to select it (emerald outline); tap a tile on the other side to check the match. Match: both tiles lock (emerald fill, `animate-quiz-correct`, then fade to 40% opacity, `disabled`). Mismatch: both flash rose (`animate-quiz-wrong`) and deselect after 350 ms (component timer with a `busy` flag blocking input; the reducer is synchronous). Tapping a same-side tile just moves the selection.
  - Stats: the first time a pair mismatches in a round, `recordQuizAnswer(key, false)` for the **hanzi tile's** word; when a pair matches having never missed this round, `recordQuizAnswer(key, true)`. One signal per word per round, mirroring quiz semantics.
  - Round complete: interstitial "Round 1 done — N taps, M clean matches", button "Round 2". Game complete: summary with total attempts, missed-pairs list (hanzi + pinyin + english), buttons "Play again" (reshuffle both rounds) / "Take the quiz" (callback prop switching mode, like `onPracticeFlashcards`).
- **`topic-app.tsx`**: mode union + tab "Match"; **convert the tab bar** (see sec.6) since this is the first sprint to exceed 4 tabs.
- **`analytics.ts`**: add `"matching_completed"`; fire with topic/attempts/misses.

## 4. New/changed TypeScript types
```ts
export type MatchTile = { key: string; side: "hanzi" | "english"; label: string };
export type MatchingRound = { pairs: { key: string; hanzi: string; english: string }[]; hanziTiles: MatchTile[]; englishTiles: MatchTile[] };
export type MatchingState = {
  selected: MatchTile | null;
  matchedKeys: string[];        // in match order
  missedKeys: string[];         // first-miss keys, deduped
  attempts: number;             // completed two-tile attempts
};
export type MatchOutcome = { state: MatchingState; result: "selected" | "reselected" | "match" | "mismatch" };
```

## 5. Pure logic functions to add (exact behavior)
```ts
/** Chunk items into rounds of roundSize (default 5) preserving shuffle order; each round's
 *  two tile arrays are shuffled independently so columns don't align. */
export function buildMatchingRounds(
  items: VocabItem[], keyFor: (i: VocabItem) => string,
  shuffle?: <T>(x: T[]) => T[], roundSize?: number,
): MatchingRound[]

export function initialMatchingState(): MatchingState

/** Selection rules:
 *  - tile already matched: no-op (same state, result "reselected").
 *  - nothing selected: select (result "selected").
 *  - same side: move selection (result "reselected").
 *  - other side, same key: match — append key to matchedKeys, attempts+1, clear selection.
 *  - other side, different key: mismatch — attempts+1, add the hanzi-side tile's key to
 *    missedKeys if absent, clear selection. */
export function selectTile(state: MatchingState, tile: MatchTile): MatchOutcome
```
Edge behavior: `buildMatchingRounds` with 10 items and identity shuffle yields 2 rounds (first 5, last 5); with 7 items, rounds of 5 and 2 (robust to future non-10 topics). The reducer never mutates its input.

## 6. UI/UX details
- **Tab bar change (shared spec, first implemented here):** replace the tab `<nav>`'s grid classes with `flex gap-2 overflow-x-auto snap-x` and `snap-start shrink-0` on tabs; keep `role="tab"`/`aria-selected`; hide the scrollbar via Tailwind arbitrary properties (`[scrollbar-width:none]` and the webkit-scrollbar variant). Desktop unaffected (all tabs fit).
- Tiles: `aria-pressed` for selection; matched tiles `disabled` + `aria-label="{label}, matched"`. A visually-hidden `role="status"` div announces "Matched {english}" / "Not a match".
- Copy: intro line under the heading — "Tap a word, then tap its match."
- Mobile: two columns fit at 360px (`min-w-0`, English tiles clamp to 2 lines).
- Empty/error states: guard `items.length === 0` and render nothing (match `TonePractice`'s guard).
- Reduced motion: match/mismatch flashes rely on the already-guarded `animate-quiz-*` classes; the matched fade uses opacity-only `transition-opacity` (acceptable under reduced motion).

## 7. Persistence/schema impact
**No schema change.** Writes only via `recordQuizAnswer` (feeds Trickiest words, `/practice`, and the streak).

## 8. Test plan
New `tests/matching-logic.test.mjs`:
- Round building: 10 items into 2 rounds of 5; 7 items into 5+2; identity-shuffle determinism; tiles carry correct keys/labels.
- Reducer walkthrough: select hanzi then matching english gives `match` and attempts 1; the mismatch path adds the hanzi key to `missedKeys` once (a second mismatch on the same pair doesn't duplicate); same-side reselect doesn't bump attempts; selecting a matched tile is a no-op; inputs never mutated.

## 9. Manual QA checklist
- [ ] Topic, Match tab: two rounds play through; counters correct; interstitial and summary render.
- [ ] Mismatch flashes rose then clears; match locks and dims; no double-tap weirdness mid-flash.
- [ ] `/stats` reflects matching misses.
- [ ] Tab bar scrolls smoothly at 360px on Phrasebook topics (6 tabs max).
- [ ] Screen reader announces match/mismatch.

## 10. Risks/pitfalls and mitigations
- **Race during mismatch timer**: block tile taps while the mismatch flash displays (component `busy` state) — the reducer stays pure.
- **Long English glosses**: `line-clamp-2` + smaller right-tile font; QA the longest gloss.
- **Double-recording stats**: recording is round-scoped and deduped via `missedKeys`/`matchedKeys`; keep it in one handler.

## 11. Non-goals
No timers/leaderboards, no drag-and-drop, no audio-matching variant, no cross-topic matching, no persistence of game results beyond `quizStats`.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 5 ("Matching pairs game") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. Create `src/lib/matching-logic.ts` with `MatchTile`, `MatchingRound`, `MatchingState`, `MatchOutcome`, `buildMatchingRounds`, `initialMatchingState`, and `selectTile` exactly per the doc (pure, never-mutating, injectable shuffle), plus `tests/matching-logic.test.mjs` covering the listed reducer walkthroughs and round-building edges. Create `src/components/topic/matching-panel.tsx` per the UI spec (two shuffled columns, selection/match/mismatch flows using the existing `animate-quiz-*` classes, a 350ms mismatch timer with a `busy` guard, round interstitial, final summary, `recordQuizAnswer` once per pair per round on first miss or clean match) and add a "Match" tab to `topic-app.tsx`, converting the tab bar to the scrollable flex spec in sec.6 if not already done. Add `"matching_completed"` to `src/lib/analytics.ts`. No schema change. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 6 — Review session upgrade

## 1. Objective and user story
*As a learner doing my daily review, I want cards I grade "Again" to come back later in the same session, sessions capped to a sane size, and a summary that shows what I struggled with — so a review session actually closes the loop instead of punting failures to tomorrow.*

## 2. Existing code/data it builds on
- `dueCards(topics, flashcardStats, now)` and `scheduleReview` in `progress-logic.ts`.
- `review-app.tsx` — currently indexes into a **live-recomputing** `useMemo` of `dueCards` (grading a card changes `flashcardStats`, which rebuilds `cards` while `cardIndex` marches on). It works incidentally today; this sprint replaces it with an explicit session model.
- Sprint 1's toast + `previewIntervals` (optional integration; inline fallback specified).

## 3. Detailed implementation plan
- **`src/lib/session-logic.ts`** (new): the session state machine (sec.5).
- **`review-app.tsx`** rework of the state layer (rendering largely unchanged):
  - Compute `due = dueCards(...)` once when `loaded` flips true; hold `session` in `useState<ReviewSession | null>(null)`; seed with the render-adjust pattern already used in `topic-app.tsx` (state-during-render on derived change) or a small `useEffect` — implementer's choice, but the queue must **never** rebuild from live `flashcardStats` mid-session.
  - Header: "X of Y" from `session.position + 1` over `session.queue.length`; progress bar likewise. A small requeue badge shows how many requeued cards remain when that count is above 0.
  - `handleGrade`: `gradeWord(currentCard.key, grade)` (persistence unchanged) then `setSession(s => gradeCard(s, grade))`.
  - Completion (`isSessionComplete`): richer summary — grade tally row (Again/Hard/Good/Easy counts as four colored stat chips: rose/amber/slate/emerald), "Toughest this session" list (cards ever graded Again: hanzi/pinyin/english, linked topic), and actions: if `session.remainingDue > 0`, primary "Review N more" (starts a fresh session from a fresh `dueCards` call); else "Learn more words" (`/`); always a ghost "Back to stats" link.
  - Cap: `SESSION_CAP = 20` exported from `session-logic.ts`.
- Scheduling unchanged: an Again card persists via `scheduleReview` immediately (interval 1d) *and* reappears in-session; its in-session regrade calls `gradeWord` again — a second persistence event, deliberate (SM-2-style relearn: regrading Good doubles from the relearned interval). Document with a code comment.

## 4. New/changed TypeScript types
```ts
export type ReviewSession = {
  queue: DueCard[];            // working queue incl. requeued copies
  position: number;            // index of current card
  counts: Record<Grade, number>;
  againKeys: string[];         // deduped keys ever graded "again" this session
  remainingDue: number;        // due cards beyond the cap at session start
};
```

## 5. Pure logic functions to add (exact behavior)
In `src/lib/session-logic.ts` (imports types from `progress-logic.ts`):
```ts
export const SESSION_CAP = 20;
export const AGAIN_GAP = 3; // a requeued card reappears after up to 3 other cards

/** Take the first cap cards; remainingDue = max(0, cards.length - cap). */
export function startSession(cards: DueCard[], cap?: number): ReviewSession

/** Tally the grade; if "again", insert a copy of the current card at
 *  min(position + 1 + AGAIN_GAP, queue.length) and record its key in againKeys;
 *  then advance position by 1. Pure — returns a new session. */
export function gradeCard(session: ReviewSession, grade: Grade): ReviewSession

export function isSessionComplete(session: ReviewSession): boolean  // position >= queue.length

/** Unique againKeys resolved against the queue, first-seen order — the "toughest" list. */
export function toughestCards(session: ReviewSession): DueCard[]
```
Edge behavior: grading the **last** card "again" appends it (the session extends by one — it must be re-passed before completion). `counts` counts every grading event (a twice-graded card contributes twice). `startSession([], …)` is an immediately-complete session (the UI shows the empty state instead).

## 6. UI/UX details
- Header sub-line when capped: "N card session · M more due later"; otherwise current copy.
- Requeue badge: a chip like "2 to re-check" beside the card counter, `aria-label="2 cards will repeat this session"`.
- Summary: four tally chips ("N × Again" etc.), toughest list styled like the quiz missed-words list, buttons per sec.3; container keeps `animate-celebrate` (already reduced-motion-guarded).
- Mobile: unchanged single-card layout.
- Empty state: unchanged ("All caught up!").
- Reduced motion: nothing new beyond existing guarded classes.

## 7. Persistence/schema impact
**No schema change.** Grades persist exactly as today via `gradeWord`; only in-memory session ordering is new.

## 8. Test plan
New `tests/session-logic.test.mjs` (fixtures: hand-built `DueCard[]`):
- `startSession` capping and `remainingDue` (25 cards gives 20/5; 3 gives 3/0).
- `gradeCard("again")` inserts at `position + 4` (gap 3) and appends near the end; last-card-again extends the queue; `againKeys` dedupes double-agains.
- `counts` accumulation across a scripted 6-grade session; `isSessionComplete` boundaries; `toughestCards` order/uniqueness; purity (input session unchanged).

## 9. Manual QA checklist
- [ ] Seed more than 20 due cards (edit localStorage `dueAt`s): header shows "20 card session · N more due later"; completion offers "Review N more".
- [ ] Grade a card Again: it returns about 3 cards later; the requeue badge counts down; grading it Good on return completes it.
- [ ] Grade the final card Again: the session extends by one instead of finishing.
- [ ] Summary tallies match actions; toughest list links work.
- [ ] Sprint 1 interval previews (if shipped) still render on grade buttons.

## 10. Risks/pitfalls and mitigations
- **Queue rebuilding mid-session** (the current latent bug): the session snapshot is the point of this sprint — comment the state seed explaining why `dueCards` must not be a live memo dependency of the queue.
- **Double persistence of Again cards**: intentional (relearn); verify `gradeWord` fires exactly once per grading event.
- **Infinite Again loops**: a learner smashing Again keeps extending the session; acceptable (their choice) — the requeue badge keeps it visible. No hard limit in v1.

## 11. Non-goals
No changes to `scheduleReview` math, no session persistence across reloads (refresh restarts from the live due queue), no per-day review history (Sprint 7's territory), no keyboard-shortcut grading.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 6 ("Review session upgrade") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. Create `src/lib/session-logic.ts` with `SESSION_CAP = 20`, `AGAIN_GAP = 3`, `ReviewSession`, `startSession`, `gradeCard`, `isSessionComplete`, and `toughestCards` per the doc's exact behavior (pure, never mutating; again-cards reinsert at `position + 1 + AGAIN_GAP` clamped to queue end; last-card-again extends the session), with `tests/session-logic.test.mjs` covering the listed cases. Rework `src/components/review-app.tsx` to snapshot `dueCards` into a session once loaded (never a live memo), keep `gradeWord` persistence per grading event, add the requeue badge and capped-session header copy, and build the richer completion summary (grade tally chips, toughest-cards list, "Review N more" when `remainingDue > 0`). No schema change. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 7 — Daily goal loop

## 1. Objective and user story
*As a learner who set a words-per-day goal in onboarding, I want the app to actually count the distinct words I practice each day, show a goal ring on the home and stats pages, and let me edit the goal — so the goal I chose on day one becomes a daily loop instead of dead data.*

## 2. Existing code/data it builds on
- `progress.onboarding.dailyGoal` (5/10/20 from `GOAL_OPTIONS` in `onboarding.tsx`) and the existing-but-unused `setDailyGoal` action in `use-progress.ts`.
- `recordStudyToday` in `use-progress.ts` (stamps `studiedDates`) — the same choke points (`gradeWord`, `recordQuizAnswer`) will record per-word activity.
- `normalizeProgress` migration machinery + schema-version tests in `tests/progress-logic.test.mjs`.
- `todayISO()`; the snapshot card on `/` and the stat grid on `/stats`.

## 3. Detailed implementation plan
- **Schema v4** (the only schema change in this program): add `dailyActivity: Record<string, string[]>` — ISO day mapped to the **distinct wordKeys practiced that day**, pruned to the most recent `DAILY_ACTIVITY_RETENTION_DAYS = 14` days on every write. Storing keys (not counts) makes "N distinct words today" exact; pruning bounds storage (about 14 days of short strings).
- **`src/lib/types.ts`**: add the field to `ProgressState` with a doc comment ("Added in schema v4").
- **`src/lib/progress-logic.ts`**:
  - `CURRENT_PROGRESS_SCHEMA_VERSION = 4` (extend the version-history comment: v3 to v4 adds `dailyActivity`, older saves migrate to an empty map).
  - `emptyProgress.dailyActivity` = empty map; `normalizeProgress` gains `normalizeDailyActivity(raw)` (drop non-array values, non-string members, invalid day keys; keep at most the newest 14 day-keys).
  - New pure fns (sec.5).
- **`src/components/use-progress.ts`**: inside `gradeWord` and `recordQuizAnswer`, wrap the state update to also run `recordDailyPractice(current.dailyActivity, key, todayISO())` — one shared helper `withPractice(current, key)` composed with the existing `recordStudyToday` keeps both call sites identical. The helper also fires the goal-met analytics event on the below-goal-to-at-goal transition (count-before vs. count-after).
- **`src/components/progress-ring.tsx`** (new, shared with Sprint 10): SVG ring. Props: `{ value: number; max: number; size?: number; strokeWidth?: number; label: string; children?: ReactNode }` — circle with `stroke-dasharray` progress (emerald arc on a faint white track, round caps), `role="img"` + `aria-label={label}`, children centered (e.g. "7/10").
- **Home (`home-app.tsx`)**: in the snapshot card, add a "Today" row: `ProgressRing` (size 64) with practiced/goal and copy "words practiced today". Goal met: full ring + "Goal met 🎉". `dailyGoal === 0` (skipped onboarding): a quiet "Set a daily goal on the stats page" link instead of the ring.
- **Stats (`stats-app.tsx`)**: new "Today's goal" card in the stat grid: ring (size 80), practiced/goal, plus an **editable goal** control: the three `GOAL_OPTIONS` chips (export the constant from `onboarding.tsx` and import it) + a numeric input (1–100, `inputMode="numeric"`, labeled "Custom") wired to `setDailyGoal`. Persists immediately.
- **`analytics.ts`**: add `"daily_goal_met"`.

## 4. New/changed TypeScript types
`ProgressState.dailyActivity: Record<string, string[]>` (schema v4). No other type changes.

## 5. Pure logic functions to add (exact behavior)
In `progress-logic.ts`:
```ts
export const DAILY_ACTIVITY_RETENTION_DAYS = 14;

/** New map with key added to today's set (no duplicates), then pruned to the
 *  newest RETENTION days by day-key sort. Pure. */
export function recordDailyPractice(
  activity: Record<string, string[]>, key: string, today: string,
): Record<string, string[]>

/** Distinct words practiced on day (0 when absent). */
export function practicedCountOn(activity: Record<string, string[]> | undefined, day: string): number

/** Practiced/goal/met for today; goal from onboarding.dailyGoal (0 = unset, met stays false). */
export function goalProgress(progress: ProgressState, today?: string): { practiced: number; goal: number; met: boolean }
```
Edge behavior: re-practicing the same word the same day doesn't grow the list; pruning keeps exactly the lexicographically-newest 14 ISO day keys (ISO sorts chronologically); `goalProgress` with `goal === 0` returns `met: false` (UI branches on `goal > 0`); `practiced === goal` means `met: true`.

## 6. UI/UX details
- Ring `aria-label` e.g. "Daily goal: 7 of 10 words practiced today"; center text `text-sm font-bold`.
- Goal editor copy: "Daily goal" label, chips "Casual 5 / Steady 10 / Serious 20" (`aria-pressed` on the active one), "Custom" numeric input.
- Goal-met moment: if Sprint 1's toast exists, fire "Daily goal met — N words today 🎉" once on the transition; otherwise the ring's "Goal met 🎉" text suffices.
- Mobile: ring row fits the snapshot card; goal editor wraps.
- Empty states: `dailyGoal === 0` per sec.3; a new day naturally shows 0 of goal.
- Reduced motion: ring renders at its final arc — guard any `transition` on the arc under the media query.

## 7. Persistence/localStorage/schema impact
**Schema v3 to v4.** Same storage key. Migration: missing/invalid `dailyActivity` becomes an empty map; nothing else changes; export/import round-trips the new field automatically (whole-state serialization). Storage growth bounded by the 14-day prune. This is the sprint's core risk — see tests.

## 8. Test plan
Extend `tests/progress-logic.test.mjs`:
- Migration: a v3 save without `dailyActivity` migrates to an empty map, version stamped 4, all other fields preserved (mirror the existing legacy-save test); corrupt shapes (a number instead of a map, a day mapped to a bare string, a day array holding a number) sanitize without throwing.
- `recordDailyPractice`: same-day dedup; new-day creation; retention prune (insert 16 days, oldest 2 dropped); purity.
- `practicedCountOn` / `goalProgress` incl. `goal: 0` and the exact-goal boundary.
- Round-trip: `normalizeProgress(JSON.parse(JSON.stringify(state)))` preserves `dailyActivity`.

## 9. Manual QA checklist
- [ ] Existing v3 profile loads cleanly; nothing lost; re-save writes v4.
- [ ] Grade flashcards / answer quizzes: home ring fills with **distinct** words (same word twice doesn't double-count).
- [ ] Hit the goal: ring completes, goal-met copy (and toast if S1 shipped) exactly once.
- [ ] Edit goal on `/stats` (chip + custom number): persists across reload; home ring rescales.
- [ ] Skipped-onboarding profile (goal 0) shows the "set a goal" link, no ring.
- [ ] Export, wipe, import: `dailyActivity` restored.

## 10. Risks/pitfalls and mitigations
- **Migration is one-way**: bump + normalize + tests before any UI work; the corrupt-shape tests are non-negotiable.
- **UTC day boundaries**: `todayISO()` is UTC (existing app-wide behavior — streaks already work this way). Stay consistent; no local-time math.
- **Goal-met event duplication**: the transition check lives in the single `withPractice` helper; count-before vs. count-after decides.

## 11. Non-goals
No notifications/reminders, no historical goal charts (14-day retention serves today + at-risk logic, not analytics), no per-activity weighting, no calendar heatmap.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 7 ("Daily goal loop") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. This is the program's only schema change: bump `CURRENT_PROGRESS_SCHEMA_VERSION` to 4, add `dailyActivity: Record<string, string[]>` to `ProgressState`, extend `emptyProgress`/`normalizeProgress` with a sanitizing `normalizeDailyActivity` (never throws, prunes to `DAILY_ACTIVITY_RETENTION_DAYS = 14`), and add `recordDailyPractice`, `practicedCountOn`, and `goalProgress` to `src/lib/progress-logic.ts` per the doc. Write the migration/sanitization/pruning tests in `tests/progress-logic.test.mjs` **first**. Wire recording into `gradeWord` and `recordQuizAnswer` in `src/components/use-progress.ts` via one shared helper that also fires a new `"daily_goal_met"` analytics event exactly on the below-goal-to-at-goal transition. Create `src/components/progress-ring.tsx` (SVG, props per doc, reduced-motion-safe) and add the Today ring to the home snapshot card and a "Today's goal" card with an editable goal (exported `GOAL_OPTIONS` chips + custom numeric input wired to `setDailyGoal`) on `/stats`, including the `dailyGoal === 0` fallback link. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 8 — Sentence cloze quiz mode

## 1. Objective and user story
*As a learner, I want quiz questions that blank the target word out of one of its real example sentences and ask me to pick the right hanzi — so I practice words in context instead of isolation.*

## 2. Existing code/data it builds on
- **Dataset guarantee (verified):** all 2,040 sentences contain their item's exact hanzi string, every item has 2+ sentences — cloze needs zero data work.
- `quiz-logic.ts`'s mode machinery (works identically whether or not Sprint 2 shipped) — `english-hanzi` distractor scoring is exactly right for hanzi-answer cloze.
- `QuizPanel` prompt rendering; `recordQuizAnswer`.

## 3. Detailed implementation plan
- **`quiz-logic.ts`**:
  - `QuizMode` gains `"cloze"`; `ANSWER_FIELD.cloze = "hanzi"`; `distractorScore` case `"cloze"` delegates to the `english-hanzi` branch (extract a shared `hanziAnswerScore`, mirroring Sprint 2's extraction).
  - `QuizCard` gains optional `promptEn?: string` (the sentence's English translation, shown as a hint).
  - New pure helpers + `buildQuizCard` branch (sec.5).
  - Sentence selection is deterministic-under-shuffle: pick via the injected `shuffle` over the item's eligible sentences (`shuffle(eligible)[0]`), so tests pin it with an identity shuffle and real runs vary.
- **`quiz-panel.tsx`**:
  - Mode chip `{ key: "cloze", label: "Fill the blank" }`.
  - Cloze prompt rendering: sentence at `font-hanzi text-3xl leading-relaxed` (not the 7xl single-word size), with the blank rendered by splitting the prompt on `CLOZE_BLANK` into spans and styling the blank segment (`border-b-2 border-emerald-300 px-1`, `<span role="img" aria-label="blank">＿＿</span>`); `promptEn` beneath in `text-sm text-slate-400`. Choices render in `font-hanzi` (same branch as `english-hanzi`).
  - After answering, re-render the sentence with the answer substituted back in emerald (`<span className="text-emerald-300">` around the answer).
  - `SpeakButton`: **hidden pre-answer** for cloze (speaking the sentence would give the word away); post-answer it speaks the complete original sentence.
- **`topic-app.tsx`**: nothing beyond existing mode-chip reset behavior.

## 4. New/changed TypeScript types
`QuizMode` union + `"cloze"`; `QuizCard.promptEn?: string`. Nothing persisted.

## 5. Pure logic functions to add (exact behavior)
In `quiz-logic.ts`:
```ts
export const CLOZE_BLANK = "＿＿"; // two full-width underscores

/** sentence.cn with the FIRST occurrence of hanzi replaced by CLOZE_BLANK.
 *  Returns null when the sentence does not contain the hanzi (defensive; the
 *  dataset currently guarantees containment). */
export function blankSentence(cn: string, hanzi: string): string | null

/** Sentences of item usable for cloze (contain the hanzi). */
export function clozeSentences(item: VocabItem): Sentence[]
```
`buildQuizCard(item, pool, "cloze", keyFor, shuffle)`:
- `eligible = clozeSentences(item)`; if empty, **fall back to an `english-hanzi` card** (identical shape, no `promptEn`) so the mode can never produce a broken question.
- else `s = shuffle(eligible)[0]`; `prompt = blankSentence(s.cn, item.hanzi)`, `promptEn = s.en`, `answer = item.hanzi`, distractors via cloze scoring.
Edge behavior: multi-occurrence sentences blank only the first occurrence (a repeated later occurrence is a hint — accepted); the blanked prompt must differ from the original sentence.

## 6. UI/UX details
- Chip label "Fill the blank".
- Mobile: sentence wraps naturally at `text-3xl`; hanzi choices stay in the 2-col grid.
- Empty/error: impossible by construction (fallback card).
- Accessibility: blank span labeled per sec.3; `promptEn` is plain text; the smaller cloze font branch must also apply to the post-answer reveal state.
- Reduced motion: nothing new.

## 7. Persistence/schema impact
**None.** Same `recordQuizAnswer` flow; cloze mistakes feed Trickiest words and `/practice`.

## 8. Test plan
Extend `tests/quiz-logic.test.mjs`:
- `blankSentence`: first-occurrence-only replacement; `null` on a non-containing sentence; multi-char hanzi.
- Cloze card contract (identity shuffle, fixture items with 2 sentences): `prompt.includes(CLOZE_BLANK)`, `prompt !== s.cn`, `promptEn === s.en`, `answer === item.hanzi`, 4 unique hanzi choices.
- Fallback: an item whose sentences lack the hanzi yields an english-hanzi-shaped card (`prompt === item.english`, no `promptEn`).
- Dataset spot-check: for the first 20 real items (import `topics.json`), a cloze card's prompt contains the blank.

## 9. Manual QA checklist
- [ ] Topic, Quiz tab, "Fill the blank": blanked sentence + English hint; picking the right hanzi restores it in emerald.
- [ ] Speak button absent pre-answer, present (full sentence) post-answer.
- [ ] Retry-missed and mode-switch resets behave like other modes.
- [ ] Long sentences wrap cleanly at 360px.
- [ ] Cloze misses appear on `/stats`.

## 10. Risks/pitfalls and mitigations
- **Answer leakage via repeated hanzi**: accepted, documented; do not over-engineer multi-blanking.
- **A distractor also fits the sentence**: occasionally grammatical; acceptable for v1 — the graded answer is defined by the source sentence.
- **Font sizing**: the 3xl cloze branch must cover both pre- and post-answer states or the reveal will jump to 7xl.

## 11. Non-goals
No typed cloze (choices only), no multi-blank sentences, no sentence audio pre-answer, no English-side cloze, no new sentence data.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 8 ("Sentence cloze quiz mode") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. In `src/lib/quiz-logic.ts` add the `"cloze"` `QuizMode` (answer field `hanzi`, distractor scoring shared with `english-hanzi` via an extracted helper), `CLOZE_BLANK`, `blankSentence`, `clozeSentences`, optional `QuizCard.promptEn`, and the `buildQuizCard` cloze branch with a shuffle-picked sentence and the english-hanzi fallback for non-containing sentences, exactly per the doc. In `src/components/topic/quiz-panel.tsx` add the "Fill the blank" chip and the cloze rendering: 3xl blanked sentence with a styled blank span (`aria-label="blank"`), English hint, answer substituted back in emerald after answering, and the SpeakButton hidden pre-answer / speaking the full sentence post-answer. Extend `tests/quiz-logic.test.mjs` with the blanking, card-contract, fallback, and dataset spot-check tests listed. No schema change; no data changes. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

# Sprint 9 — Premium flashcard deck feel

## 1. Objective and user story
*As a learner, I want the flashcards to feel like a physical deck — a 3D flip on reveal, the card following my thumb as I swipe, a fling to grade, and deck-position dots — so daily practice feels tactile and satisfying rather than like clicking a form.*

## 2. Existing code/data it builds on
- `flashcards-panel.tsx` and `review-app.tsx` card surfaces (both use `useSwipe` with identical left=again / right=easy-or-reveal mapping).
- `use-swipe.ts` (start/end only — no move tracking; superseded on these two surfaces but **left untouched** for API stability).
- `globals.css` animation + reduced-motion patterns.

## 3. Detailed implementation plan
- **`src/lib/gesture-logic.ts`** (new, tiny, testable):
```ts
export const FLING_THRESHOLD_PX = 80;
export type FlingIntent = "again" | "easy" | null;
/** dx >= T gives "easy", dx <= -T gives "again", else null. */
export function flingIntent(dx: number, threshold?: number): FlingIntent
/** Card transform while dragging: translateX(dx px) rotate(deg deg),
 *  deg = dx * 0.06 clamped to plus/minus 12. */
export function dragTransform(dx: number): string
```
- **`src/components/use-card-drag.ts`** (new hook): tracks `touchstart/touchmove/touchend/touchcancel`; exposes `{ handlers, dx, dragging }`; on end computes `flingIntent(dx)` and invokes `onFling(intent)` (caller decides reveal vs. grade); resets `dx`. Ignores multi-touch. Fires `onTap` when total movement < 10px (flip-to-reveal). Claims the gesture only on clear horizontal intent (abs(dx) > abs(dy) and abs(dx) > 10px, then `preventDefault` on move) so vertical page scroll survives.
- **`globals.css`** additions:
  - `.card-scene { perspective: 1200px; }`
  - `.card-3d { transform-style: preserve-3d; transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1); }` plus `.card-3d.is-flipped { transform: rotateY(180deg); }`
  - `.card-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }` / `.card-face-back { transform: rotateY(180deg); }`
  - `.card-fling-left / .card-fling-right` keyframes: translateX minus/plus 120% with rotate minus/plus 15deg and a fade, 0.3s ease-in, fill mode `both`.
  - Reduced-motion block: `.card-3d { transition: none }`, fling animations `none` — degrades to today's instant swap.
- **`flashcards-panel.tsx` rework** (visual structure only; props unchanged, plus `stat` from S1 if present):
  - Card becomes a fixed-height scene (`min-h-[280px]`): front face (hanzi + speak), back face (hanzi smaller + pinyin + english). `revealed` drives `.is-flipped`. Tap anywhere on the card (via `onTap`) reveals — the explicit Reveal button stays for keyboard/AT users.
  - While `dragging && revealed`: inline style `transform: dragTransform(dx)` with `transition: "none"`; side hint labels ("← again" rose / "easy →" emerald) fade in proportional to abs(dx) / FLING_THRESHOLD_PX.
  - On fling: apply `.card-fling-left/right`, call `onGrade` on `onAnimationEnd` with a 350 ms `setTimeout` fallback; a `flinging` flag blocks further input until the grade lands. Under reduced motion, grade immediately.
  - Drag before reveal keeps the current mapping: right flips (reveal), left does nothing.
  - **Deck dots**: a row under the card — one dot per card (10 for topics), current = emerald + wider (`w-4`), earlier = emerald/40, upcoming = white/15; `aria-hidden="true"` (the "Card 4 of 10" counter text already carries the information).
- **`review-app.tsx`**: same treatment; deck dots render only when the session queue is 12 or fewer (longer queues keep just the progress bar).
- Grade buttons remain unchanged beneath the card (the accessibility path).

## 4. New/changed TypeScript types
None beyond the lib/hook signatures above. No persistence.

## 5. Pure logic functions to add (exact behavior)
`flingIntent` and `dragTransform` per sec.3 — exact boundaries: `flingIntent(80) === "easy"`, `flingIntent(-80) === "again"`, `flingIntent(79) === null`; `dragTransform(0) === "translateX(0px) rotate(0deg)"`; rotation clamps so `dragTransform(500)` rotates exactly 12deg.

## 6. UI/UX details
- Flip 0.5s; back-face content matches today's reveal (pinyin emerald 2xl, english xl, interval line on review).
- `cursor-grab`/`active:cursor-grabbing` on pointer devices; swipe-hint chips remain as static hints; first-card tip gains "· tap the card to flip".
- Mobile: drag is touch-only (no mouse-drag in v1).
- Empty/error states: unchanged.
- Accessibility: flip/fling is purely presentational; semantics stay on the real Reveal/grade buttons; focus order unchanged.
- Reduced motion: no flip (faces swap instantly — key face visibility off `revealed` too, so content is correct with `transition: none`), no drag-follow (skip move transforms when the reduced-motion media query matches), no fling animation.

## 7. Persistence/schema impact
**None.**

## 8. Test plan
New `tests/gesture-logic.test.mjs`: threshold boundaries (79/80 on both signs), custom threshold, `dragTransform` format + rotation clamp at 200/500 px both signs, zero case. (Hook/CSS behavior is manual-QA territory — no DOM tests under `node --test`.)

## 9. Manual QA checklist
- [ ] Topic Cards + `/review`: tap flips with 3D rotation; back content correct; buttons still work.
- [ ] Drag right past about 80px after reveal: card flies off, graded easy; left: again; sub-threshold drag springs back.
- [ ] Drag before reveal: right flips (reveal), left does nothing.
- [ ] Vertical page scroll still works when a scroll starts on the card.
- [ ] Deck dots track position on topic cards; `/review` dots only for short queues.
- [ ] `prefers-reduced-motion`: instant reveal, no follow, no fling — identical to pre-sprint behavior.
- [ ] Safari iOS: no backface flicker (add `translateZ(0)` to faces if it appears).

## 10. Risks/pitfalls and mitigations
- **Gesture vs. scroll conflict** is the classic failure: the horizontal-intent guard is mandatory; QA on a real phone.
- **Animation/grade race**: `onAnimationEnd` + timeout fallback prevents a stuck card if the animation is interrupted (tab switch).
- **Double-grade during fling**: the `flinging` flag blocks gesture and button input until the grade lands.
- **iOS backface bugs**: prefixed property included; `translateZ(0)` as the known fix.

## 11. Non-goals
No mouse/pointer dragging, no spring-physics library, no card stack (next cards peeking), no haptics, no undo-fling.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 9 ("Premium flashcard deck feel") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. Add `src/lib/gesture-logic.ts` (`FLING_THRESHOLD_PX = 80`, `flingIntent`, `dragTransform` with the exact boundaries/clamps in the doc) plus `tests/gesture-logic.test.mjs`; add the `src/components/use-card-drag.ts` hook (touchmove tracking, horizontal-intent guard so vertical scroll survives, `onTap` under 10px movement, multi-touch/cancel safety); add the `.card-scene/.card-3d/.card-face/.card-fling-*` CSS to `src/app/globals.css` with complete reduced-motion overrides. Rework the card surfaces in `src/components/topic/flashcards-panel.tsx` and `src/components/review-app.tsx`: 3D flip on reveal (tap-to-flip plus existing buttons kept for keyboard/AT), drag-follow with proportional side hints when revealed, fling-to-grade with an `onAnimationEnd` + timeout fallback and a `flinging` input lock, and deck-position dots (topic: always; review: only when the session queue is 12 or fewer). Leave `use-swipe.ts` untouched. Behavior under `prefers-reduced-motion` must be identical to the pre-sprint experience. No schema change. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`, report results, and flag that this sprint needs on-device manual QA.

---

# Sprint 10 — Topic mastery visualization

## 1. Objective and user story
*As a learner, I want to see at a glance — on topic cards, topic pages, category pages, and stats — which of a topic's ten words are new, learning, mastered, or tricky, so I know exactly where to spend my next session.*

## 2. Existing code/data it builds on
- `topicProgress` + `MASTERED_INTERVAL_DAYS = 7` in `progress-logic.ts` (the mastery threshold already exists; topic pages render "x/10 mastered").
- `quizStats` accuracy (via `normalizeQuizStat`) for the "tricky" signal; `computeWeakWords`'s `minAttempts = 3` convention.
- `topic-card.tsx` (studied progress bar), `topic-app.tsx` hero progress block, `category-app.tsx`, `stats-app.tsx` grid, and `progress-ring.tsx` if Sprint 7 shipped (fallback below).

## 3. Detailed implementation plan
- **`progress-logic.ts`**: word-status derivation (sec.5).
- **`src/components/mastery-dots.tsx`** (new, presentational): props `{ statuses: WordStatus[]; size?: "sm" | "md"; label: string }`. Flex row of dots (sm 8px for cards, md 12px for topic pages): mastered = solid emerald, learning = emerald/40, tricky = rose-400, new = white/15 outline. Container `role="img" aria-label={label}` (e.g. "4 mastered, 3 learning, 1 tricky, 2 new"); dots `aria-hidden`.
- **`topic-card.tsx`**: replace Row 3's studied bar with `MasteryDots` (sm) + the existing "N/10 studied" text (keep the text; drop the bar). Statuses come from a new **optional** prop `quizStats` passed by `home-app.tsx`/`category-app.tsx` (they already own `progress`); when absent, dots are omitted and the card renders as today (other callers compile unchanged).
- **`topic-app.tsx` hero**: under the "studied · mastered" counts line, add `MasteryDots` (md) and a one-line legend of four text chips ("mastered · learning · tricky · new" with matching dot colors) at `text-xs text-slate-500` — the legend renders only on the topic page.
- **`category-app.tsx`**: category header gains a summary pill: "N of M words mastered" from `masterySummary`; per-topic cards get dots via the shared `TopicCard` change.
- **`stats-app.tsx`**: new section "Mastery by category" below the stat grid: grid (`sm:grid-cols-2 lg:grid-cols-3`) of 14 compact cards — category name, `ProgressRing` (value = mastered, max = total words, center text = mastered count), sub-line "N learning · M tricky". Each card links to its category page. If Sprint 7 hasn't shipped, create `src/components/progress-ring.tsx` per Sprint 7 sec.3's spec here; reuse it if it exists.
- No changes to `topicProgress` or its callers — the new derivation is additive.

## 4. New/changed TypeScript types
```ts
export type WordStatus = "new" | "learning" | "mastered" | "tricky";
export type MasterySummary = { mastered: number; learning: number; tricky: number; new: number; total: number };
```
Nothing persisted.

## 5. Pure logic functions to add (exact behavior)
In `progress-logic.ts`:
```ts
export const TRICKY_MAX_ACCURACY = 0.5;
export const TRICKY_MIN_ATTEMPTS = 3;

/** Status precedence: mastered > tricky > learning > new.
 *  mastered: stat exists && intervalDays >= MASTERED_INTERVAL_DAYS
 *  tricky:   quiz attempts >= TRICKY_MIN_ATTEMPTS && accuracy < TRICKY_MAX_ACCURACY (and not mastered)
 *  learning: (stat exists && reviewCount > 0) || quiz attempts > 0 (and not mastered/tricky)
 *  new:      otherwise. Tolerates undefined/corrupt inputs via normalizeStat/normalizeQuizStat semantics. */
export function wordStatus(stat: FlashcardStat | undefined, quiz: QuizStat | undefined): WordStatus

/** Per-item statuses in topic order. */
export function topicWordStatuses(
  topic: Topic, flashcardStats: Record<string, FlashcardStat>, quizStats: Record<string, QuizStat>,
): WordStatus[]

/** Aggregate over topics (a category's, or all). */
export function masterySummary(
  topics: Topic[], flashcardStats: Record<string, FlashcardStat>, quizStats: Record<string, QuizStat>,
): MasterySummary
```
Edge behavior: a mastered word with terrible quiz accuracy stays **mastered** (the SRS interval is the stronger signal; precedence deliberate and documented); corrupt stats never throw; empty progress yields all `new`.

## 6. UI/UX details
- Color is never the only channel: the container `aria-label` carries counts; the topic-page legend names the colors; category pill and stats cards are text-first.
- Stats section sub-copy: "Words per category — mastered when their review interval reaches a week."
- Mobile: 10 sm dots fit easily; stats grid stacks.
- Empty state: the `/stats` mastery section always renders (zeros are informative); fresh profiles show quiet outline dots.
- Reduced motion: rings render statically (S7 guard); dots have no animation.

## 7. Persistence/schema impact
**None.** Pure derivation from existing `flashcardStats` + `quizStats`.

## 8. Test plan
Extend `tests/progress-logic.test.mjs`:
- `wordStatus` truth table: all four statuses, each precedence collision (mastered+tricky gives mastered; tricky+learning gives tricky), undefined inputs give new, corrupt stat objects never throw.
- `topicWordStatuses` ordering matches `topic.items`; `masterySummary` counts sum to the total across mixed fixtures; empty progress gives an all-new summary.

## 9. Manual QA checklist
- [ ] Fresh profile: outline dots everywhere, zeros on stats — nothing looks broken.
- [ ] Grade a word to a 7d+ interval: its dot turns solid emerald on card + topic page; category pill and stats ring tick up.
- [ ] Miss a word repeatedly in quizzes (3+ attempts, under 50%): rose dot; master it later: emerald wins.
- [ ] `aria-label` counts read correctly in a screen reader on a topic card.
- [ ] Home library grid (102 cards) stays smooth; derivation is O(items) with dictionary lookups — start simple, only memoize if profiling shows jank.

## 10. Risks/pitfalls and mitigations
- **Signal disagreement confusion** (mastered-but-tricky): precedence documented in code; the legend keeps expectations set.
- **Render cost on `/`**: cheap per card; avoid premature memoization, measure if needed.
- **Prop drilling**: `TopicCard`'s new prop is optional so `favorites-app` and any other callers compile unchanged.

## 11. Non-goals
No per-word history timelines, no XP/levels, no thresholds beyond the two constants, no changes to `topicProgress` or existing bars elsewhere, no persistence.

## 12. Ready-to-run Opus implementation prompt
> Implement Sprint 10 ("Topic mastery visualization") from `docs/ui-practice-micro-sprints-implementation-plan.md`. Read `AGENTS.md` first. Add `WordStatus`, `MasterySummary`, `TRICKY_MAX_ACCURACY = 0.5`, `TRICKY_MIN_ATTEMPTS = 3`, `wordStatus` (precedence mastered > tricky > learning > new, tolerant of undefined/corrupt inputs), `topicWordStatuses`, and `masterySummary` to `src/lib/progress-logic.ts`, with the truth-table tests in `tests/progress-logic.test.mjs`. Create `src/components/mastery-dots.tsx` (`role="img"` container with a count `aria-label`, four dot styles per the doc). Wire it into `topic-card.tsx` (replacing the studied bar, new optional `quizStats` prop passed from `home-app.tsx` and `category-app.tsx`), the `topic-app.tsx` hero (md dots + one-line legend), a words-mastered pill in `category-app.tsx`, and a "Mastery by category" ring-grid section on `stats-app.tsx` (create `src/components/progress-ring.tsx` per Sprint 7 sec.3 if it doesn't exist yet; reuse it if it does). No schema change. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

## Implementation protocol

1. **One sprint per Opus run.** Jonathan (or Hermes) launches Opus with the sprint's sec.12 prompt verbatim. Opus reads `AGENTS.md` and this document before touching code, implements only that sprint's scope, and stops.
2. **Opus never pushes or deploys.** No `git commit`, `git push`, `vercel`, or any remote mutation from the implementation run. Opus leaves changes in the working tree and reports what it did plus its validation-gate output.
3. **Hermes independently verifies** on the resulting tree:
```bash
npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build
```
4. **Hermes reviews `git status` and the diff**, walks the sprint's Manual QA checklist (sec.9) — on a phone-sized viewport for UI sprints, on-device for Sprint 9 — and only after everything passes: commits, pushes, and deploys.
5. **Schema-change discipline:** Sprint 7 is the only sprint allowed to touch `ProgressState`/`CURRENT_PROGRESS_SCHEMA_VERSION`. If any other sprint appears to need a schema change, stop and re-plan instead of improvising.
6. **Regression watch:** each sprint must leave every existing test green and every existing route static in the `next build` output (currently: `/`, `/offline`, `/path`, `/privacy`, `/review`, `/stats`, `/favorites`, SSG `/topics/[slug]` x102, SSG `/categories/[slug]` x14; Sprint 3 adds static `/practice`).

## Do not build

Explicitly out of scope for this entire program — do not let any sprint drift into:

- **Backend/API of any kind** — no API routes, server actions, serverless functions, cron jobs, or queues.
- **Databases / cloud storage / sync** — no Postgres/KV/Blob/marketplace integrations; do not implement the `CloudSyncProvider` interface (it stays an architecture placeholder).
- **Accounts, auth, or identity** — no login, OAuth, profiles, or multi-device anything.
- **Speech recognition / pronunciation scoring** — no microphone access, no Web Speech `SpeechRecognition`.
- **Handwriting recognition or stroke-order drawing.**
- **Native/recorded audio pipelines** — no audio file generation, hosting, or TTS APIs; `speechSynthesis` only.
- **Third-party or network analytics** — `src/lib/analytics.ts` stays local-only; no transports, no tracking scripts, no Vercel Analytics.
- **New npm dependencies** — no animation, gesture, state, or UI libraries; no icon packs.
- **Service-worker/offline rewrites** — `sw-policy` behavior and `offline.ts` are frozen for this program.
- **Dataset changes** — `src/data/topics.json` and the `scripts/` pipeline are untouched by all ten sprints.
- **Big-bang redesigns** — no theme overhauls, no layout-system rewrites, no route restructuring, no bottom-nav expansion.

## Gate status

Snapshot from the planning pass on **2026-07-02**, on which this document is based. All commands below were actually run.

- `git status`: branch `main`, up to date with `origin/main`, **working tree clean** at commit `8746e5e` ("Point final repaired lessons to rebuilt videos").
- `npm run test`: **146/146 pass** (0 fail, 0 skipped), about 120 ms.
- `npm run validate:data`: All checks passed (14 categories, 102 topics, 1,020 words).
- `npm run validate:quality`: All checks passed (strict quality mode).
- `npm run lint`: clean (no warnings or errors).
- `npm run build`: success. All routes prerendered static/SSG: `/`, `/_not-found`, `/favorites`, `/manifest.webmanifest`, `/offline`, `/path`, `/privacy`, `/review`, `/stats`, `/categories/[slug]` (14 paths), `/topics/[slug]` (102 paths).

Dataset facts verified during planning: every one of the 1,020 items has 2+ example sentences, and all 2,040 sentences contain their item's exact hanzi string (Sprint 8's precondition).
