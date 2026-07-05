# Fable Next 10 Fun Learning Implementation Plan

Detailed Fable plans for 10 new vocabulary-learning sprints focused on fun, playful, local-first practice. Opus should implement exactly one sprint at a time and leave changes uncommitted for Hermes verification.

## Selected sprint list

1. **Daily Challenge: date-seeded 10-question mixed quiz** — A deterministic, same-for-everyone daily quiz drawn from studied topics gives learners a fresh one-tap reason to return every day and feeds the existing streak.
2. **Lightning Round: 60-second timed quiz with personal bests** — A short timed sprint over weak and due words adds adrenaline to review and a locally-stored best score to beat, making repetition self-motivating.
3. **Achievement shelf derived from existing progress data** — Badges computed purely from current localStorage progress (first topic learned, 7-day streak, 100 reviews, perfect quiz) reward milestones learners are already earning invisibly.
4. **In-quiz combo meter with persisted best combo** — A consecutive-correct counter with subtle escalating feedback turns each quiz into a push-your-streak game and nudges careful answering over guessing.
5. **Study heatmap calendar on the stats page** — A GitHub-style year grid rendered from the existing studiedDates makes consistency visible at a glance, which is one of the strongest retention feedback loops.
6. **Shareable score card via canvas + Web Share/clipboard** — Letting learners export a clean image or text snippet of their streak, words learned, or lightning-round score adds a social payoff with zero backend.
7. **Sentence scramble: rebuild example sentences from shuffled chunks** — Reordering the hanzi of existing example sentences trains word order and context recall, exercising vocabulary in a way flashcards and cloze don't.
8. **Listening tone trainer: hear the word, pick the tone pattern** — An audio-first drill using existing TTS and tone parsing trains the ear for tones, complementing the current visual pinyin-to-tone practice.
9. **Topic Boss Round: mixed-skill gauntlet to crown a topic** — A short capstone that pulls one question each from quiz, cloze, typing, and tone drills gives each topic a satisfying finish line and a visible crown on its card.
10. **Pass-and-play duel: two learners, one device, alternating questions** — A local head-to-head quiz with a simple score tally makes practicing with a friend or family member fun without accounts, servers, or leaderboards.

## Shared validation gate

```bash
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

Repo reconnaissance is done — I inspected the quiz engine, progress store, practice/review session patterns, service worker, SEO helpers, and dataset shape. Everything below is grounded in those files. No files were modified.

---

## Sprint 1 — Daily Challenge: date-seeded 10-question mixed quiz

### Goal and user value

Give every learner one tap-worthy reason to open the app each day: a **Daily Challenge** — a 10-question quiz that mixes all three visual quiz modes, drawn from the topics the learner has actually studied, and generated deterministically from today's date. Wordle-style scarcity (one official run per day), a shareable emoji score strip, and a challenge streak make it playful; because every answer flows through the existing `recordQuizAnswer` choke point, it also feeds `quizStats` (weak-word detection), `dailyActivity` (goal ring), and `studiedDates` (the existing streak) for free — real retention value, not a gimmick.

Determinism contract, stated honestly: the deck is a pure function of `(date, studied-topic set)`. Two learners with the same studied topics get the identical deck; a brand-new learner falls back to the curated starter path, so all day-1 users share one deck.

### Current-state findings grounded in actual files/components/helpers

- **Quiz engine is ready and injectable.** `src/lib/quiz-logic.ts` exposes `buildQuizCard(item, pool, mode, keyFor, shuffle)` with an injectable `shuffle` (`defaultShuffle` uses `Math.random`; tests inject identity). `rankedDistractors` shuffles *before* a stable similarity sort, so injecting a **seeded** shuffle makes an entire card build deterministic (`quiz-logic.ts:182-223`). `QuizMode` covers `"hanzi-english" | "english-hanzi" | "hanzi-pinyin" | "listening"`.
- **No seeded RNG exists yet.** Grep for `seed`/`mulberry` finds only session-snapshot comments; `defaultShuffle` is the sole randomness source. A small PRNG must be added.
- **Progress store has a versioned, migration-safe schema.** `src/lib/progress-logic.ts` is at `CURRENT_PROGRESS_SCHEMA_VERSION = 4`; `normalizeProgress` is the single load path and never throws. `dailyActivity` (v4) is the exact precedent for a pruned per-day map, including `normalizeDailyActivity` and `DAILY_ACTIVITY_RETENTION_DAYS = 14`. `computeStreak(dates, today)` already computes consecutive-day streaks from an ISO-day string array — reusable verbatim for a challenge streak.
- **Persistence hook.** `src/components/use-progress.ts` persists to localStorage key `learn-10-mandarin-progress-v1`; `recordQuizAnswer(key, correct)` routes through `withPractice`, which stamps `studiedDates` (streak) and `dailyActivity` (goal ring) — the daily challenge should call it per answer and get all of that for free. `todayISO()` is UTC (`toISOString().slice(0, 10)`), used consistently across streak/goal.
- **"Studied topics" is derivable.** `learnedTopics: string[]` plus the keys of `flashcardStats`/`quizStats`, which are `wordKey`s of shape `` `${topic.slug}:${item.hanzi}` `` (`src/lib/data-logic.ts:43-45`) — slug is recoverable via `key.split(":")[0]`. New-user fallback: `recommendedPath(topics)` (`data-logic.ts:90-95`) always returns ≥ 3 real topics.
- **A page + client-app pattern to copy.** `src/app/practice/page.tsx` (metadata + `<PracticeApp data={data} />`) and `src/components/practice-app.tsx` are the template: session snapshot seeded once after `loaded` via the adjust-state-during-render pattern (`practice-app.tsx:55-57`), `LoadingScreen`, empty state, card UI with choice buttons, completion screen, `usePracticeShortcuts` (1–4 / Enter / P / R), `SpeakButton`, `track(...)`.
- **Mode-aware rendering already solved.** `src/components/topic/quiz-panel.tsx` renders all modes with correct `lang` attributes via `quizPromptLang`/`quizChoiceLang` from `src/lib/lang.ts` (pinyin lines carry `lang="zh-Latn-pinyin"` and `font-hanzi`). Listening mode requires post-hydration speech detection — a per-device condition that would break cross-device determinism, so the daily mix uses the three visual modes only.
- **Analytics is a typed union.** `src/lib/analytics.ts` requires adding `"daily_challenge_completed"` to `AnalyticsEvent`; no provider wiring, `track` is a no-op choke point.
- **Surfaces to touch for a new route.** `sitemapEntries` in `src/lib/seo.ts:99-117` (tested by `tests/seo.test.mjs`); `PRECACHE_URLS` in `public/sw.js:38` (policed by `tests/sw-policy.test.mjs` — same-origin, no media, so adding `/daily` is safe; bump `CACHE_VERSION`); home entry points in `src/components/home-app.tsx` (hero CTAs, "Today's snapshot" card, `ContinueLearningCard`). `BottomNav` already has 5 items — don't add a 6th.
- **Dataset:** 14 categories, 102 topics, 1,020 words (`src/data/topics.json`); every item has `hanzi`/`pinyin`/`english`.
- **Tests run under `node --test`** with `.ts` imports using explicit extensions (see the header comments in `quiz-logic.ts` and `progress-logic.ts`); fixtures inject identity shuffles (`tests/quiz-logic.test.mjs`).
- **Next.js 16 caveat:** `AGENTS.md` mandates reading `node_modules/next/dist/docs/` before writing framework-touching code; the new route should mirror `src/app/practice/page.tsx` conventions exactly rather than trusting training-data Next.js.

### Exact implementation steps in sequence

1. **Read the local Next.js 16 docs** (`node_modules/next/dist/docs/`) for anything relevant to adding an App Router page; confirm the `practice/page.tsx` pattern is current.
2. **Create `src/lib/daily-logic.ts`** (pure, DOM-free, dataset-parameterized):
   - `dateSeed(day)` — FNV-1a hash of the `"YYYY-MM-DD"` string → uint32.
   - `mulberry32(seed)` — standard 32-bit PRNG returning `() => number` in [0, 1).
   - `seededShuffle(rng)` — returns a `<T>(items: T[]) => T[]` Fisher–Yates compatible with `buildQuizCard`'s injectable shuffle.
   - `studiedTopicSlugs(progress)` — set union of `learnedTopics` and slugs parsed from `flashcardStats`/`quizStats` wordKeys (`key.split(":")[0]`).
   - `dailyChallengeTopics(topics, progress)` — topics whose slug is studied; if the studied pool holds fewer than `DAILY_CHALLENGE_SIZE` words, fall back to `recommendedPath(topics)` from `data-logic.ts`.
   - `buildDailyChallenge(topics, progress, day)` — one RNG from `dateSeed(day)`; flatten pool topics to `(topic, item)` pairs **sorted by `wordKey`** (iteration-order independence), seeded-shuffle, take 10 (dedupe by topic-agnostic hanzi is unnecessary — keys are unique); assign modes by cycling a seeded-shuffled copy of `DAILY_MODES` (`hanzi-english`, `english-hanzi`, `hanzi-pinyin`) so every run mixes all three; build each card with `buildQuizCard(item, ownTopicItems, mode, () => wordKey, seededShuffle(rng))`.
   - `shareText(day, outcomes)` — Wordle-style plain-text block (`Daily Mandarin 2026-07-05 · 8/10` + `🟩🟩🟥…` strip). No URLs invented; append the site name only.
3. **Extend the progress schema to v5** in `src/lib/types.ts` + `src/lib/progress-logic.ts`:
   - `DailyChallengeResult = { score: number; total: number; completedAt: string }`; `ProgressState.dailyChallenge: Record<string, DailyChallengeResult>`.
   - Bump `CURRENT_PROGRESS_SCHEMA_VERSION` to 5 with a v4→v5 comment; add `normalizeDailyChallenge` mirroring `normalizeDailyActivity` (valid ISO day keys, clamp `score ≤ total`, non-negative ints, prune to newest `DAILY_CHALLENGE_RETENTION_DAYS = 60`); wire into `normalizeProgress` and `emptyProgress`.
   - `recordDailyChallenge(map, day, result)` — pure, **first completion wins** (existing entry for `day` is kept), returns pruned new map.
   - `challengeStreak(dailyChallenge, today)` — `computeStreak(Object.keys(map ?? {}), today)` (reuse, don't reimplement).
4. **Extend `use-progress.ts`** with `recordDailyChallengeResult(day, score, total)` calling the pure helper inside `setProgress` (no `withPractice` — per-answer `recordQuizAnswer` already stamps study/goal state).
5. **Add `"daily_challenge_completed"`** to the `AnalyticsEvent` union in `src/lib/analytics.ts`.
6. **Create `src/components/daily-app.tsx`** (`"use client"`), structured on `practice-app.tsx`:
   - Snapshot `{ day: todayISO(), questions }` once after `loaded` (adjust-state-during-render pattern, `session === null` guard).
   - Completed-today state (from `progress.dailyChallenge[day]`): celebration card with score, challenge-streak line, share button, links to `/review` and `/practice`; no replay.
   - Active run: question counter, progress bar, mode chip per question, prompt with `lang` via `quizPromptLang` + `SpeakButton` when the prompt is hanzi, choices via `quizChoiceLang` with the emerald/rose correct/wrong classes from `quiz-panel.tsx`; after answering, a reveal line showing the full word — hanzi + pinyin + English (pinyin always accompanies the Chinese, per project rule).
   - Every answer → `recordQuizAnswer(card.key, correct)`; completion → `recordDailyChallengeResult(...)` + `track("daily_challenge_completed", { score, total })`.
   - Keyboard: `usePracticeShortcuts` (1–4, Enter, P; no R — there is no replay).
   - Share: `navigator.clipboard.writeText(shareText(...))` with a "Copied!" flash (mirror `copy-button.tsx`'s pattern).
7. **Create `src/app/daily/page.tsx`** mirroring `practice/page.tsx`: `metadata` (title "Daily Challenge", canonical `/daily`), render `<DailyApp data={data} />`.
8. **Home entry point** in `home-app.tsx`: a Daily Challenge banner card directly above `<ContinueLearningCard />` — undone: "🀄 Today's Challenge · 10 questions from your topics" + "Play" button; done: "✅ Today's Challenge — 8/10 · New one tomorrow". Add a quiet footer link `/daily`.
9. **Route plumbing:** add `/daily` to `sitemapEntries` (priority 0.8, `changeFrequency: "weekly"`); add `"/daily"` to `PRECACHE_URLS` in `public/sw.js` and bump `CACHE_VERSION` to `"v2"`.
10. **Tests:** new `tests/daily-logic.test.mjs`; extend `tests/progress-logic.test.mjs` (v5 migration, first-wins, prune, streak) and `tests/seo.test.mjs` (`/daily` entry). Update any test asserting `emptyProgress`/schema shape.
11. **Run the validation gate** (below) and fix fallout.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/daily-logic.ts` | **new** — seeded RNG + challenge builder + share text |
| `src/lib/types.ts` | `DailyChallengeResult`, `ProgressState.dailyChallenge` |
| `src/lib/progress-logic.ts` | schema v5, normalizer, `recordDailyChallenge`, `challengeStreak` |
| `src/components/use-progress.ts` | `recordDailyChallengeResult` action |
| `src/lib/analytics.ts` | new event name |
| `src/components/daily-app.tsx` | **new** — client UI |
| `src/app/daily/page.tsx` | **new** — route + metadata |
| `src/components/home-app.tsx` | challenge banner card + footer link |
| `src/lib/seo.ts` | `/daily` sitemap entry |
| `public/sw.js` | precache `/daily`, bump cache version |
| `tests/daily-logic.test.mjs` | **new** |
| `tests/progress-logic.test.mjs`, `tests/seo.test.mjs` | extended |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/daily-logic.ts
export const DAILY_CHALLENGE_SIZE = 10;
export const DAILY_MODES: QuizMode[]; // ["hanzi-english", "english-hanzi", "hanzi-pinyin"]

export function dateSeed(day: string): number;
export function mulberry32(seed: number): () => number;
export function seededShuffle(rng: () => number): <T>(items: T[]) => T[];

export type DailyQuestion = {
  card: QuizCard;          // card.key is the wordKey → recordQuizAnswer-ready
  mode: QuizMode;
  topicSlug: string;
  topicTitle: string;
};

export function studiedTopicSlugs(
  progress: Pick<ProgressState, "learnedTopics" | "flashcardStats" | "quizStats">,
): Set<string>;
export function dailyChallengeTopics(topics: Topic[], progress: ...): Topic[];
export function buildDailyChallenge(topics: Topic[], progress: ..., day: string): DailyQuestion[];
export function shareText(day: string, outcomes: boolean[]): string;

// src/lib/progress-logic.ts
export const DAILY_CHALLENGE_RETENTION_DAYS = 60;
export function recordDailyChallenge(
  map: Record<string, DailyChallengeResult> | undefined,
  day: string,
  result: DailyChallengeResult,
): Record<string, DailyChallengeResult>;      // first-completion-wins, pruned
export function challengeStreak(
  map: Record<string, DailyChallengeResult> | undefined,
  today?: string,
): number;

// src/components/daily-app.tsx
export function DailyApp({ data }: { data: MandarinData }): JSX.Element;
```

### UI copy / microcopy

- Page header: **"Daily Challenge"** / subline "Ten questions, fresh every day, drawn from the topics you've studied."
- New-user subline swap: "You're new here — today's challenge uses the starter topics."
- Mode chips: "Hanzi → English", "English → Hanzi", "Hanzi → Pinyin" (match `quiz-panel.tsx` labels).
- Progress: "Question 3 of 10" · "Score 2".
- Reveal line after answering: `狗 · gǒu · dog` (hanzi with `lang="zh-Hans"`, pinyin with `lang="zh-Latn-pinyin"`).
- Completion (perfect): "🏆 Perfect ten!" / (≥8): "🎉 Challenge complete!" / (<8): "💪 Challenge complete — tomorrow's a fresh ten."
- Challenge streak: "🔥 3-day challenge streak" (only when > 0).
- Already done: "✅ You've done today's challenge — 8/10. A new one lands at midnight UTC."
- Share button: "Share score" → flash "Copied!"; share text: `Daily Mandarin — 2026-07-05\n8/10\n🟩🟩🟥🟩🟩🟩🟥🟩🟩🟩\nLearn 10 Mandarin Words`.
- Home banner: "🀄 Today's Challenge" / "10 questions from your topics — keep the streak alive." / button "Play".

### Test plan

`tests/daily-logic.test.mjs` (node --test, identity-free — determinism is the point):
- `mulberry32(dateSeed(day))` is stable: two builds for the same `(topics, progress, day)` produce identical question keys, modes, and choice orders.
- Different days produce different decks (probabilistic but assert on a fixed pair of dates with the real-shaped fixture).
- Deck is independent of topic iteration order (shuffle fixture topic array; same deck).
- Studied-pool selection: only words from studied topic slugs appear; `studiedTopicSlugs` unions `learnedTopics` + stat keys.
- Fallback: empty progress → deck drawn from `recommendedPath` topics; deck length is `min(10, poolWords)`.
- Mode mix: all three modes present in a 10-question deck; each card's choices include its answer, 4 unique choices.
- `shareText`: correct emoji per outcome, score line, no trailing whitespace.

`tests/progress-logic.test.mjs` additions:
- v4 save (no `dailyChallenge`) normalizes to `{}` losing nothing; junk day keys/values dropped; `score` clamped to `total`.
- `recordDailyChallenge`: first result for a day is kept over a second; prunes past 60 days; pure (input untouched).
- `challengeStreak` over consecutive/gapped day keys, anchored today-or-yesterday (mirrors `computeStreak` semantics).

`tests/seo.test.mjs`: `/daily` present with expected priority.

### Manual QA checklist

- [ ] Fresh profile (clear localStorage): home shows the challenge banner; `/daily` shows the starter-topics subline and a playable 10-question run.
- [ ] Refresh mid-run: the same 10 questions come back in the same order (answered progress resets — expected).
- [ ] Answer flow: correct/wrong colors, reveal line always shows pinyin with the hanzi, speak button pronounces hanzi prompts, keyboard 1–4/Enter/P work, keys ignored while typing in the home search field.
- [ ] Complete the run: score screen, share copies the emoji block, `quizStats` grew (check /stats weak words after a few wrong answers), streak/goal ring on home advanced without any other activity today.
- [ ] Revisit `/daily` same day: completed state, no replay; home banner shows the score.
- [ ] Learner with studied topics: deck only contains words from those topics.
- [ ] Import a pre-sprint (v4) progress export: no crash, challenge history empty, everything else intact.
- [ ] Existing app-shell offline behavior still works after the `CACHE_VERSION` bump (load once online, go offline, navigate).
- [ ] Mobile viewport: bottom nav unobstructed, banner and cards render cleanly.

### Acceptance criteria

1. `/daily` serves a 10-question quiz mixing the three visual modes, deterministic per UTC date and studied-topic set; two builds in one day are identical.
2. Words come only from studied topics (learned or with any flashcard/quiz history), falling back to the starter path for new users; every Chinese line carries pinyin.
3. Answers feed `quizStats`, `dailyActivity`, and `studiedDates` via the existing `recordQuizAnswer`; completing the challenge alone keeps the streak alive.
4. One official result per day persists in localStorage (schema v5, migration-safe, pruned); revisits show the completed state with a copyable share block and challenge streak.
5. Home page surfaces the challenge with done/undone states; `/daily` is in the sitemap and service-worker precache.
6. No backend, no new dependencies, no invented vocabulary or metadata; the full validation gate passes.

### Risk and rollback notes

- **Schema bump (v5)** is the riskiest edit — it touches every load path. Mitigation: follow the v4 `dailyActivity` precedent exactly (`normalizeProgress` is the single entry point, never throws, older saves gain `{}`). Rollback: the feature is additive; reverting the commit restores v4 behavior, and v5 saves loaded by v4 code simply carry an ignored extra key (`normalizeProgress` drops unknown fields).
- **UTC day boundary**: `todayISO()` is UTC, so the challenge rolls over at midnight UTC, not local midnight — consistent with the existing streak/goal but worth stating in the "midnight UTC" copy. Snapshot `day` at session start so a run straddling the boundary records against its start day.
- **Determinism drift**: any future change to `rankedDistractors` ordering or the dataset changes decks mid-day for users who haven't played yet — harmless (result-locking is by completion, not by deck hash).
- **`defaultShuffle` bias**: not touched; the new Fisher–Yates lives only in `daily-logic.ts`.
- **Service worker**: cache-version bump invalidates the old shell once; saved lesson videos live in the separate `VIDEO_CACHE` and survive (per `sw.js` activate logic).
- Rollback is a clean revert of one commit: new files deleted, small diffs in shared files restored.

### Non-goals / deferrals

- **Listening questions in the mix** — speech availability is per-device and post-hydration, which breaks cross-device determinism; revisit as an opt-in fourth mode.
- Replay/best-of runs, retro challenge calendar/history UI, challenge streak on `/stats`, bottom-nav slot, push/notification reminders (no backend), Web Share API (`navigator.share`) beyond clipboard, cross-topic distractor pools, difficulty scaling by mastery.

### Ready-to-run Opus implementation prompt for Sprint 1

```text
Implement Sprint 1 — "Daily Challenge: date-seeded 10-question mixed quiz" — in the
learn-10-mandarin-words repo (Next.js 16 / React 19 / Tailwind 4, static, local-first,
no backend). FIRST read AGENTS.md and the relevant guides in node_modules/next/dist/docs/
— this Next.js version may differ from your training data. Model all new code on the
existing patterns cited below; do not add dependencies, invent vocabulary, or add network calls.

1) NEW src/lib/daily-logic.ts (pure, DOM-free, `.ts`-extension imports like quiz-logic.ts):
   - dateSeed(day: string): number — FNV-1a over "YYYY-MM-DD"; mulberry32(seed): () => number;
     seededShuffle(rng): <T>(items: T[]) => T[] (Fisher–Yates), compatible with the injectable
     shuffle in src/lib/quiz-logic.ts buildQuizCard.
   - DAILY_CHALLENGE_SIZE = 10; DAILY_MODES: QuizMode[] = ["hanzi-english","english-hanzi","hanzi-pinyin"]
     (NO "listening" — device-dependent, breaks determinism).
   - studiedTopicSlugs(progress): Set<string> from learnedTopics ∪ slugs parsed from
     flashcardStats/quizStats keys (wordKey format "slug:hanzi", split on first ":").
   - dailyChallengeTopics(topics, progress): studied topics; if their combined word count is
     < DAILY_CHALLENGE_SIZE fall back to recommendedPath(topics) from src/lib/data-logic.ts.
   - buildDailyChallenge(topics, progress, day): DailyQuestion[] — one rng = mulberry32(dateSeed(day));
     flatten pool to (topic,item) pairs SORTED by wordKey (iteration-order independence);
     seeded-shuffle, take 10; modes cycle through a seeded-shuffled copy of DAILY_MODES
     (guarantees a mix); each card via buildQuizCard(item, itsOwnTopic.items, mode, () => wordKey,
     seededShuffle(rng)). DailyQuestion = { card, mode, topicSlug, topicTitle }.
   - shareText(day, outcomes: boolean[]): string — "Daily Mandarin — <day>\n<score>/<total>\n🟩🟥…\nLearn 10 Mandarin Words".

2) Progress schema v4 → v5 (src/lib/types.ts + src/lib/progress-logic.ts), copying the
   dailyActivity v4 precedent exactly: DailyChallengeResult { score; total; completedAt };
   ProgressState.dailyChallenge: Record<string, DailyChallengeResult>; bump
   CURRENT_PROGRESS_SCHEMA_VERSION to 5 with a migration comment; normalizeDailyChallenge
   (valid ISO day keys only, non-negative ints, score ≤ total, prune to newest
   DAILY_CHALLENGE_RETENTION_DAYS = 60) wired into normalizeProgress + emptyProgress;
   recordDailyChallenge(map, day, result) pure, FIRST completion wins, pruned;
   challengeStreak(map, today?) implemented by reusing computeStreak over Object.keys.

3) src/components/use-progress.ts: add recordDailyChallengeResult(day, score, total) using the
   pure helper (do NOT route through withPractice — per-answer recordQuizAnswer already stamps
   studiedDates/dailyActivity). src/lib/analytics.ts: add "daily_challenge_completed".

4) NEW src/app/daily/page.tsx mirroring src/app/practice/page.tsx (metadata title "Daily
   Challenge", canonical "/daily", pass `data` from src/lib/data.ts) and NEW
   src/components/daily-app.tsx modeled on src/components/practice-app.tsx: snapshot
   { day: todayISO(), questions: buildDailyChallenge(...) } once after `loaded` using the same
   session===null adjust-state-during-render pattern; LoadingScreen while loading. If
   progress.dailyChallenge[day] exists render the completed state (score, challenge streak when
   >0, "Share score" button copying shareText via navigator.clipboard with a "Copied!" flash —
   see copy-button.tsx —, links to /review and /practice; NO replay). Active run: "Question N of
   10", progress bar, a mode chip per question ("Hanzi → English" etc.), prompt + choices with
   lang attributes via quizPromptLang/quizChoiceLang (src/lib/lang.ts), SpeakButton only when the
   prompt is hanzi, correct/wrong button styling copied from quiz-panel.tsx, and after answering a
   reveal line "狗 · gǒu · dog" (pinyin ALWAYS accompanies hanzi). Each answer calls
   recordQuizAnswer(card.key, correct); completion calls recordDailyChallengeResult + track. Wire
   usePracticeShortcuts (1–4 choose, Enter next, P speak; no R). Copy tone: playful-but-clean,
   matching practice-app ("🏆 Perfect ten!", "New one lands at midnight UTC").

5) Surfaces: home-app.tsx — a Daily Challenge banner card directly above <ContinueLearningCard/>
   (undone: "🀄 Today's Challenge · 10 questions from your topics" + Play → /daily; done:
   "✅ Today's Challenge — X/10 · New one tomorrow") plus a footer link; src/lib/seo.ts
   sitemapEntries — add "/daily" (priority 0.8, changeFrequency "weekly"); public/sw.js — add
   "/daily" to PRECACHE_URLS and bump CACHE_VERSION to "v2".

6) Tests (node --test style of tests/quiz-logic.test.mjs): NEW tests/daily-logic.test.mjs —
   same-day determinism (two builds identical: keys, modes, choice order), different days differ,
   topic-array-order independence, studied-pool filtering + starter fallback, all three modes
   present, 4 unique choices incl. answer, shareText format. EXTEND tests/progress-logic.test.mjs
   (v4→v5 migration to {}, junk-key dropping, score clamp, first-wins, 60-day prune, challengeStreak)
   and tests/seo.test.mjs (/daily entry). Update any test asserting the emptyProgress shape.

Validation gate — ALL must pass before you are done:
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build
```

---

I've finished the repo survey — everything the Lightning Round needs (weak-word ranking, due-card queue, quiz-card builder, quiz-stat recording, keyboard shortcut machinery, storage conventions) already exists as pure, tested helpers. Here is the plan.

---

## Sprint 2 — Lightning Round: 60-second timed quiz with personal bests

### Goal and user value

A `/lightning` page with a single game loop: press Start, get 60 seconds, answer as many hanzi → English multiple-choice questions as you can. Questions are drawn **due-words-first, then weakest-first** so the adrenaline is spent on exactly the vocabulary that needs reps. Every answer is recorded through the existing `recordQuizAnswer` choke point, so a Lightning run feeds the same quiz stats that power the Trickiest Words list, the daily-goal ring, and the streak — the fun is not a side quest, it *is* review. A locally-stored personal best (score, no account, no network) gives the learner a number to beat, and a small combo multiplier rewards consecutive correct answers without punishing careful play.

### Current-state findings (grounded in actual files)

- **Word supply is solved.** `computeWeakWords` (`src/lib/progress-logic.ts:369`) ranks quizzed words weakest-first from `quizStats`; `dueCards` (`src/lib/progress-logic.ts:327`) returns every word due at-or-before `now` from `flashcardStats`, oldest-due first, already resolved to hanzi/pinyin/english/topic. `resolveWeakItems` (`src/lib/practice-logic.ts:34`) shows the exact pattern for resolving stat keys back to real `VocabItem`s via a `wordKey` index, silently dropping stale keys.
- **Card building is solved.** `buildQuizCard` (`src/lib/quiz-logic.ts:200`) builds a 4-choice card with similarity-ranked distractors from a pool; for `"hanzi-english"` mode it also sets `promptPinyin`, which satisfies the "pinyin on Chinese lines" rule. `buildPracticeQuiz` (`src/lib/practice-logic.ts:65`) shows how to keep distractors same-topic by using each entry's `poolItems`. Shuffle is injectable everywhere, so all new logic is deterministic under test.
- **Answer recording is solved.** `recordQuizAnswer` (`src/components/use-progress.ts:115`) updates `quizStats` and, via `withPractice` (`:34`), stamps `studiedDates` and `dailyActivity` — so Lightning answers count toward the streak and daily goal for free. No schema change needed for that path.
- **Critical component pattern to copy:** `practice-app.tsx:36-57` documents why the deck must be **session-snapshotted**, never a live memo — every `recordQuizAnswer` mutates `quizStats`, and a memo keyed on it would reshuffle mid-run. Lightning must snapshot its pool at Start.
- **Keyboard shortcuts are reusable.** `resolvePracticeShortcut` (`src/lib/shortcut-logic.ts:44`) + `usePracticeShortcuts` (`src/components/use-practice-shortcuts.ts`) already handle digits 1–4 (question phase), `P` speak, `R` restart (done phase), with modifier/repeat/editable-target guards. Lightning auto-advances, so it simply never enters the `"answered"` phase — no changes to the pure lib needed.
- **Storage conventions:** progress lives under `"learn-10-mandarin-progress-v1"` (`use-progress.ts:22`); standalone device-local prefs use their own keys — `"learn-10-mandarin-tone-colors"` (`src/lib/tone-colors.ts:10`), `"learn-10-mandarin-video-rate"` (`video-player.tsx:20`) — each with a pure normalize function tolerant of corrupt values. Personal best follows this standalone-key pattern (no `ProgressState` schema bump; see Risks).
- **Analytics:** `src/lib/analytics.ts` has a typed `AnalyticsEvent` union (no network, no-op by default) — Lightning adds one event name.
- **SEO:** static routes are enumerated in `sitemapEntries` in `src/lib/seo.ts:102-112`; `/practice` is priority 0.8. `/lightning` slots in the same way. The service worker precache list (`public/sw.js:38`) is deliberately small and does not include `/practice` or `/stats`; leave it alone.
- **Styling/motion vocabulary exists:** `globals.css` has `animate-quiz-correct`/`animate-quiz-wrong` (`:129-135`), `animate-celebrate` (`:144`), `progress-bar-track/fill` (`:251-264`), `.kbd` keycaps, and a `prefers-reduced-motion` block (`:224`) every new animation must join. Semantic colors are fixed: emerald = accent, amber = warning (timer running low), rose = danger/wrong (`globals.css:43-49`). `useReducedMotion` (`src/components/use-reduced-motion.ts`) is available for JS-driven motion.
- **Entry points:** `/stats` has a stat-card grid (`stats-app.tsx:137-173`) and a "Trickiest words" section already cross-linking `/practice` (`:189-234`); `/practice` has completion and empty states (`practice-app.tsx:133-158, 172-225`). Bottom nav is at its 5-item capacity (`bottom-nav.tsx`) — don't touch it.
- **Test infra:** `node --test` over `tests/*.mjs`, importing `.ts` libs directly with explicit `.ts` extensions (`tests/practice-logic.test.mjs:4`); components are untestable (no JSX in tests), so all game rules must live in a pure lib.
- **Dataset:** 102 topics × 10 words = 1,020 words (`src/data/topics.json`), every topic has 10 items, so a same-topic distractor pool always fills 4 unique choices. `recommendedPath` (`src/lib/data-logic.ts:90`) provides curated starter topics for the cold-start fallback.
- **AGENTS.md:** Next.js 16 with breaking changes — the implementer must read `node_modules/next/dist/docs/` before writing the new route (this sprint only uses a static metadata page + client component, same shape as `src/app/practice/page.tsx`, but verify).

### Exact implementation steps in sequence

1. **Read the relevant Next.js 16 guide** in `node_modules/next/dist/docs/` (routing/metadata) per `AGENTS.md`, confirming the `page.tsx` + `"use client"` component pattern used by `/practice` is still current.
2. **Create `src/lib/lightning-logic.ts`** — all game rules, pure and DOM-free (signatures below):
   - `buildLightningPool(topics, progress, opts)` — prioritized, deduped entry list: **due** cards first (from `dueCards`, oldest first), then **weak** words (from `computeWeakWords` with `minAttempts: 2`, matching practice-app's threshold), then a **fresh** fill drawn from learned topics and `recommendedPath(topics)` so the round is always playable even with zero history. Dedupe by `wordKey`; resolve via the same index pattern as `resolveWeakItems`; each entry carries its topic's `items` as `poolItems` and a `source: "due" | "weak" | "fresh"` tag. Cap at `LIGHTNING_POOL_SIZE = 40` (a fast player answers ~30 in 60s).
   - `buildLightningDeck(entries, shuffle)` — one `"hanzi-english"` `QuizCard` per entry via `buildQuizCard` (keyed by the entry's `wordKey`), in pool-priority order.
   - Run scoring: `emptyRun()`, `applyAnswer(run, correct)`, `multiplierFor(streak)` — `POINTS_PER_CORRECT = 100`, multiplier `1 + floor(streak / COMBO_STEP)` with `COMBO_STEP = 3`, capped at `MAX_MULTIPLIER = 3`; a wrong answer resets streak (and multiplier) but never subtracts points.
   - Personal best: `normalizeLightningBest(raw)` (never throws, coerces corrupt/negative/non-finite values to a safe zero-state, mirroring `normalizeQuizStat`'s style) and `mergeRunIntoBest(best, run, now)` returning `{ best, isNewBest }`. `isNewBest` only when `run.score > best.bestScore` **and** `run.answered > 0`.
   - `remainingMs(endsAt, now)` — clamped-to-zero countdown math, so the timer derives from a wall-clock deadline (drift/tab-blur safe).
3. **Create `src/components/use-lightning-best.ts`** — tiny client hook mirroring `use-tone-colors.ts`: lazy-init from `LIGHTNING_STORAGE_KEY` through `normalizeLightningBest`, `recordRun(run)` writes through `mergeRunIntoBest` and returns `isNewBest`. All storage access in try/catch.
4. **Create `src/components/lightning-app.tsx`** (`"use client"`), structured like `practice-app.tsx`:
   - `useProgress()` for `progress`, `loaded`, `recordQuizAnswer`; `useLightningBest()`; `useSpeech()`; `useReducedMotion()`.
   - Three phases: `"idle"` (start screen with personal best), `"running"`, `"done"`.
   - **Start**: snapshot `{ entries, deck }` once (the practice-app session-snapshot pattern — never rebuild while `quizStats` mutates mid-run), set `endsAt = Date.now() + LIGHTNING_DURATION_MS`, reset run state.
   - **Timer**: a ~100 ms `setInterval` recomputing `remainingMs(endsAt, Date.now())` into state; when it hits 0, clear the interval, move to `"done"`, call `recordRun`, and fire `track("lightning_completed", { score, answered, correct, bestStreak, newBest })`. Recompute on `visibilitychange` too so a backgrounded tab ends honestly.
   - **Answer flow**: guard `remaining > 0 && picked === null`; `recordQuizAnswer(card.key, correct)`; `applyAnswer`; show the existing `animate-quiz-correct`/`animate-quiz-wrong` feedback on the picked button for ~350 ms via timeout, then auto-advance (no Next button — that's the "lightning" feel). When the deck index reaches the end, wrap around with a reshuffled deck (`buildLightningDeck(entries, defaultShuffle)`), so the supply never runs dry.
   - **Shortcuts**: `usePracticeShortcuts` with `phase: done ? "done" : "question"` (auto-advance means `"answered"` is never surfaced), digits 1–4 to answer, `P` to pronounce, `R` to go again from the results screen.
   - **Timer UI**: large mono countdown (`0:37`) + a full-width `progress-bar-track` draining left; at ≤ 10 s the fill and digits switch emerald → amber (`--color-warn`), at ≤ 5 s → rose. Color change only — any pulse animation must be inside the `prefers-reduced-motion` block.
   - Prompt: hanzi in `font-hanzi` (7xl, matching `practice-app.tsx:249`) with `card.promptPinyin` beneath it in emerald (pinyin-on-Chinese-lines rule), plus `SpeakButton`.
   - **Results**: `animate-celebrate` card — score, answered/correct, best combo, and either the "New personal best" banner or "Best: N" with the gap; buttons **Go again** (R) and **Back to stats**.
5. **Create `src/app/lightning/page.tsx`** — mirror `src/app/practice/page.tsx`: `Metadata` (title "Lightning Round", canonical `/lightning`) rendering `<LightningApp data={data} />`.
6. **Add entry points** (no bottom-nav change):
   - `stats-app.tsx`: a linked `StatCard` in the existing grid — value = formatted best score (or "⚡"), label "lightning best", sublabel "60-second challenge", `href="/lightning"`. Reading the best inside `StatsApp` via `useLightningBest` keeps it live.
   - `practice-app.tsx`: on the completion summary, a secondary link "Try a Lightning Round ⚡" next to "Back to stats".
7. **Wire the seams**: add `"lightning_completed"` to the `AnalyticsEvent` union (`src/lib/analytics.ts:15`); add `{ url: absoluteUrl("/lightning"), priority: 0.8, changeFrequency: "monthly" }` to `sitemapEntries` in `src/lib/seo.ts` beside `/practice`.
8. **Add `tests/lightning-logic.test.mjs`** (details in Test plan), following the fixture style of `tests/practice-logic.test.mjs`.
9. **Run the full validation gate** and the manual QA checklist; leave changes uncommitted.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/lightning-logic.ts` | **new** — pool, deck, scoring, best-score, countdown math |
| `src/components/use-lightning-best.ts` | **new** — localStorage hook for the personal best |
| `src/components/lightning-app.tsx` | **new** — game UI |
| `src/app/lightning/page.tsx` | **new** — route + metadata |
| `src/lib/analytics.ts` | add `"lightning_completed"` event name |
| `src/lib/seo.ts` | add `/lightning` to `sitemapEntries` |
| `src/components/stats-app.tsx` | add Lightning `StatCard` |
| `src/components/practice-app.tsx` | add "Try a Lightning Round" link on the done screen |
| `tests/lightning-logic.test.mjs` | **new** — unit tests |

Not touched: `use-progress.ts` / `progress-logic.ts` (no schema bump), `shortcut-logic.ts`, `bottom-nav.tsx`, `public/sw.js`, any data or scripts.

### Proposed names and TypeScript signatures

```ts
// src/lib/lightning-logic.ts
import type { FlashcardStat, QuizStat, Topic, VocabItem } from "./types";
import type { QuizCard } from "./quiz-logic.ts";

export const LIGHTNING_DURATION_MS = 60_000;
export const LIGHTNING_POOL_SIZE = 40;
export const POINTS_PER_CORRECT = 100;
export const COMBO_STEP = 3;       // every 3 consecutive correct → +1 multiplier
export const MAX_MULTIPLIER = 3;
export const LIGHTNING_STORAGE_KEY = "learn-10-mandarin-lightning-v1";

export type LightningSource = "due" | "weak" | "fresh";

export type LightningEntry = {
  key: string;                 // wordKey (`topic.slug:hanzi`)
  item: VocabItem;
  topicSlug: string;
  topicTitle: string;
  poolItems: VocabItem[];      // same-topic distractor pool
  source: LightningSource;
};

export function buildLightningPool(
  topics: Topic[],
  progress: { quizStats?: Record<string, QuizStat>; flashcardStats?: Record<string, FlashcardStat>; learnedTopics?: string[] },
  opts?: { now?: Date; limit?: number; shuffle?: <T>(items: T[]) => T[] },
): LightningEntry[];

export function buildLightningDeck(
  entries: LightningEntry[],
  shuffle?: <T>(items: T[]) => T[],
): QuizCard[];

export type LightningRun = {
  score: number;
  answered: number;
  correct: number;
  streak: number;       // current consecutive-correct run
  bestStreak: number;
  multiplier: number;   // derived, stored for display: multiplierFor(streak)
};

export function emptyRun(): LightningRun;
export function multiplierFor(streak: number): number;
export function applyAnswer(run: LightningRun, correct: boolean): LightningRun;

export type LightningBest = {
  bestScore: number;
  bestCorrect: number;
  runs: number;
  updatedAt: string | null;   // ISO, or null before the first run
};

export function normalizeLightningBest(raw: unknown): LightningBest;
export function mergeRunIntoBest(
  best: LightningBest,
  run: LightningRun,
  now?: Date,
): { best: LightningBest; isNewBest: boolean };

export function remainingMs(endsAt: number, now: number): number; // clamped ≥ 0
```

```ts
// src/components/use-lightning-best.ts
export function useLightningBest(): {
  best: LightningBest;
  loaded: boolean;
  recordRun: (run: LightningRun) => boolean; // returns isNewBest
};
```

Multiplier note (document in code): points per correct answer = `POINTS_PER_CORRECT * multiplierFor(streakBeforeThisAnswer + 1)` — i.e. answers 1–3 score ×1, 4–6 score ×2, 7+ score ×3; one miss resets to ×1.

### UI copy / microcopy

- **Page header**: `Lightning Round` / sub: `60 seconds. Your due and trickiest words. Beat your best.`
- **Start screen (has best)**: `Personal best` + score; button `⚡ Start 60-second round`; hint `1–4 answer · P pronounce`.
- **Start screen (no best)**: `No best score yet — set the bar.`
- **During**: timer `0:42`; `Score 1,300`; combo chip `×2 combo` (only when multiplier > 1); question counter `#12`.
- **Time up (new best)**: `⚡ New personal best!` / `Old best: 1,200`.
- **Time up (not a best)**: `Time's up!` / `Best: 1,900 — 400 to beat it.`
- **Results detail line**: `14 answered · 11 correct · best combo ×3`.
- **Buttons**: `Go again` / `Back to stats`; shortcut hint `Press R to go again`.
- **Stats card**: value = best score (or `⚡`), label `lightning best`, sublabel `60-second challenge` (or `try your first round`).
- **Practice done-screen link**: `Try a Lightning Round ⚡`.

### Test plan

`tests/lightning-logic.test.mjs`, `node --test`, deterministic identity shuffle and injected `now` throughout:

1. **Pool priority**: with fixtures containing due + weak + fresh candidates, entries come due-first (oldest due first), then weak (weakest first), then fresh; `source` tags correct.
2. **Pool dedupe**: a word that is both due and weak appears once, as `"due"`.
3. **Pool fallback**: empty progress still yields a non-empty pool drawn from `recommendedPath`/first topics; unresolvable stat keys are dropped silently.
4. **Pool cap**: never exceeds `limit` (default `LIGHTNING_POOL_SIZE`).
5. **Deck**: one card per entry, `card.key === entry.key`, 4 unique choices from `poolItems`, `promptPinyin` present (hanzi-english mode).
6. **Scoring**: `applyAnswer` sequences — 3 correct = 300; 4th correct = +200 (×2); miss resets streak/multiplier but not score; `bestStreak` retained; 7+ streak capped at ×3; wrong answers never decrease score.
7. **`multiplierFor`**: 0–2 → 1, 3–5 → 2, ≥6 → 3 (cap).
8. **`normalizeLightningBest`**: `null`, `"junk"`, negative/`NaN`/float fields, missing keys → safe zero-state; valid stored object round-trips.
9. **`mergeRunIntoBest`**: higher score → `isNewBest: true`, fields updated, `runs` incremented; equal/lower score → best preserved, `runs` still incremented; zero-answered run never sets a best.
10. **`remainingMs`**: mid-run value, exact-zero, past-deadline clamps to 0.

### Manual QA checklist

- [ ] Fresh profile (cleared localStorage): `/lightning` start screen shows "No best score yet", round is playable (fresh-fill pool), results save a best.
- [ ] With existing quiz/review history: first questions visibly come from due/tricky words (cross-check against `/stats` Trickiest words).
- [ ] Timer counts 60 → 0; drains bar; turns amber ≤10 s, rose ≤5 s; questions lock instantly at 0 (rapid-click at the buzzer records nothing after time-up).
- [ ] Wrong answer: shake animation, correct choice revealed briefly, auto-advance; correct answer: pop animation, score/combo update.
- [ ] Combo chip appears at 3-streak, disappears on a miss.
- [ ] Personal best persists across reload; beating it shows the new-best banner; not beating it shows the gap.
- [ ] Answers recorded: after a round, `/stats` quiz accuracy / trickiest words / daily-goal ring / streak reflect the run.
- [ ] Keyboard: 1–4 answer, P pronounces, R restarts from results; keys dead while an input is focused elsewhere; no browser-shortcut clobbering (Cmd/Ctrl combos ignored).
- [ ] Background the tab mid-run, return after 60 s: round has ended honestly (no frozen timer).
- [ ] Reduced motion (OS setting): no shake/pop/celebrate/pulse; color-only urgency still works.
- [ ] Mobile viewport: 44 px+ touch targets, bottom-nav padding respected (`pb-24` pattern), no layout jump when the combo chip appears.
- [ ] Pinyin visible under every hanzi prompt; `SpeakButton` pronounces the prompt.
- [ ] `/lightning` appears in the generated sitemap; stats-page Lightning card and practice done-screen link both navigate correctly.

### Acceptance criteria

1. `/lightning` builds statically and passes the full gate (`npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`).
2. A 60-second round can always be started, regardless of prior history, and question order prioritizes due words then weak words.
3. Every answer flows through `recordQuizAnswer` (verifiable in `/stats` afterward); SRS `flashcardStats` are untouched by Lightning.
4. Personal best is stored only in `localStorage` under `learn-10-mandarin-lightning-v1`, survives reload, and never regresses from a lower-scoring run.
5. Combo scoring matches the documented multiplier table and is fully unit-tested.
6. Timer is wall-clock-anchored (`endsAt`), locks input at zero, and respects `prefers-reduced-motion` for all new animation.
7. No new dependencies, no network calls, no invented vocabulary — all words come from `src/data/topics.json`.
8. New game rules live entirely in `src/lib/lightning-logic.ts` with `tests/lightning-logic.test.mjs` coverage; the component contains only state wiring and rendering.

### Risk and rollback notes

- **Blast radius is small by design**: four new files plus three one-line-ish edits (`analytics.ts`, `seo.ts`, stats/practice links). Rollback = delete the new files and revert the three edits; no data migration to unwind because `ProgressState` is untouched.
- **Best-score outside `ProgressState`** (deliberate): avoids a schema v5 bump and `normalizeProgress` churn mid-sprint. Trade-off: `exportProgress`/`importProgress` won't carry the best score across devices. Accepted for now; noted as a deferral.
- **Per-answer state writes**: each answer triggers a `useProgress` setState + localStorage write (~30 writes/round). `practice-app` already does exactly this per answer; payloads are small — no new risk, but the implementer should keep the deck snapshot pattern so those writes can't reshuffle the run.
- **Timer correctness**: interval-based countdowns drift and pause in background tabs — hence the `endsAt` deadline + `visibilitychange` recheck. The failure mode (round ends when the tab returns) is honest and rated acceptable.
- **`Date.now()` in a client component is fine** (no SSR mismatch) as long as nothing time-derived renders before the run starts; the idle screen must not render the timer.
- **Auto-advance feedback window (~350 ms)**: keep it long enough to see the correct answer flash but short enough to feel fast; make it a named constant so tuning is one line.

### Non-goals / deferrals

- No new quiz modes (pinyin/listening/typing variants of Lightning) — hanzi → English only this sprint.
- No SRS grading from Lightning answers (`gradeWord` untouched); a timed guess is not a flashcard grade.
- No leaderboards, sharing, or any network feature — personal best is device-local by product constraint.
- No bottom-nav item (5-slot bar stays as is); entry via `/stats` and `/practice`.
- No sound effects/haptics; no confetti library.
- Folding the best score into `ProgressState` (schema v5) so export/import carries it — deferred until the next progress-schema change.
- No per-source stats on the results screen (e.g. "6 due words cleared") — nice later, needs no schema.

### Ready-to-run Opus implementation prompt for Sprint 2

```text
You are implementing exactly ONE sprint in the repo at /home/nvidia/learn-10-mandarin-words
(Learn 10 Mandarin Words — Next.js 16 / React 19 / Tailwind 4, static, local-first,
no backend/login/analytics-network). Keep the diff focused on this sprint and leave
all changes UNCOMMITTED.

FIRST: read AGENTS.md, then the relevant routing/metadata guide in
node_modules/next/dist/docs/ — this Next.js 16 has breaking changes vs your training data.

SPRINT: Lightning Round — a /lightning page with a 60-second timed hanzi→English
multiple-choice quiz over the learner's due and weakest words, with a localStorage
personal best and a small combo multiplier.

Reuse, do not reinvent:
- Word supply: dueCards + computeWeakWords (src/lib/progress-logic.ts), resolution
  pattern from resolveWeakItems (src/lib/practice-logic.ts), wordKey (src/lib/data-logic.ts),
  cold-start fill from learned topics then recommendedPath.
- Cards: buildQuizCard in "hanzi-english" mode (src/lib/quiz-logic.ts) with same-topic
  poolItems; promptPinyin must render under the hanzi prompt (pinyin-on-Chinese-lines rule).
- Recording: every answer goes through recordQuizAnswer from useProgress
  (src/components/use-progress.ts). Do NOT call gradeWord, do NOT change ProgressState
  or its schema version.
- Shortcuts: usePracticeShortcuts with phase "question"/"done" (auto-advance, no
  "answered" phase). Do not modify src/lib/shortcut-logic.ts.
- Component structure: copy practice-app.tsx's session-snapshot pattern — snapshot the
  {entries, deck} at Start and never rebuild from live quizStats mid-run (answers mutate
  quizStats every question).

Build:
1. src/lib/lightning-logic.ts (pure, DOM-free, all constants exported):
   LIGHTNING_DURATION_MS=60000, LIGHTNING_POOL_SIZE=40, POINTS_PER_CORRECT=100,
   COMBO_STEP=3, MAX_MULTIPLIER=3, LIGHTNING_STORAGE_KEY="learn-10-mandarin-lightning-v1";
   buildLightningPool(topics, progress, opts) → due-first (oldest due), then weak
   (computeWeakWords, minAttempts:2), then fresh fill; dedupe by wordKey; entries carry
   {key, item, topicSlug, topicTitle, poolItems, source:"due"|"weak"|"fresh"};
   buildLightningDeck(entries, shuffle) via buildQuizCard;
   emptyRun/applyAnswer/multiplierFor (multiplier = min(MAX_MULTIPLIER, 1+floor(streak/COMBO_STEP)),
   points per correct = POINTS_PER_CORRECT × multiplier at the streak INCLUDING this answer,
   miss resets streak, never subtracts points, track bestStreak);
   normalizeLightningBest(raw) (never throws; corrupt → zero-state) and
   mergeRunIntoBest(best, run, now) → {best, isNewBest} (new best only if score strictly
   higher AND answered > 0; always increments runs);
   remainingMs(endsAt, now) clamped ≥ 0.
   Follow the repo's runtime-import convention: value imports from sibling libs use
   explicit ".ts" extensions (see practice-logic.ts) so node --test resolves them.
2. src/components/use-lightning-best.ts — client hook mirroring use-tone-colors.ts:
   read/normalize on init, recordRun(run) persists via mergeRunIntoBest and returns isNewBest;
   all storage in try/catch.
3. src/components/lightning-app.tsx — "use client"; phases idle/running/done; Start snapshots
   the deck and sets endsAt = Date.now() + LIGHTNING_DURATION_MS; ~100ms interval derives
   remainingMs into state and also rechecks on visibilitychange; at 0 → done, recordRun,
   track("lightning_completed", {score, answered, correct, bestStreak, newBest}).
   Answers: guard (running && remaining>0 && picked===null); recordQuizAnswer; applyAnswer;
   reuse animate-quiz-correct / animate-quiz-wrong on the choice buttons; auto-advance after
   a named ~350ms constant; when the deck wraps, reshuffle with buildLightningDeck.
   Timer UI: mono countdown + progress-bar-track/fill draining; emerald → amber (≤10s) →
   rose (≤5s); any new keyframe must be neutralized in the existing
   prefers-reduced-motion block in globals.css; use useReducedMotion for JS-driven motion.
   Match the existing dark UI (bg-surface cards, rounded-3xl, emerald accent, min-h-[44px]
   buttons, kbd hints on md+, aria-keyshortcuts, pb-24 for bottom nav). Prompt: font-hanzi
   hanzi + pinyin beneath + SpeakButton. Results card: animate-celebrate, score, "N answered ·
   M correct · best combo ×K", new-best banner or "Best: X — Y to beat it", Go again (R) /
   Back to stats.
   Copy: header "Lightning Round" / "60 seconds. Your due and trickiest words. Beat your best.";
   start button "⚡ Start 60-second round"; empty best "No best score yet — set the bar.".
4. src/app/lightning/page.tsx — mirror src/app/practice/page.tsx (Metadata with canonical
   "/lightning", render <LightningApp data={data} />).
5. Seams: add "lightning_completed" to the AnalyticsEvent union (src/lib/analytics.ts);
   add /lightning to sitemapEntries in src/lib/seo.ts (priority 0.8, monthly);
   add a linked StatCard on stats-app.tsx (value = best score or "⚡", label "lightning best",
   sublabel "60-second challenge", href="/lightning") using useLightningBest;
   add a "Try a Lightning Round ⚡" secondary link on practice-app.tsx's done screen.
   Do NOT touch bottom-nav.tsx or public/sw.js.
6. tests/lightning-logic.test.mjs — node --test style of tests/practice-logic.test.mjs
   (identity shuffle, injected now): pool priority/dedupe/fallback/cap; deck keying + 4 unique
   same-topic choices + promptPinyin; scoring sequences incl. multiplier boundaries and
   miss-reset; multiplierFor table; normalizeLightningBest corrupt inputs;
   mergeRunIntoBest new-best/preserve/zero-answered rules; remainingMs clamping.

Constraints: no new dependencies, no network, no invented vocabulary (all words from
src/data/topics.json), pinyin shown with Chinese text, clean sleek dark UI consistent with
the existing components.

VALIDATION GATE (all must pass before you finish):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Finish with a short summary of files added/changed and the gate results. Leave the work
uncommitted for verification.
```

---

I have everything I need — the plan below is grounded in the actual helpers (`progress-logic.ts`, `use-progress.ts`, `stats-app.tsx`) and the real dataset shape (102 topics, 1020 words, 14 categories).

## Sprint 3 — Achievement shelf derived from existing progress data

### Goal and user value

Add a playful "Achievement shelf" to `/stats`: a grid of badges (unlocked in color, locked greyed-out with a progress bar toward unlock) computed **purely** from the existing persisted `ProgressState` in localStorage. No new persistence, no schema bump, no backend. Learners already earn these milestones invisibly — first topic learned, streaks, review volume, perfect quizzes — the shelf makes them visible, celebrates them, and (via locked badges with live progress like "64/100 reviews") gives a concrete pull toward the next study session. Locked badges double as retention nudges: each one names the exact behavior (grade flashcards, quiz a topic cleanly, come back tomorrow) that drives vocabulary retention.

### Current-state findings grounded in actual files/components/helpers

- **All progress lives in one localStorage key** — `learn-10-mandarin-progress-v1`, managed by `useProgress` in `src/components/use-progress.ts`. The persisted shape is `ProgressState` (`src/lib/types.ts:94`): `learnedTopics`, `favoriteTopics`, `favoriteWords`, `flashcardStats` (per-word `{intervalDays, ease, dueAt, reviewCount}`), `quizStats` (per-word `{correct, attempts}`), `dailyActivity` (last 14 days), `studiedDates` (full history of ISO days), `onboarding`. Schema version is 4 (`src/lib/progress-logic.ts:18`); **this sprint requires no bump** since nothing new is persisted.
- **Pure-derivation pattern is established**: `src/lib/progress-logic.ts` holds pure, `now`-injectable helpers (`computeStats`, `computeStreak`, `computeWeakWords`, `wordStatus`, `masterySummary`), unit-tested without React in `tests/*.test.mjs` under `node --test`. Value imports between lib files use explicit `.ts` extensions (see the comment at `progress-logic.ts:2-5`) so Node's native TS runner resolves them; tests import `../src/lib/<module>.ts` directly (see `tests/stats-logic.test.mjs:4`).
- **`/stats` is the natural home**: `src/app/stats/page.tsx` passes the full `MandarinData` into the client `StatsApp` (`src/components/stats-app.tsx`), which already derives everything via `computeStats` + `masterySummary` and renders card sections ("stat grid" → "Mastery by category" → "Trickiest words"). Card idiom to reuse: `rounded-2xl border border-white/10 bg-surface p-5`, hover `hover:-translate-y-0.5 hover:border-emerald-300/50`, and the `progress-bar-track` / `progress-bar-fill` classes defined in `src/app/globals.css:251-259`. Stats is already a bottom-nav tab (`src/components/bottom-nav.tsx:44`), so the shelf needs no nav work.
- **Streak math**: `computeStreak` (`progress-logic.ts:200`) returns only the *current* streak (anchored today/yesterday). But `studiedDates` is the **complete unpruned history** of studied days, so a *best-ever* streak is derivable — critical so a "7-day streak" badge doesn't vanish when a streak lapses. A `longestStreak` helper does not exist yet and must be added.
- **"Perfect quiz" has no per-session record.** Quiz/typing/match/cloze sessions keep score in component state only (`src/components/topic-app.tsx:43`, `src/components/topic/quiz-panel.tsx:10`); the only persisted signal is aggregate per-word `quizStats` via `recordQuizAnswer` (`use-progress.ts:115`). So the badge must be defined derivably: **a topic where every word has been quiz-answered at least once with zero misses** (`attempts ≥ 1 && correct === attempts` for all 10 items). A learner who takes one topic quiz and aces it earns it immediately — matching the backlog intent. Keys join via `wordKey(topic, item)` = `` `${slug}:${hanzi}` `` (`src/lib/data-logic.ts:43`).
- **Mastery threshold exists**: `MASTERED_INTERVAL_DAYS = 7` (`progress-logic.ts:286`) — reuse it for a mastery badge rather than inventing a new threshold.
- **Robustness helpers exist**: `normalizeQuizStat` and `normalizeStat` are exported; achievements must use them so corrupt/legacy entries can't crash the shelf.
- **Dataset scale for calibrating targets**: `src/data/topics.json` has 102 topics / 1020 words / 14 categories — so "10 topics learned" ≈ 10% of the library, "100 reviews" is a real but reachable milestone.
- **Analytics**: `src/lib/analytics.ts` has a closed `AnalyticsEvent` union. A derived (stateless) shelf has no discrete "unlock moment" to track, so **no new events** — this keeps the sprint honest to "computed purely from current progress."
- **No existing achievements/badge code** anywhere in `src/` (grep confirmed), so this is a green-field module with no collision risk.

### Exact implementation steps in sequence

1. **Read the local Next.js docs first** per `AGENTS.md` (`node_modules/next/dist/docs/`) — this sprint only adds a lib module + client components under an existing route, but confirm client-component conventions before writing code.
2. **Create `src/lib/achievements-logic.ts`** (pure, no React/DOM/localStorage, mirroring `progress-logic.ts`):
   - `longestStreak(studiedDates: string[]): number` — dedupe + sort ISO days, scan for the longest run of consecutive days (reuse the day-diff arithmetic style of `computeStreak`).
   - `bestQuizTopicProgress(topics, quizStats): { perfectWords: number; topicTotal: number }` — for each topic, count items whose normalized quiz stat has `attempts ≥ 1 && correct === attempts`; a topic with any miss recorded (`correct < attempts` on any attempted word) caps below perfect. Return the best topic's counts to power the locked-state progress bar.
   - `ACHIEVEMENTS` definition table + `computeAchievements(progress, topics): Achievement[]` deriving the ten badges below from `computeStats`-style reads (import `normalizeQuizStat`, `MASTERED_INTERVAL_DAYS`, `wordKey` **with `.ts` extensions** so `node --test` resolves them).
3. **Create `src/components/achievement-shelf.tsx`** — a small presentational client component: section header with unlocked count, responsive grid of badge cards. Unlocked = emerald-accented card, big emoji, earned copy. Locked = dimmed card (`opacity` on text, `grayscale` emoji), hint copy, `progress-bar-track`/`progress-bar-fill` bar with a `current/target` caption. No new keyframes; rely on the existing hover-transition idiom (already effectively motion-safe — hover transforms mirror every other card in the app).
4. **Wire into `src/components/stats-app.tsx`**: `const achievements = useMemo(() => computeAchievements(progress, data.topics), [progress, data.topics]);` and render `<AchievementShelf achievements={achievements} />` as a new section between the stat grid and "Mastery by category". Render it always (locked badges are informative even with zero activity, matching how the stat grid renders zeros).
5. **Add `tests/achievements-logic.test.mjs`** covering the cases in the test plan below.
6. **Run the validation gate** (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and fix anything it surfaces.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/achievements-logic.ts` | **New** — pure badge derivation + `longestStreak` + perfect-topic helper |
| `src/components/achievement-shelf.tsx` | **New** — shelf UI (badge grid, locked/unlocked states) |
| `src/components/stats-app.tsx` | Import + memoized derivation + one new `<section>` |
| `tests/achievements-logic.test.mjs` | **New** — unit tests under `node --test` |

Nothing else: no schema bump in `progress-logic.ts`, no changes to `use-progress.ts`, `types.ts`, `analytics.ts`, routes, or nav.

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/achievements-logic.ts
export type AchievementId =
  | "first-topic" | "topic-collector"
  | "streak-3" | "streak-7"
  | "first-review" | "century-club"
  | "perfect-topic" | "first-mastery"
  | "word-collector" | "explorer";

export type Achievement = {
  id: AchievementId;
  emoji: string;          // rendered large; grayscaled when locked
  title: string;
  hint: string;           // locked state: what to do to earn it
  earned: string;         // unlocked state: what was accomplished
  unlocked: boolean;
  progress: { current: number; target: number }; // current clamped ≤ target
};

/** Longest run of consecutive studied days anywhere in history (never regresses). */
export function longestStreak(studiedDates: string[]): number;

/** Best topic-quiz completeness: perfectly-quizzed word count of the closest-to-perfect topic. */
export function bestQuizTopicProgress(
  topics: Pick<TopicSummary, "slug" | "items">[],
  quizStats: Record<string, QuizStat> | undefined,
): { perfectWords: number; topicTotal: number };

/** Derive all badges. Pure; tolerant of legacy/corrupt progress via normalize helpers. */
export function computeAchievements(
  progress: ProgressState,
  topics: Pick<TopicSummary, "slug" | "items" | "categorySlug">[],
): Achievement[];
```

```tsx
// src/components/achievement-shelf.tsx
export function AchievementShelf({ achievements }: { achievements: Achievement[] }): JSX.Element;
// internal: function BadgeCard({ badge }: { badge: Achievement })
```

**The ten badges** (backlog's four in bold; every one reads only existing fields):

| id | Emoji | Unlock condition (derived from) |
|---|---|---|
| **`first-topic`** | 🌱 | `learnedTopics.length ≥ 1` |
| `topic-collector` | 📚 | `learnedTopics.length ≥ 10` |
| `streak-3` | ⚡ | `longestStreak(studiedDates) ≥ 3` |
| **`streak-7`** | 🔥 | `longestStreak(studiedDates) ≥ 7` |
| `first-review` | 🃏 | total `reviewCount` across `flashcardStats` ≥ 1 |
| **`century-club`** | 💯 | total `reviewCount` ≥ 100 |
| **`perfect-topic`** | 🎯 | some topic: all items `attempts ≥ 1 && correct === attempts` |
| `first-mastery` | 🧠 | any stat `intervalDays ≥ MASTERED_INTERVAL_DAYS` |
| `word-collector` | ⭐ | `favoriteWords.length ≥ 10` |
| `explorer` | 🧭 | learned topics span ≥ 5 distinct `categorySlug`s |

Deliberate choice: badges use emoji + English only — no new hanzi strings, so no invented vocabulary and no pinyin-pairing obligation outside the dataset.

### UI copy / microcopy

- Section header: **"Achievement shelf"** · subline: `"Earned automatically from your local progress — no account, nothing leaves this device."` · counter chip: `"{n} of 10 unlocked"`.
- Locked progress caption: `"{current}/{target}"` (e.g. `64/100`); fully-zero locked badges show the hint only.
- Badge copy (title / locked hint / unlocked line):
  - 🌱 **First Steps** — "Mark your first topic as learned." / "You learned your first topic. 加油 — 102 to go!" *(drop the hanzi if strictness preferred: "You learned your first topic!")* — recommend the plain form: **"You learned your first topic!"**
  - 📚 **Shelf Builder** — "Learn 10 topics." / "10 topics learned — a real shelf now."
  - ⚡ **Spark** — "Study 3 days in a row." / "A 3-day streak — habit forming."
  - 🔥 **On Fire** — "Study 7 days in a row." / "A full week of daily Mandarin."
  - 🃏 **First Flip** — "Grade your first flashcard." / "Your spaced-repetition journey has begun."
  - 💯 **Century Club** — "Grade 100 flashcard reviews." / "100 reviews graded. Consistency wins."
  - 🎯 **Perfect Ten** — "Quiz every word in one topic without a single miss." / "One topic, zero misses. Flawless."
  - 🧠 **Deep Roots** — "Get one word to a week-long review interval." / "Your first mastered word — it stuck."
  - ⭐ **Word Hoarder** — "Save 10 favorite words." / "10 favorites saved for quick practice."
  - 🧭 **Explorer** — "Learn topics in 5 different categories." / "5 categories explored — well traveled."
- Accessibility: each card gets `aria-label`, e.g. `"Century Club: locked, 64 of 100 reviews"` / `"Century Club: unlocked"`.

### Test plan (`tests/achievements-logic.test.mjs`)

1. `computeAchievements(emptyProgress, sampleTopics)` → 10 badges, all `unlocked: false`, all `progress.current === 0`, targets match the table.
2. `longestStreak`: empty → 0; single day → 1; gap-broken history (`["2026-06-01".."03", "2026-06-10".."16"]`) → 7 even though the current streak is 0; unsorted + duplicate input handled.
3. `century-club`: `flashcardStats` summing to 99 → locked with `progress {99, 100}`; 100 → unlocked; clamps at `current ≤ target` for 250.
4. `perfect-topic` via `bestQuizTopicProgress`: 9 of 10 words perfect → locked `{9, 10}`; all 10 perfect → unlocked; one word with `correct < attempts` blocks that topic; a second fully-perfect topic unlocks even if the first has misses; corrupt quiz stat (negative/NaN counts) doesn't throw (goes through `normalizeQuizStat`).
5. `first-mastery`: stat with `intervalDays: 7` unlocks (boundary uses `MASTERED_INTERVAL_DAYS`); `6` does not.
6. `explorer`: learned topics across 4 categories → `{4, 5}` locked; 5 → unlocked; a learned slug not present in `topics` is ignored gracefully.
7. Corrupt/legacy progress (e.g. schema-v2-shaped object missing `quizStats`) run through `normalizeProgress` first → derives without throwing.

Follow existing conventions exactly: `import test from "node:test"`, `assert` from `node:assert/strict`, import `../src/lib/achievements-logic.ts` directly, fixed dates for determinism.

### Manual QA checklist

- [ ] Fresh profile (clear localStorage): `/stats` shows the shelf with **0 of 10 unlocked**, all cards dimmed with hints; page still renders the existing empty-state block above it.
- [ ] Mark one topic learned on any topic page → shelf shows 🌱 unlocked in color; counter reads "1 of 10 unlocked".
- [ ] Take a topic quiz and answer all 10 correctly → 🎯 Perfect Ten unlocks; miss one on a *different* topic → 🎯 stays unlocked.
- [ ] Grade a flashcard → 🃏 unlocks; seed `flashcardStats` in DevTools with `reviewCount` totals of 99 vs 100 → 💯 bar shows 99/100, then unlocks.
- [ ] Seed `studiedDates` with 7 consecutive past days that ended a week ago → 🔥 unlocked despite current streak being 0 (best-ever semantics).
- [ ] Corrupt the stored JSON (e.g. `quizStats: "junk"`) → page loads, shelf renders, nothing throws.
- [ ] Export/import progress round-trip (Stats already has this via `useProgress`) → badge states identical after import.
- [ ] Mobile viewport: grid collapses cleanly, bottom nav doesn't overlap (page already has `pb-24`); hover states are no-ops on touch without breaking layout.
- [ ] `prefers-reduced-motion: reduce` → no new animation plays.
- [ ] Keyboard/screen-reader: cards expose the locked/unlocked `aria-label`s; section has a heading.

### Acceptance criteria

1. `/stats` shows an "Achievement shelf" section with exactly the 10 badges above; unlocked vs locked is visually unmistakable, and locked badges with partial progress show a bar + `current/target` caption.
2. All badge state is derived at render time from `ProgressState` + `data.topics` — zero new localStorage keys, zero schema changes (`CURRENT_PROGRESS_SCHEMA_VERSION` still 4), zero network calls.
3. The four backlog milestones (first topic learned, 7-day streak, 100 reviews, perfect quiz) are all present and unlockable through normal app use.
4. Streak badges use best-ever streak so they never disappear after a lapse.
5. Shelf renders safely for empty, legacy (pre-v4), and corrupt progress states.
6. Visual style matches the existing stats cards (surface tokens, rounded-2xl, emerald accent, dark theme) and is accessible (labels, contrast, reduced-motion-safe).
7. Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Derived badges can regress**: unlearning a topic (learned is a toggle, `use-progress.ts:91`), or missing a quiz word after earning 🎯, can re-lock a badge. Streaks are protected via `longestStreak`; the others are accepted for this sprint (copy avoids promising permanence — no "forever" language). A persisted unlock ledger is the known fix, deferred deliberately.
- **`studiedDates` is unbounded but small** (one string per distinct day); `longestStreak` is O(n log n) on it — negligible.
- **Perf**: `computeAchievements` iterates 1020 items once inside a `useMemo` keyed on `progress` — same cost class as the existing `masterySummary` over all categories.
- **Rollback is trivial and additive**: revert the one `stats-app.tsx` hunk and delete the two new files + test. No data migration to unwind, since nothing was persisted.
- **No framework risk**: no new routes, no server components touched; but Opus must still consult `node_modules/next/dist/docs/` per AGENTS.md before coding.

### Non-goals / deferrals

- No persisted unlock timestamps, "NEW badge" toasts, or unlock-moment confetti (all require writing state; the celebrate/toast primitives in `globals.css` + `toast.tsx` are ready if a later sprint adds a seen-ledger).
- No new `AnalyticsEvent` (a derived shelf has no discrete unlock event).
- No badge surfacing on Home/Path/topic pages, no share/export of badges, no bottom-nav changes.
- No new Chinese vocabulary or hanzi decoration; no HSK levels, tiers/XP/levels, or leaderboard.
- No changes to SRS math, quiz flows, or the progress schema.

### Ready-to-run Opus implementation prompt for Sprint 3

```text
Implement Sprint 3 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 / Tailwind 4,
static local-first, all progress in localStorage): an Achievement shelf on /stats, derived
PURELY from existing persisted progress. Read AGENTS.md and the relevant guides in
node_modules/next/dist/docs/ before writing code.

HARD CONSTRAINTS
- No new localStorage keys, no schemaVersion bump (stays 4), no backend/accounts/analytics
  providers, no new dependencies, no new Chinese strings or invented vocabulary.
- Pure derivation lives in a lib module (no React/DOM/localStorage), tested with node --test.
- Value imports between src/lib modules must use explicit ".ts" extensions (see the comment
  at src/lib/progress-logic.ts:2-5); tests import ../src/lib/<module>.ts directly.

BUILD
1. src/lib/achievements-logic.ts — new pure module exporting:
   - longestStreak(studiedDates: string[]): number  // longest consecutive-day run ever,
     dedupe+sort ISO days; unlike computeStreak it must NOT anchor on today.
   - bestQuizTopicProgress(topics, quizStats): { perfectWords: number; topicTotal: number }
     // per topic, count items whose normalizeQuizStat'd stat has attempts>=1 && correct===attempts;
     // return the best topic's counts. Keys via wordKey from data-logic.ts.
   - computeAchievements(progress: ProgressState, topics): Achievement[] with
     Achievement = { id, emoji, title, hint, earned, unlocked, progress: {current, target} }
     (current clamped to target). Exactly these 10 badges, in this order:
     first-topic 🌱 "First Steps" (learnedTopics>=1); topic-collector 📚 "Shelf Builder" (>=10);
     streak-3 ⚡ "Spark" (longestStreak>=3); streak-7 🔥 "On Fire" (>=7);
     first-review 🃏 "First Flip" (sum of flashcardStats reviewCount >=1);
     century-club 💯 "Century Club" (>=100);
     perfect-topic 🎯 "Perfect Ten" (bestQuizTopicProgress perfectWords===topicTotal, total>0);
     first-mastery 🧠 "Deep Roots" (any stat intervalDays >= MASTERED_INTERVAL_DAYS — import it);
     word-collector ⭐ "Word Hoarder" (favoriteWords>=10);
     explorer 🧭 "Explorer" (learned topics span >=5 distinct categorySlugs; ignore learned
     slugs missing from the dataset).
     Use normalizeQuizStat/normalizeStat so corrupt entries never throw. Reuse the exact
     hint/earned microcopy from the sprint plan (e.g. locked Century Club hint
     "Grade 100 flashcard reviews.", unlocked "100 reviews graded. Consistency wins.").
2. src/components/achievement-shelf.tsx — client component
   AchievementShelf({ achievements }: { achievements: Achievement[] }).
   Section heading "Achievement shelf", subline "Earned automatically from your local
   progress — no account, nothing leaves this device.", counter "{n} of 10 unlocked".
   Grid (sm:grid-cols-2 lg:grid-cols-3, gap-3) of cards matching the existing stats idiom:
   rounded-2xl border border-white/10 bg-surface p-5. Unlocked: emerald accent
   (border-emerald-300/50), full-color emoji, `earned` line. Locked: dimmed text, grayscale
   emoji, `hint` line, and — when progress.current>0 — the existing progress-bar-track/
   progress-bar-fill bar plus "{current}/{target}" caption. Per-card aria-label like
   "Century Club: locked, 64 of 100 reviews" / "Century Club: unlocked". No new keyframes.
3. src/components/stats-app.tsx — derive
   const achievements = useMemo(() => computeAchievements(progress, data.topics), [progress, data.topics]);
   and render <AchievementShelf/> as a new section between the stat grid and
   "Mastery by category". Always render it (locked shelf is informative at zero activity).
4. tests/achievements-logic.test.mjs — node:test + node:assert/strict, fixed dates. Cover:
   all-locked for emptyProgress (10 badges, correct targets); longestStreak on gapped/
   unsorted/duplicated dates (7-day historical streak with current streak 0 must unlock
   streak-7); century-club at 99/100/250 (clamping); perfect-topic at 9/10, 10/10, a miss
   blocking one topic while another perfect topic still unlocks, and corrupt quiz stats not
   throwing; first-mastery boundary at intervalDays 7 vs 6; explorer at 4 vs 5 categories
   and unknown learned slugs ignored.

VALIDATION GATE (all must pass; fix what they surface):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Do not modify progress schema, use-progress.ts persistence, analytics.ts, routes, or nav.
```

---

I've grounded the plan in the actual quiz pipeline (`topic-app.tsx` → `QuizPanel`), the `useProgress` persistence layer, and the schema-versioned `progress-logic.ts`. Here is the sprint plan.

---

## Sprint 4 — In-quiz combo meter with persisted best combo

### Goal and user value

Add a consecutive-correct combo counter to the Quiz tab that visibly heats up as the streak grows (×3 🔥, ×5, ×10 milestones), resets on a wrong answer, and persists an all-time **best combo** in the existing localStorage progress state. This turns each 10-question quiz into a push-your-streak game: guessing risks the combo, so learners are nudged toward careful recall — which is exactly the retrieval behavior that builds retention. The all-time best surfaces on the quiz completion screen (with a "New best!" moment) and as a stat card on `/stats`.

### Current-state findings (grounded in actual files)

- **Quiz state lives in the parent, not the panel.** `src/components/topic-app.tsx:43` holds `quizState = { index, score, picked }`; `answerQuiz` (`topic-app.tsx:121-131`) is the single choke point where correctness is decided (`choice === currentQuiz.answer`), guarded so it fires exactly once per card via `quizState.picked`. `src/components/topic/quiz-panel.tsx` is presentation-only and receives `quizState` as `QuizViewState` (`quiz-panel.tsx:10`). The combo counter belongs in `quizState` alongside `score`.
- **Resets are already centralized.** `changeQuizMode` (`topic-app.tsx:113`), `restartQuiz` (`:144`), `retryMissed` (`:152`), and the topic-switch render-adjust block (`:101-111`) all reset `quizState` to `{ index: 0, score: 0, picked: null }`. Adding combo fields to this object means every existing reset path resets the combo for free.
- **Persistence pattern is established.** `src/components/use-progress.ts` persists `ProgressState` under `learn-10-mandarin-progress-v1`, and `src/lib/progress-logic.ts:18` defines `CURRENT_PROGRESS_SCHEMA_VERSION = 4` with `normalizeProgress` (`:164-183`) as the never-throws migration entry point (v2→v3 added `quizStats`, v3→v4 added `dailyActivity`). A v4→v5 bump adding a `bestQuizCombo: number` field follows the exact same lossless-backfill convention. Export/import (`use-progress.ts:67-84`) will carry it automatically.
- **Pure-logic + test convention.** Logic modules in `src/lib/*.ts` are DOM-free and unit-tested by `tests/*.test.mjs` under `node --test`, importing with explicit `.ts` extensions (see `tests/quiz-logic.test.mjs:9`, `tests/progress-logic.test.mjs:30`). `quiz-logic.ts` header comment explicitly documents this split. Combo math should be a new pure module (or live in `progress-logic.ts` for the persistence part).
- **Feedback animation vocabulary exists.** `src/app/globals.css:114-135` defines `quiz-shake`/`quiz-pop` (`animate-quiz-wrong`/`animate-quiz-correct`), and `:224-239` neutralizes all of them under `prefers-reduced-motion`. A combo pop animation should follow this pattern and be added to the reduced-motion block.
- **Completion screen and score row are the natural surfaces.** `quiz-panel.tsx:144-152` renders the "Question X of Y / Score N" row; `quiz-panel.tsx:55-115` renders the celebration screen with score, missed words, and retry actions.
- **Analytics choke point.** `track("quiz_completed", ...)` fires in `nextQuiz` (`topic-app.tsx:137`) with props `{ topic, mode, score, total }`. `AnalyticsProps` accepts arbitrary primitive props (`src/lib/analytics.ts:36`), so `bestCombo` can ride along without touching the `AnalyticsEvent` union.
- **Other practice panels** (`TypingPanel`, `MatchPanel`, `ClozePanel`) also call `recordQuizAnswer` (`topic-app.tsx:402-413`) but manage their own internal state — the combo is scoped to the Quiz tab only this sprint.
- **Stats page** (`src/components/stats-app.tsx:139-173`) renders a grid of `StatCard`s from `computeStats`; a "Best combo" card slots in with zero new plumbing since `progress` is already in scope.

### Exact implementation steps in sequence

1. **Create `src/lib/combo-logic.ts`** — pure, DOM-free combo helpers (thresholds, tier derivation, milestone microcopy, session-state transition). Follow the header-comment style of `quiz-logic.ts`.
2. **Extend the persisted schema in `src/lib/progress-logic.ts`:**
   - Bump `CURRENT_PROGRESS_SCHEMA_VERSION` to `5` and document the migration in the version-history comment ("v4 → v5: added `bestQuizCombo`; older saves backfill to 0, losing nothing else").
   - Add `bestQuizCombo: 0` to `emptyProgress`.
   - Add a `normalizeBestCombo(raw: unknown): number` guard (non-finite/negative/non-number → 0, else `Math.round`) and wire it into `normalizeProgress`.
3. **Add the field to `ProgressState` in `src/lib/types.ts`** with a doc comment ("All-time best consecutive-correct quiz streak. Added in schema v5.").
4. **Add `recordBestCombo` to `useProgress` (`src/components/use-progress.ts`):** a setter that raises `bestQuizCombo` to `max(current, combo)` — monotonic, so calling it on every combo increment is idempotent-safe. Do **not** route it through `withPractice` (a combo isn't a distinct practiced word).
5. **Thread combo state through `src/components/topic-app.tsx`:**
   - Extend `quizState` to `{ index, score, picked, combo, runBestCombo }` (all reset sites updated: initial state, topic-switch block, `changeQuizMode`, `restartQuiz`, `retryMissed`).
   - In `answerQuiz`, derive `nextCombo = correct ? combo + 1 : 0` via the pure helper, update `runBestCombo`, and when the new combo beats `progress.bestQuizCombo`, call `recordBestCombo(nextCombo)`.
   - In `nextQuiz`, add `bestCombo: quizState.runBestCombo` to the `quiz_completed` track props.
   - Pass `bestCombo={progress.bestQuizCombo}` and `isNewBest` down to `QuizPanel`.
6. **Render the combo meter in `src/components/topic/quiz-panel.tsx`:**
   - Extend `QuizViewState` with `combo` and `runBestCombo`.
   - In the score row (`:144-152`), add a combo chip between question count and score: hidden below ×2, then a tiered chip (see UI copy below) that pops on increment (keyed by combo value so the animation re-triggers) and escalates emerald → amber → rose ring/text intensity at tiers 3 / 5 / 10. Show the quiet all-time best (`Best ×N`) beside it once `bestQuizCombo ≥ 3`.
   - After a wrong pick (when `picked` is set and the choice was wrong and the lost combo was ≥ 3), show a one-line quiet note under the choices: "Combo broken at ×N — start a new one."
   - On the completion screen, add a combo line under the score: run best, and a highlighted "🏆 New best combo: ×N!" when this run set a record.
   - Add `aria-live="polite"` on the chip's milestone text so streak milestones are announced without spamming every answer.
7. **Add the combo pop animation to `src/app/globals.css`:** `@keyframes combo-pop` (scale 1 → 1.18 → 1, ~0.28s) + `.animate-combo-pop`, and register it in the `prefers-reduced-motion` block (`animation: none`).
8. **Write tests** (`tests/combo-logic.test.mjs`, plus new cases in `tests/progress-logic.test.mjs`) — see test plan.
9. **(Optional, small) `src/components/stats-app.tsx`:** add a `StatCard` "Best quiz combo" reading `progress.bestQuizCombo`, hint "Longest correct-answer streak in a quiz".
10. Run the validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/combo-logic.ts` | **New** — pure combo helpers |
| `src/lib/progress-logic.ts` | Schema v5, `emptyProgress`, `normalizeBestCombo` in `normalizeProgress` |
| `src/lib/types.ts` | `bestQuizCombo` on `ProgressState` |
| `src/components/use-progress.ts` | `recordBestCombo` action |
| `src/components/topic-app.tsx` | `quizState` shape, `answerQuiz`/`nextQuiz`, reset sites, new `QuizPanel` props |
| `src/components/topic/quiz-panel.tsx` | Combo chip, break note, completion-screen best-combo moment |
| `src/app/globals.css` | `combo-pop` keyframes + reduced-motion opt-out |
| `tests/combo-logic.test.mjs` | **New** |
| `tests/progress-logic.test.mjs` | v5 migration + normalization cases |
| `src/components/stats-app.tsx` | (optional) Best-combo `StatCard` |

### Proposed names and signatures

```ts
// src/lib/combo-logic.ts — pure, no DOM/localStorage (mirrors quiz-logic.ts conventions)

/** Milestone thresholds, ascending. Single source for UI tiers and microcopy. */
export const COMBO_MILESTONES = [3, 5, 10] as const;

export type ComboTier = 0 | 1 | 2 | 3; // 0: <3, 1: ≥3, 2: ≥5, 3: ≥10

/** Next combo after one answer: +1 on correct, 0 on wrong. Coerces bad input to 0. */
export function nextCombo(combo: number, correct: boolean): number;

/** Escalation tier for a combo value (drives chip styling intensity). */
export function comboTier(combo: number): ComboTier;

/** Milestone microcopy for exactly-hit milestones ("×5 — on fire!"), else null. */
export function comboMilestoneLabel(combo: number): string | null;

/** True when `combo` beats the persisted best (strictly greater). */
export function isNewBestCombo(combo: number, bestSoFar: number): boolean;

// src/lib/progress-logic.ts
export function normalizeBestCombo(raw: unknown): number;

// src/components/use-progress.ts (inside the returned object)
recordBestCombo: (combo: number) => void; // raises to max(current.bestQuizCombo, combo)

// topic-app.tsx state shape (and QuizPanel's QuizViewState)
{ index: number; score: number; picked: string | null; combo: number; runBestCombo: number }

// QuizPanel new props
bestCombo: number;      // all-time persisted best
isNewBest: boolean;     // this run beat the stored best
```

### UI copy / microcopy

- Combo chip (from ×2): `×2`, `×3 🔥`, `×4 🔥` … escalating suffix at milestones only.
- Milestone flashes (aria-live): ×3 → **"×3 — heating up!"** · ×5 → **"×5 — on fire!"** · ×10 → **"×10 — unstoppable!"**
- Quiet best marker in score row: `Best ×7`
- Combo break (only if lost combo ≥ 3): **"Combo broken at ×5 — start a new one."**
- Completion screen: **"Longest combo this run: ×6"**; record: **"🏆 New best combo: ×8!"**
- Stats card: title **"Best quiz combo"**, value `×8`, hint **"Longest correct-answer streak in a quiz"**.

No Chinese text is added, so no new pinyin obligations; the chip must not crowd the hanzi prompt (it lives in the existing meta row).

### Test plan (all `node --test`, imports with `.ts` extension)

`tests/combo-logic.test.mjs`:
- `nextCombo`: increments on correct, zeroes on wrong, coerces `NaN`/negative/undefined input to safe values.
- `comboTier`: boundary values 0, 2, 3, 4, 5, 9, 10, 50.
- `comboMilestoneLabel`: returns copy exactly at 3/5/10, `null` at 4/6/11.
- `isNewBestCombo`: strict-greater semantics (equal is not a new best).

`tests/progress-logic.test.mjs` additions:
- v4 save without `bestQuizCombo` → normalizes to `0`, `schemaVersion` becomes 5, nothing else dropped (mirrors the existing v2→v3 test at `:136`).
- Corrupt values (`"9"`, `-3`, `NaN`, `4.6`, `Infinity`) → `0` / `0` / `0` / `5` / `0` via `normalizeBestCombo`.
- `emptyProgress.bestQuizCombo === 0`.

Existing suites (`quiz-logic`, `progress-logic`) must stay green — no signature changes to any existing exported helper.

### Manual QA checklist

- [ ] Take a quiz; chip appears at ×2, fire at ×3, escalates at ×5/×10; pops on each increment.
- [ ] Wrong answer resets the chip; break note appears only when the lost combo was ≥ 3.
- [ ] Completion screen shows run-best combo; beating the stored best shows "🏆 New best combo".
- [ ] Reload the page → `Best ×N` persists (localStorage `learn-10-mandarin-progress-v1` contains `bestQuizCombo`).
- [ ] Combo resets when: switching quiz mode, Try again, Retry missed, navigating to another topic.
- [ ] A ×10 run in "Retry missed" (short quiz) can't inflate — combo is per-run consecutive answers, capped naturally by quiz length; best persists regardless of mode.
- [ ] Export progress → JSON includes `bestQuizCombo`; import a pre-sprint export → loads cleanly with best 0.
- [ ] OS reduced-motion on → no pop animation, chip still updates.
- [ ] Screen reader announces milestone copy (aria-live polite), not every answer.
- [ ] Listening mode: chip doesn't leak the answer or crowd the play button; mobile 360px: score row wraps gracefully.

### Acceptance criteria

1. Consecutive correct answers in the Quiz tab increment a visible combo counter; any wrong answer resets it to 0.
2. Milestones at 3/5/10 produce escalating visual + copy feedback, animation-free under reduced motion.
3. All-time best combo persists in `ProgressState` (schema v5) across reloads and survives export/import; legacy saves migrate losslessly with best 0.
4. `recordQuizAnswer` per-word accuracy behavior is unchanged (still exactly once per card).
5. Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Schema bump is the only persistent change.** `normalizeProgress` is designed to never throw and to backfill missing fields, so rollback is safe in both directions: a pre-sprint build reading a v5 save simply ignores the extra key (it spreads through `normalizeProgress` untouched fields? — no: it *drops* unknown fields, which loses only the best-combo number, nothing else). No destructive migration.
- **Render-loop risk:** calling `recordBestCombo` inside `answerQuiz` (event handler, not render) avoids setState-during-render issues; the monotonic max makes double-invocation under StrictMode harmless.
- **Scope creep risk:** other panels call `recordQuizAnswer` too — deliberately not wired to combos to keep the blast radius to the Quiz tab.
- Rollback = revert the single sprint commit; stored `bestQuizCombo` keys become inert extra JSON.

### Non-goals / deferrals

- No combo in Type / Match / Sentences / Tone practice panels (future sprint could unify).
- No per-mode or per-topic best combos — one global best.
- No sound effects, confetti particles, or haptics.
- No new analytics event type — `bestCombo` rides on the existing `quiz_completed` props.
- No streak-freeze/insurance mechanics.

### Ready-to-run Opus implementation prompt for Sprint 4

```text
Implement Sprint 4 for the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static + localStorage only; read AGENTS.md and node_modules/next/dist/docs/ before writing
Next.js-specific code): an in-quiz combo meter with a persisted all-time best combo.

Scope: Quiz tab only (src/components/topic/quiz-panel.tsx driven by src/components/topic-app.tsx).
Do NOT touch Type/Match/Cloze/Tone panels. No backend, no new deps, no invented content.

1. New pure module src/lib/combo-logic.ts (follow quiz-logic.ts conventions: DOM-free,
   header comment, explicit .ts-extension note not needed here since nothing imports .ts):
   - export const COMBO_MILESTONES = [3, 5, 10] as const
   - nextCombo(combo: number, correct: boolean): number  // +1 on correct, 0 on wrong; coerce bad input to 0
   - comboTier(combo: number): 0|1|2|3                    // <3, ≥3, ≥5, ≥10
   - comboMilestoneLabel(combo: number): string | null    // "×3 — heating up!", "×5 — on fire!", "×10 — unstoppable!"
   - isNewBestCombo(combo: number, bestSoFar: number): boolean  // strictly greater

2. Persistence (schema v5):
   - src/lib/types.ts: add bestQuizCombo: number to ProgressState with a doc comment "Added in schema v5".
   - src/lib/progress-logic.ts: bump CURRENT_PROGRESS_SCHEMA_VERSION to 5; document v4→v5 in the
     version-history comment; add bestQuizCombo: 0 to emptyProgress; add
     normalizeBestCombo(raw: unknown): number (non-number/non-finite/negative → 0, else Math.round)
     and wire it into normalizeProgress. Never throw, never drop other fields.
   - src/components/use-progress.ts: add recordBestCombo(combo: number) that sets
     bestQuizCombo to Math.max(current.bestQuizCombo, normalized combo). Do NOT route through
     withPractice and do not change recordQuizAnswer's behavior.

3. topic-app.tsx wiring:
   - Extend quizState to { index, score, picked, combo: 0, runBestCombo: 0 } and update ALL reset
     sites: initial useState, the topic-switch adjust-during-render block, changeQuizMode,
     restartQuiz, retryMissed.
   - In answerQuiz (keep the picked guard and the exactly-once recordQuizAnswer call): compute
     next combo via nextCombo(), update combo and runBestCombo in the same setQuizState, and if
     the new combo strictly beats progress.bestQuizCombo call recordBestCombo(newCombo).
   - In nextQuiz, add bestCombo: quizState.runBestCombo to the quiz_completed track props.
   - Pass bestCombo={progress.bestQuizCombo} and isNewBest (runBestCombo > 0 && runBestCombo >= 
     stored-best-at-run-start semantics: simplest correct approach is a boolean you derive when
     recordBestCombo fires — track a local "setRecordThisRun" flag in quizState or derive
     isNewBest = quizState.runBestCombo > 0 && quizState.runBestCombo === progress.bestQuizCombo
     && <flag that a record was set this run>; keep it simple and correct) into QuizPanel.

4. QuizPanel UI (keep the existing clean dark aesthetic — emerald/amber/rose palette, rounded-full
   chips, bg-surface):
   - Extend QuizViewState with combo and runBestCombo; add bestCombo/isNewBest props.
   - Score row: combo chip visible from ×2 ("×2", "×3 🔥"...), tier styling: tier1 emerald wash
     (border-emerald-300/40 bg-emerald-400/10 text-emerald-200 like the mode chips), tier2 amber,
     tier3 rose; re-mount the chip keyed on combo value with a new animate-combo-pop class.
     Milestone copy in an aria-live="polite" span, rendered only when comboMilestoneLabel returns
     non-null. Quiet "Best ×N" text beside it when bestCombo ≥ 3.
   - After a wrong pick that broke a combo ≥ 3: one muted line "Combo broken at ×N — start a new one."
   - Completion screen: "Longest combo this run: ×N" under the score; when isNewBest, show
     "🏆 New best combo: ×N!" prominently instead.
   - Do not crowd the hanzi prompt or the listening-mode play button; keep pinyin rendering untouched.

5. src/app/globals.css: add @keyframes combo-pop (scale 1 → 1.18 → 1, ~0.28s ease-out) and
   .animate-combo-pop; add it to the existing prefers-reduced-motion block with animation: none.

6. Tests (node --test, .mjs files importing ../src/lib/*.ts like existing suites):
   - New tests/combo-logic.test.mjs covering nextCombo (increment/reset/garbage input),
     comboTier boundaries (0,2,3,4,5,9,10,50), comboMilestoneLabel exact-hit vs null,
     isNewBestCombo strict-greater.
   - Extend tests/progress-logic.test.mjs: v4 save without bestQuizCombo migrates to v5 with 0
     and loses nothing (mirror the existing v2→v3 test); normalizeBestCombo coercion cases
     ("9", -3, NaN, 4.6, Infinity); emptyProgress.bestQuizCombo === 0.

7. Optional if trivial: add a "Best quiz combo" StatCard to src/components/stats-app.tsx reading
   progress.bestQuizCombo (value "×N", hint "Longest correct-answer streak in a quiz").

Validation gate — all must pass before you finish:
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build
```

---

I have everything I need — the stats page, the progress schema, how `studiedDates` and `dailyActivity` are recorded, and the project's test/design conventions. Here's the plan.

---

## Sprint 5 — Study heatmap calendar on the stats page

### Goal and user value

Add a GitHub-style, year-at-a-glance contribution grid to `/stats`, rendered entirely from the already-persisted `progress.studiedDates` (lit vs. unlit days) and enriched with intensity from `progress.dailyActivity` (words practiced per day, last 14 days). Consistency becomes *visible*: a chain of green squares is a stronger retention feedback loop than a single streak number, and an unlit "today" square next to a live chain is a gentle daily nudge. Zero new data collection, zero schema changes, fully local — it's a pure read over state the app already saves.

### Current-state findings (grounded in actual files)

- **Data already exists.** `ProgressState.studiedDates: string[]` holds ISO day strings (`"YYYY-MM-DD"`, UTC via `todayISO()` → `toISOString().slice(0, 10)`), appended by `recordStudyToday` in `src/components/use-progress.ts:24` on every graded/practice interaction and on `toggleLearnedTopic`. It is never pruned, so it is the full study history — ideal for a year grid.
- **Intensity data exists for recent days only.** `dailyActivity: Record<string, string[]>` (schema v4, `src/lib/progress-logic.ts:34`) maps ISO day → distinct wordKeys practiced, pruned to `DAILY_ACTIVITY_RETENTION_DAYS = 14`. So per-day word counts are only trustworthy for ~2 weeks; older studied days have no count. Also note: `toggleLearnedTopic` stamps `studiedDates` *without* touching `dailyActivity`, so a studied day can legitimately have no count even inside the window.
- **The stats page is the right host.** `src/app/stats/page.tsx` renders the client component `StatsApp` (`src/components/stats-app.tsx`), which reads progress via `useProgress()`, shows a `LoadingScreen` until `loaded`, and renders a stat grid → "Mastery by category" → "Trickiest words". A "days studied" `StatCard` and a streak pill (using `streakAtRisk`, `stats.streak`) already exist at `stats-app.tsx:102-114` and `168-172` — the heatmap slots naturally between the stat grid and the mastery section.
- **Pure-logic + test conventions are established.** Pure derivations live in `src/lib/progress-logic.ts` (with `computeStreak`, `streakAtRisk`, injectable `today`/`now` for determinism) and are tested by `node --test` from `tests/*.test.mjs`, which import TS sources directly with an explicit `.ts` extension (see `tests/progress-logic.test.mjs` importing `../src/lib/progress-logic.ts`). Cross-lib value imports also need the `.ts` extension (comment at `progress-logic.ts:2-5`).
- **Visual language to reuse.** Dark theme with `bg-surface` / `border-white/10` cards (tokens in `src/app/globals.css` `@theme` block), emerald accent, `MasteryDots` (`src/components/mastery-dots.tsx`) sets the precedent for tiny color-coded cells: container `role="img"` with a counts `aria-label`, individual cells `aria-hidden`. Reduced-motion is handled via a `@media (prefers-reduced-motion: reduce)` block in `globals.css:224` plus a `useReducedMotion` hook.
- **No streak-best helper exists.** `computeStreak` returns only the *current* streak; a "best streak" is a cheap, fun companion stat derivable from the same array.
- **Framework note:** this sprint is purely a client-component + pure-lib change; no new Next.js 16 APIs are needed (per `AGENTS.md`, the implementer should still consult `node_modules/next/dist/docs/` if anything framework-level comes up).

### Exact implementation steps in sequence

1. **Create `src/lib/heatmap-logic.ts`** — pure, DOM-free, fully deterministic (injectable `endDay`):
   - Build a 53-week grid of cells ending on `endDay` (default `todayISO()`), columns = weeks, rows = Sun→Sat using UTC day-of-week (`getUTCDay()`), matching the existing UTC-day convention of `todayISO()`.
   - Derive each cell's level: `0` = not studied; studied days tier `1–4` by `dailyActivity` word count when the day has an entry (`1`: 1–3 words, `2`: 4–7, `3`: 8–14, `4`: 15+); studied days *without* a count entry (older than retention, or learned-toggle-only days) get level `1`. Document this asymmetry in a comment.
   - Compute month labels (week index where a new UTC month starts, skipping cramped duplicates), plus summary counts for the accessible label.
   - Ignore malformed date strings defensively (reuse the `/^\d{4}-\d{2}-\d{2}$/` + `Number.isFinite(new Date(...).getTime())` idiom from `isISODayKey`).
2. **Add `longestStreak(studiedDates: string[]): number` to `src/lib/progress-logic.ts`**, next to `computeStreak` (sort, dedupe, walk day gaps — same 86400000-ms arithmetic already used there).
3. **Create `tests/heatmap-logic.test.mjs`** (and extend `tests/progress-logic.test.mjs` for `longestStreak`) — see Test plan.
4. **Create `src/components/study-heatmap.tsx`** — presentational client component:
   - `useMemo(() => buildHeatmap(...), [studiedDates, dailyActivity])`.
   - Horizontally scrollable grid (`overflow-x-auto`), auto-scrolled to the newest week on mount via a `ref` (`el.scrollLeft = el.scrollWidth`).
   - Weekday gutter (Mon/Wed/Fri), month labels row, "Less → More" legend, header chips for current streak / best streak / days studied this year.
   - Cells: `h-3 w-3 rounded-[3px]`; level 0 `bg-white/[0.06]`, levels 1–4 `bg-emerald-400/25 → /45 → /70 → bg-emerald-400`; today gets `ring-1 ring-emerald-300`. Native `title` tooltip per cell for pointer users.
   - A11y per the `MasteryDots` pattern: grid container `role="img"` with a full summary `aria-label`; cells `aria-hidden`. Optional today-cell pulse animation defined in `globals.css` inside the existing reduced-motion guard.
5. **Wire it into `StatsApp`** (`src/components/stats-app.tsx`): new `<section aria-label="Study activity">` between the stat grid (ends line 173) and "Mastery by category" (line 176). Always render (an all-empty year is informative, matching the "zeros are informative" comments already in the file), with a playful empty-state subline when `studiedDates` is empty.
6. **(If needed) add the today-pulse keyframes** to `src/app/globals.css`, guarded by the existing `prefers-reduced-motion` block.
7. Run the full validation gate and manually QA (below).

### Likely files touched

| File | Change |
|---|---|
| `src/lib/heatmap-logic.ts` | **New** — pure grid/level/label derivation |
| `src/lib/progress-logic.ts` | Add `longestStreak` (additive only) |
| `src/components/study-heatmap.tsx` | **New** — presentational heatmap component |
| `src/components/stats-app.tsx` | Render the new section; pass `progress.studiedDates` / `progress.dailyActivity` |
| `src/app/globals.css` | Optional: today-cell pulse keyframes under the existing reduced-motion guard |
| `tests/heatmap-logic.test.mjs` | **New** — unit tests for the pure logic |
| `tests/progress-logic.test.mjs` | Add `longestStreak` cases |

No changes to `ProgressState`, no schema-version bump, no changes to `use-progress.ts`.

### Proposed names and TypeScript signatures

```ts
// src/lib/heatmap-logic.ts
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = {
  day: string;            // "YYYY-MM-DD" (UTC day, same convention as todayISO)
  level: HeatLevel;
  count: number | null;   // distinct words practiced, null when no dailyActivity entry
  inRange: boolean;       // false for grid-padding cells after endDay (rendered invisible)
};

export type HeatmapModel = {
  weeks: HeatmapCell[][];                                 // 53 columns × 7 rows, Sun→Sat
  monthLabels: { weekIndex: number; label: string }[];    // "Jan", "Feb", …
  daysStudied: number;                                    // studied days inside the window
};

export const HEATMAP_WEEKS = 53;

export function heatLevel(studied: boolean, count: number | null): HeatLevel;
export function buildHeatmap(
  studiedDates: string[],
  dailyActivity: Record<string, string[]> | undefined,
  endDay?: string,                 // injectable for tests; defaults to todayISO()
  weeks?: number,                  // defaults to HEATMAP_WEEKS
): HeatmapModel;
export function cellTitle(cell: HeatmapCell): string;   // tooltip text, see copy below
export function heatmapSummaryLabel(model: HeatmapModel, streak: number): string; // role="img" aria-label
```

```ts
// src/lib/progress-logic.ts (addition)
export function longestStreak(studiedDates: string[]): number;
```

```tsx
// src/components/study-heatmap.tsx
export function StudyHeatmap(props: {
  studiedDates: string[];
  dailyActivity: Record<string, string[]>;
  streak: number;        // reuse stats.streak from StatsApp — don't recompute
}): React.JSX.Element;
```

### UI copy / microcopy

- Section heading: **"Study activity"**
- Subline: *"Every square is a day. Study anything — one flashcard counts — to light it up."*
- Empty-state subline (no studied dates): *"A whole year of blank squares, and the first green one is a single flashcard away."*
- Header chips: `🔥 {n}-day streak` · `Best: {m} days` · `{d} days lit this year`
- Legend: `Less` `[□▫▪▪■]` `More`
- Cell tooltips (`cellTitle`): studied with count → `"Jul 5 — 12 words practiced"`; studied without count → `"Jul 5 — studied"`; unlit → `"Jul 5 — no study"`; today appends `" (today)"`.
- `role="img"` label (`heatmapSummaryLabel`): `"Study heatmap: {d} days studied in the last year, current streak {n} days."`
- Fine-print under legend: *"Word counts are kept for the last 14 days; older days show a single shade of green."* (honest about the retention window)

### Test plan

All via the existing `node --test` setup, importing `../src/lib/heatmap-logic.ts` / `progress-logic.ts` with explicit `.ts` extensions, deterministic via injected `endDay` (e.g. `"2026-07-05"`).

`tests/heatmap-logic.test.mjs`:
- Grid shape: 53 weeks × 7 rows; last in-range cell is exactly `endDay`; trailing cells in the final column are `inRange: false`; first column starts on a Sunday (UTC).
- Empty inputs → all cells level 0, `daysStudied: 0`.
- `heatLevel` tiering: not studied → 0; studied + null count → 1; counts 1/3 → 1, 4/7 → 2, 8/14 → 3, 15/40 → 4; studied + count 0 (learned-toggle day) → 1.
- `buildHeatmap` places a studied day in the correct week/row cell; a `dailyActivity` entry raises that cell's level; dates outside the window are ignored; malformed strings (`"junk"`, `"2026-13-99"`) are dropped without throwing; duplicate dates count once.
- Month labels: correct label at each month-start column; no duplicate/cramped labels.
- `cellTitle` / `heatmapSummaryLabel` exact-string checks for the copy above.

`tests/progress-logic.test.mjs` additions:
- `longestStreak`: `[] → 0`; single day → 1; `4 consecutive + gap + 2 consecutive → 4`; unsorted input and duplicates handled; longest run in the past beats a shorter current run (contrast with `computeStreak`).

### Manual QA checklist

- [ ] Seed progress in DevTools (`localStorage["learn-10-mandarin-progress-v1"]`) with a hand-built `studiedDates` array (scattered days, a 5-day chain, today) + a few `dailyActivity` entries → grid lights the right cells with graded intensity; header streak chip matches the page-top streak pill.
- [ ] Fresh profile (cleared storage) → all-blank grid renders with the empty-state subline; no crash, no NaN.
- [ ] Grade one flashcard on `/review`, return to `/stats` → today's cell lights up and streak chips update.
- [ ] Mobile width (~375px): grid scrolls horizontally and is auto-scrolled to the newest week; weekday/month labels don't overlap; no page-level horizontal overflow.
- [ ] Hover/long-press cells → tooltip text matches the copy spec, including "(today)".
- [ ] `prefers-reduced-motion: reduce` (DevTools rendering emulation) → no today-pulse animation.
- [ ] Screen reader / accessibility tree: heatmap exposes one `img` node with the summary label; individual cells are not announced.
- [ ] Dark-theme visual check: level-0 cells visible but quiet against `bg-surface`; levels clearly distinguishable.
- [ ] Corrupt-data check: inject a junk entry into `studiedDates` (`"not-a-date"`) → page still renders.

### Acceptance criteria

1. `/stats` shows a "Study activity" section with a 53-week, GitHub-style grid derived only from existing `studiedDates` + `dailyActivity`; no schema change, no new persistence, no network.
2. Studied days are visibly lit; the last ~14 days show intensity tiers from word counts; today is visually marked.
3. Current streak, best streak, and days-studied chips are correct and consistent with the existing streak pill.
4. Grid is usable at 375px (scrollable, anchored to the newest week) and accessible (single labelled `role="img"`, cells hidden from AT).
5. All animation is reduced-motion-guarded; empty and corrupt progress states render without errors.
6. Validation gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **UTC day boundary:** `studiedDates` uses UTC days (`todayISO()`), so for users far from UTC a late-night session lights "tomorrow's" square. This is the app-wide existing convention (streaks share it); the heatmap must *reuse* it, not fix it — mixing local-time rendering with UTC data would desynchronize the heatmap from the streak. Note as a known, pre-existing quirk.
- **Uniform old days:** days older than the 14-day `dailyActivity` retention all render at level 1. Mitigated by the honest legend fine-print; raising retention is deferred (it changes storage growth and `normalizeDailyActivity`).
- **Unbounded `studiedDates`:** years of use → a few thousand short strings; `buildHeatmap` is O(days) with a Set lookup, negligible. No action needed.
- **Layout regression risk is low** — purely additive section; the today-pulse CSS is the only shared-file styling change and sits inside the existing reduced-motion block.
- **Rollback:** delete `study-heatmap.tsx`, `heatmap-logic.ts`, the test file, and the one `<section>` block in `stats-app.tsx` (plus the `longestStreak` export and CSS keyframes). No data migration to unwind.

### Non-goals / deferrals

- No change to how/when `studiedDates` or `dailyActivity` are written (no retention increase, no local-timezone migration, no backfill).
- No clickable day cells navigating to per-day history (no such data exists beyond 14 days).
- No selectable year ranges or all-time view; fixed trailing 53 weeks.
- No share/export of the heatmap image; no confetti/milestone celebrations (candidate for a future sprint).
- No third-party charting/tooltip library — hand-rolled cells + native `title` only.

### Ready-to-run Opus implementation prompt for Sprint 5

```text
You are implementing Sprint 5 of "Learn 10 Mandarin Words" (Next.js 16 / React 19 / Tailwind 4,
static local-first app, dark theme, progress in localStorage). Per AGENTS.md, if you need any
framework detail, read node_modules/next/dist/docs/ first — this Next.js version differs from
training data.

GOAL
Add a GitHub-style study heatmap ("Study activity") to the /stats page, derived ONLY from the
existing persisted progress: `studiedDates: string[]` (ISO "YYYY-MM-DD" UTC days, full history)
and `dailyActivity: Record<string, string[]>` (day → distinct wordKeys, pruned to
DAILY_ACTIVITY_RETENTION_DAYS = 14). NO schema changes, NO new persistence, NO network, NO new
dependencies.

READ FIRST
- src/components/stats-app.tsx (host page; note streak pill, StatCard grid, section pattern,
  "zeros are informative" convention)
- src/lib/progress-logic.ts (todayISO/isoDay UTC convention, computeStreak, streakAtRisk,
  isISODayKey idiom, .ts-extension import note at top)
- src/components/use-progress.ts (how studiedDates/dailyActivity are written; note
  toggleLearnedTopic stamps studiedDates WITHOUT dailyActivity)
- src/components/mastery-dots.tsx (a11y pattern: container role="img" + aria-label, cells
  aria-hidden)
- src/app/globals.css (@theme surface tokens, existing prefers-reduced-motion block)
- tests/progress-logic.test.mjs and tests/stats-logic.test.mjs (node --test style, direct .ts
  imports with explicit extension, injectable clocks)

BUILD
1. New pure module src/lib/heatmap-logic.ts (no DOM, no localStorage, injectable endDay):
   - export const HEATMAP_WEEKS = 53
   - export type HeatLevel = 0|1|2|3|4
   - export type HeatmapCell = { day: string; level: HeatLevel; count: number|null; inRange: boolean }
   - export type HeatmapModel = { weeks: HeatmapCell[][]; monthLabels: {weekIndex:number; label:string}[]; daysStudied: number }
   - export function heatLevel(studied: boolean, count: number|null): HeatLevel
     Tiers: !studied → 0; studied with count 1–3 → 1, 4–7 → 2, 8–14 → 3, 15+ → 4;
     studied with null or 0 count → 1. Comment WHY (14-day retention + learned-toggle days).
   - export function buildHeatmap(studiedDates, dailyActivity, endDay = todayISO(), weeks = HEATMAP_WEEKS): HeatmapModel
     Columns = weeks, rows = Sun→Sat using UTC (getUTCDay), last in-range cell = endDay, trailing
     cells of the final column inRange:false. Use a Set for studiedDates; drop malformed date
     strings defensively (regex + Number.isFinite(new Date(x).getTime()), like isISODayKey);
     dedupe duplicates. Month labels at each UTC month-start column, skipping labels that would
     be < 3 columns apart.
   - export function cellTitle(cell): string and heatmapSummaryLabel(model, streak): string with
     EXACTLY this copy: "Jul 5 — 12 words practiced" / "Jul 5 — studied" / "Jul 5 — no study",
     append " (today)" for today; summary: "Study heatmap: {d} days studied in the last year,
     current streak {n} days."
2. Add to src/lib/progress-logic.ts: export function longestStreak(studiedDates: string[]): number
   (longest run of consecutive UTC days ever; sort+dedupe, 86400000-ms day arithmetic like
   computeStreak). Additive only — do not modify existing exports.
3. New client component src/components/study-heatmap.tsx:
   StudyHeatmap({ studiedDates, dailyActivity, streak }) — streak passed in from stats.streak,
   never recomputed. useMemo(buildHeatmap). Horizontally scrollable (overflow-x-auto) grid
   auto-scrolled to the newest week on mount (ref, scrollLeft = scrollWidth). Weekday gutter
   (Mon/Wed/Fri, text-[10px] text-slate-500), month label row, legend "Less [5 swatches] More".
   Cells h-3 w-3 rounded-[3px]; level 0 bg-white/[0.06]; levels 1–4 bg-emerald-400/25, /45, /70,
   bg-emerald-400; today ring-1 ring-emerald-300. Native title= tooltips from cellTitle. A11y:
   grid wrapper role="img" aria-label={heatmapSummaryLabel(...)}, all cells aria-hidden. Header
   chips: "🔥 {n}-day streak" (only when n>0), "Best: {m} days" (only when m>0), "{d} days lit
   this year". If you add a today-pulse animation, define it in globals.css and disable it inside
   the EXISTING prefers-reduced-motion block.
4. Wire into src/components/stats-app.tsx: new <section aria-label="Study activity"> between the
   stat grid and the "Mastery by category" section. Always render (empty grid is informative).
   Heading "Study activity"; subline "Every square is a day. Study anything — one flashcard
   counts — to light it up."; when studiedDates is empty use instead "A whole year of blank
   squares, and the first green one is a single flashcard away." Under the legend add the
   fine-print "Word counts are kept for the last 14 days; older days show a single shade of
   green." Match existing card styling (rounded-2xl/3xl border-white/10 bg-surface) and the
   page's heading/sub-copy classes.
5. Tests (node --test, .mjs, import "../src/lib/heatmap-logic.ts" with the explicit .ts
   extension, deterministic via injected endDay e.g. "2026-07-05"):
   - tests/heatmap-logic.test.mjs: grid shape (53×7, endDay is last in-range cell, first column
     Sunday-aligned, trailing cells inRange:false); empty input → all level 0; heatLevel tier
     boundaries incl. null and 0 counts; correct cell placement for a known date; dailyActivity
     raises level; malformed/duplicate dates handled; month labels; exact cellTitle /
     heatmapSummaryLabel strings.
   - tests/progress-logic.test.mjs: longestStreak — empty → 0, single day → 1, 4-run + gap +
     2-run → 4, unsorted/duplicate input, past-run longer than current run.

CONSTRAINTS
- Respect the app's UTC-day convention (todayISO) everywhere; do NOT introduce local-time day math.
- Pinyin on Chinese lines is unaffected (no vocab content in this sprint); do not invent any
  vocabulary or content.
- No new npm packages. Keep everything client-side and offline-friendly.
- Match existing code style: heavily commented pure helpers, injectable clocks, defensive
  normalization that never throws.

VALIDATION GATE (all must pass before you're done)
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I've grounded the plan in the actual repo — one important finding up front: **there is no "lightning round" in this codebase** (no timed mode exists anywhere in `src/`), so the share card is planned around the score surfaces that actually exist: the `/practice` deck score, the `/review` session tally, and the `/stats` streak/totals. Here is the plan.

---

## Sprint 6 — Shareable score card via canvas + Web Share/clipboard

### Goal and user value

Let a learner turn a finished practice run, a completed daily review, or their overall streak into a beautiful dark-themed PNG (plus a Wordle-style emoji text snippet) they can share with one tap — Web Share on mobile, clipboard/download on desktop. Everything is generated client-side on a `<canvas>`; nothing leaves the device until the user explicitly shares. The card doubles as retention: it features the learner's actual tricky words (hanzi + pinyin + English), so sharing is also a recap.

### Current-state findings (grounded in actual files)

- **Score surfaces that exist today:**
  - `src/components/practice-app.tsx` — `/practice` completion screen (lines 172–225) shows `score`/`total` (`🎉`/`💪`, `animate-celebrate`) and a `missedEntries` list of real `VocabItem`s (hanzi/pinyin/english). This is the closest thing to a "lightning-round score." `track("practice_session_completed", { count, score })` fires at line 103.
  - `src/components/review-app.tsx` — session completion summary ("Session complete! 🎉", ~line 234) with a per-grade tally (`TALLY`, lines 34–39, counts from `session.counts` in `src/lib/session-logic.ts`) and `toughestCards(session)` resolving Again-graded words.
  - `src/components/stats-app.tsx` — streak chip (lines 102–114, amber `🔥 N day streak`), `computeStats` totals (reviewed words, learned topics, days studied) from `src/lib/progress-logic.ts:243`.
  - There is **no lightning/timed mode** anywhere in `src/` — the plan must not invent one.
- **Existing share/clipboard precedents:**
  - `src/components/copy-button.tsx` — async Clipboard API text copy with graceful hide when unavailable.
  - `src/components/use-progress.ts:67` — `exportProgress` already does the Blob → `URL.createObjectURL` → `a.download` pattern (our PNG download fallback).
  - No `navigator.share` or canvas usage exists anywhere in `src/` yet (verified by grep) — this sprint introduces both.
- **Design tokens to reproduce on canvas:** `src/app/globals.css` — background `#020617` (slate-950, matches `viewport.themeColor` in `src/app/layout.tsx:58`), `--color-surface: #0d1220` (line 23), tone colors `--color-tone-1…5` = `#f87171 #4ade80 #60a5fa #c084fc #94a3b8` (lines 58–62), emerald accent (`emerald-300/400` used throughout). Fonts: Geist via `--font-geist-sans`, hanzi via `--font-noto-sc` / `.font-hanzi` (globals.css:108, loaded in `src/app/layout.tsx:18` with `preload: false` — a font-load race the canvas code must handle).
- **Conventions to follow:**
  - Pure logic lives in DOM-free `src/lib/*-logic.ts` modules with `.ts`-extension value imports (see `progress-logic.ts:5`), tested in `tests/*.test.mjs` under `node --test` (Node v24 native TS).
  - `src/lib/analytics.ts` has a closed `AnalyticsEvent` union — a new event must be added there, never an ad-hoc string.
  - Feedback chips use `src/components/toast.tsx`; the only modal precedent is `src/components/onboarding.tsx:84` (`role="dialog"`, `aria-modal`, focus trap via `FOCUSABLE_SELECTOR`).
  - Tone-colored pinyin preference: `useToneColors()` in `src/components/use-tone-colors.ts:84` + `TONE_TEXT_CLASS` in `src/lib/tone-colors.ts`.
  - Site identity for the card footer: `SITE_NAME`, `SITE_TAGLINE`, `SITE_URL` in `src/lib/seo.ts:9–23`.
  - `src/app/opengraph-image.tsx` exists (server-side OG image) — unaffected; the share card is a separate client-side artifact.
  - Per `AGENTS.md`, Next.js 16 docs in `node_modules/next/dist/docs/` must be consulted; this sprint is almost entirely client-component code, so App Router impact is minimal ("use client" components only, no new routes).

### Exact implementation steps in sequence

1. **Read local Next docs** (`node_modules/next/dist/docs/01-app/...` client-components guide) to confirm nothing about `"use client"`/event handlers changed in this Next 16 build.
2. **Create `src/lib/share-card-logic.ts`** (pure, DOM-free, unit-testable):
   - `ShareCardData` discriminated union for the three variants (`stats` | `practice` | `review`), each carrying only fields already derivable from `computeStats`, practice state, or `ReviewSession.counts`/`toughestCards`.
   - `shareTitle(data)` — playful tiered headline (perfect / ≥80% / otherwise; streak-led for stats).
   - `scoreEmojiBar(score, total)` — `🟩`/`🟥` bar (capped at 10 squares with a `×N` suffix beyond that) for the Wordle-style text snippet.
   - `buildShareText(data, siteHost)` — the full multi-line text snippet.
   - `wrapText(text, maxWidth, measure)` — line wrapper with an **injected** `measure` callback so it's testable without a canvas.
   - Layout constants (`SHARE_CARD_WIDTH = 1080`, `SHARE_CARD_HEIGHT = 1350`, colors copied from the globals.css hex values with a comment pointing at their source lines).
3. **Create `src/lib/share-card-canvas.ts`** (client-only; the DOM/canvas layer):
   - `renderShareCard(data, { toneColors })` — creates an offscreen canvas, awaits `document.fonts.load()` for Geist + Noto Sans SC (with a hanzi sample string so CJK glyphs are actually loaded before drawing), then draws: slate-950 background, rounded `#0d1220` panel, emerald accent, big score/streak numeral, up to 3 featured words with **pinyin under every hanzi line** (tone-colored when the preference is on), and a footer with `SITE_NAME` + site host.
   - `canvasToBlob(canvas)` — promisified `toBlob("image/png")` that rejects on `null`.
   - `deliverShareCard(makeBlob, text)` — capability ladder returning which method ran: `navigator.canShare({ files })` → Web Share; else `ClipboardItem` → clipboard **(Safari-safe: pass a Promise into `ClipboardItem` synchronously within the user gesture)**; else `a.download` PNG (mirroring `exportProgress`).
4. **Create `src/components/share-score-button.tsx`** (`"use client"`):
   - `ShareScoreButton` renders the trigger; on tap, renders the card, opens a small preview dialog (image `<img src=objectURL>` + action row: Share image / Copy image / Copy text / Save PNG / Done), following the `onboarding.tsx` dialog pattern (`role="dialog"`, `aria-modal`, Escape to close, focus trap, restore focus). Reuses `Toast` for confirmations. Web Share `AbortError` (user cancelled) is silent, not an error toast. Revoke object URLs on close.
   - Hidden entirely when `data` has nothing to brag about (e.g. stats variant with zero activity).
5. **Add analytics event**: extend the union in `src/lib/analytics.ts` with `"score_card_shared"`; fire `track("score_card_shared", { surface, method })` after a successful share/copy/download.
6. **Mount on three surfaces:**
   - `practice-app.tsx` completion screen (next to "Practice again", line ~204): practice variant from `score`, `total`, `missedEntries`.
   - `review-app.tsx` completion summary (next to the tally): review variant from `session.counts`, `session.queue.length`, `toughestCards(session)`.
   - `stats-app.tsx` header (beside the streak chip, line ~102): stats variant from the existing `stats` memo (streak, reviewedWords/totalWords, learnedTopics, daysStudied).
7. **Write `tests/share-card-logic.test.mjs`** (see test plan) and run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/share-card-logic.ts` | **new** — pure card data/text/layout logic |
| `src/lib/share-card-canvas.ts` | **new** — canvas drawing + share delivery ladder |
| `src/components/share-score-button.tsx` | **new** — button + preview dialog |
| `src/components/practice-app.tsx` | mount on completion screen |
| `src/components/review-app.tsx` | mount on session summary |
| `src/components/stats-app.tsx` | mount in header |
| `src/lib/analytics.ts` | add `"score_card_shared"` event |
| `tests/share-card-logic.test.mjs` | **new** — pure-logic tests |

### Proposed names and signatures

```ts
// src/lib/share-card-logic.ts (pure, DOM-free)
export type ShareCardWord = { hanzi: string; pinyin: string; english: string };
export type ShareCardData =
  | { kind: "stats"; streak: number; reviewedWords: number; totalWords: number;
      learnedTopics: number; daysStudied: number }
  | { kind: "practice"; score: number; total: number; missed: ShareCardWord[] }
  | { kind: "review"; total: number; counts: Record<Grade, number>; toughest: ShareCardWord[] };

export function shareTitle(data: ShareCardData): string;
export function scoreEmojiBar(score: number, total: number, maxSquares?: number): string;
export function buildShareText(data: ShareCardData, siteHost: string): string;
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[];
export const SHARE_CARD_WIDTH: number; // 1080
export const SHARE_CARD_HEIGHT: number; // 1350 (4:5, mobile-share friendly)

// src/lib/share-card-canvas.ts (client-only)
export async function renderShareCard(data: ShareCardData, opts: { toneColors: boolean }): Promise<HTMLCanvasElement>;
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob>;
export type ShareMethod = "web-share" | "clipboard" | "download";
export async function deliverShareCard(makeBlob: () => Promise<Blob>, text: string): Promise<ShareMethod | "cancelled">;

// src/components/share-score-button.tsx
export function ShareScoreButton(props: {
  data: ShareCardData;
  surface: "stats" | "practice" | "review";
  className?: string;
}): React.ReactNode;
```

### UI copy / microcopy

- Trigger buttons: stats → **"Share progress 📸"**; practice/review → **"Share score card 📸"**.
- Dialog title: **"Your score card"**; privacy line under the preview: *"Made on your device — nothing is uploaded unless you share it."*
- Actions: **Share image · Copy image · Copy text · Save PNG · Done**.
- Toasts: `"Score card copied 📋"` · `"Text copied 📋"` · `"Saved as PNG"` · error: `"Couldn't share — try Copy or Save instead"`.
- Card headline tiers: perfect → `"Perfect round! 🎉"`; ≥80% → `"So close to perfect 💪"`; else → `"Reps in — keep going 🌱"`; stats → `"🔥 {n}-day streak"` (or `"{n} words reviewed"` when streak is 0).
- Text snippet shape (practice):
  ```
  🀄 Learn 10 Mandarin Words
  🟩🟩🟩🟩🟩🟩🟩🟩🟥🟥 8/10 tricky words
  🔥 5-day streak
  learn-10-mandarin-words.vercel.app
  ```

### Test plan

`tests/share-card-logic.test.mjs` under `node --test`, importing with `.ts` extensions like `tests/progress-logic.test.mjs`:

- `scoreEmojiBar`: 0/N, N/N, mixed, caps at `maxSquares` with correct counts, never emits for `total = 0`.
- `shareTitle`: tier boundaries (exactly 80%, perfect, zero) for all three variants; streak-0 stats fallback.
- `buildShareText`: contains score, streak, host; never contains `"undefined"`/`"NaN"`; hanzi lines in the text always followed by pinyin (assert per variant with fixture words); review variant reports the grade tally.
- `wrapText`: with a fake `measure` (`s => s.length * 10`) — no line exceeds width, no dropped characters, single-long-word behavior, empty string → `[]`.
- Full gate must pass: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Manual QA checklist

- [ ] Android Chrome: Share image opens the native share sheet with the PNG attached; cancelling shows no error toast.
- [ ] iOS Safari: Web Share works; Copy image works (ClipboardItem created synchronously in the gesture); hanzi renders as glyphs, not tofu, on first-ever open (cold font cache).
- [ ] Desktop Chrome: no file share → Copy image puts a pasteable PNG on the clipboard; Firefox (no `ClipboardItem` image support in some versions) falls back to Save PNG.
- [ ] Card visual: pinyin appears under every hanzi; tone colors on the card follow the Tone colors toggle; long English glosses wrap, never overflow the panel.
- [ ] All three surfaces: practice completion, review completion, stats header (hidden when stats are all zero).
- [ ] Dialog a11y: focus moves in on open, Escape/Done closes and restores focus, `aria-modal` traps tab.
- [ ] Toast confirmations appear above the bottom nav; object URLs revoked (no leak across repeated opens).
- [ ] Offline (PWA): card generation and Save PNG still work with no network.

### Acceptance criteria

1. From a completed practice run, review session, or the stats page, a learner can produce a 1080×1350 PNG score card and share it via Web Share, copy it as an image, copy a text snippet, or save it — whichever the browser supports, with graceful fallback.
2. Every hanzi drawn on the card has pinyin beneath it; all featured words come from `topics.json` data already in component scope (no invented vocabulary).
3. No network requests are made to generate or share the card; no new dependencies are added.
4. `score_card_shared` is tracked through the existing typed analytics choke point.
5. The full validation gate passes.

### Risk and rollback notes

- **Font race (biggest risk):** Noto Sans SC is `preload: false`; drawing before load renders tofu. Mitigate with `document.fonts.load("700 96px …", "汉字样本")` + `document.fonts.ready` before drawing, and a system-CJK fallback stack matching `.font-hanzi`.
- **Safari clipboard:** `navigator.clipboard.write` must receive a `ClipboardItem` created synchronously in the user gesture with a `Promise<Blob>` payload — the delivery ladder takes `makeBlob` as a thunk for exactly this reason.
- **Web Share cancel:** `AbortError` must be treated as "cancelled", not failure.
- **Rollback:** the feature is purely additive — removing the three `<ShareScoreButton>` mounts (3 one-line JSX removals) fully disables it; the two new lib files and component are dead code that can be deleted independently. No storage schema, service-worker, or route changes.

### Non-goals / deferrals

- No timed "lightning round" mode (doesn't exist in the repo; building one is its own sprint).
- No share button on the topic quiz (`quiz-panel.tsx`), cloze, matching, or typing panels — defer; the variant-driven component makes adding them cheap later.
- No changes to `src/app/opengraph-image.tsx` / server OG images, no social SDKs, no URL shorteners, no share history persistence, no `Sec-` permission prompts pre-flighting.

### Ready-to-run Opus implementation prompt for Sprint 6

```
You are implementing Sprint 6 of "Learn 10 Mandarin Words" (Next.js 16 / React 19 / Tailwind 4,
static local-first app): a shareable score card generated client-side on <canvas>, delivered via
Web Share → clipboard → PNG download fallback. No backend, no new dependencies, no invented
vocabulary. Per AGENTS.md, read node_modules/next/dist/docs/ before writing framework-touching code.

Build exactly this:

1. src/lib/share-card-logic.ts — pure, DOM-free (follow the progress-logic.ts conventions,
   including `.ts`-extension value imports). Export:
   - type ShareCardWord = { hanzi: string; pinyin: string; english: string }
   - type ShareCardData = discriminated union:
       { kind:"stats"; streak; reviewedWords; totalWords; learnedTopics; daysStudied }
     | { kind:"practice"; score; total; missed: ShareCardWord[] }
     | { kind:"review"; total; counts: Record<Grade, number>; toughest: ShareCardWord[] }
     (import Grade from ./progress-logic.ts)
   - shareTitle(data): tiered playful headline — perfect "Perfect round! 🎉", ≥80% "So close to
     perfect 💪", else "Reps in — keep going 🌱"; stats kind: "🔥 {n}-day streak" or
     "{reviewedWords} words reviewed" when streak is 0.
   - scoreEmojiBar(score, total, maxSquares=10): 🟩/🟥 bar, capped with a numeric suffix.
   - buildShareText(data, siteHost): multi-line snippet (headline, emoji bar or stat lines,
     siteHost last). Any hanzi included must be immediately followed by its pinyin.
   - wrapText(text, maxWidth, measure): greedy wrapper with injected measure callback.
   - SHARE_CARD_WIDTH = 1080, SHARE_CARD_HEIGHT = 1350, plus color constants copied from
     src/app/globals.css (#020617 bg, #0d1220 surface, emerald accent, --color-tone-1…5 hexes)
     with comments citing their source lines.

2. src/lib/share-card-canvas.ts — client-only canvas layer:
   - renderShareCard(data, { toneColors }): offscreen canvas at card size; await
     document.fonts.ready AND document.fonts.load for Geist + "Noto Sans SC" using a hanzi sample
     string before drawing (Noto Sans SC is preload:false in src/app/layout.tsx). Draw: slate-950
     background, rounded surface panel, shareTitle, big score/streak numeral in emerald, up to 3
     featured words (practice → missed, review → toughest, stats → none) each as hanzi with pinyin
     UNDER it (tone-colored per syllable only when toneColors is true — reuse tone parsing from
     src/lib/pinyin.ts if a tone-per-syllable helper exists there; otherwise color whole pinyin
     line neutrally) and English gloss, footer "Learn 10 Mandarin Words · {host}" using SITE_NAME
     and SITE_URL host from src/lib/seo.ts.
   - canvasToBlob(canvas): promisified toBlob("image/png"), reject on null.
   - deliverShareCard(makeBlob, text): try navigator.canShare({files:[File]}) → navigator.share;
     else ClipboardItem (construct synchronously, pass makeBlob() promise as the payload for
     Safari); else object-URL download named "mandarin-score-card.png" (mirror
     exportProgress in src/components/use-progress.ts). Return "web-share"|"clipboard"|"download",
     or "cancelled" on AbortError. Never throw to the caller for cancel.

3. src/components/share-score-button.tsx — "use client". ShareScoreButton({ data, surface,
   className }). On click: render card, open a preview dialog styled like the existing dark theme,
   following the onboarding.tsx dialog pattern (role="dialog", aria-modal, Escape closes, focus
   trap + focus restore). Show the PNG preview (revoke object URLs on close), the line
   "Made on your device — nothing is uploaded unless you share it.", and actions:
   Share image / Copy image / Copy text / Save PNG / Done. Hide actions the browser can't do
   (CopyButton.tsx precedent). Use Toast (src/components/toast.tsx) for
   "Score card copied 📋" / "Text copied 📋" / "Saved as PNG" /
   "Couldn't share — try Copy or Save instead". Return null for a stats card with zero activity.
   Track("score_card_shared", { surface, method }) on success — first add "score_card_shared" to
   the AnalyticsEvent union in src/lib/analytics.ts.

4. Mount points (labels: stats → "Share progress 📸", others → "Share score card 📸"):
   - practice-app.tsx completion screen (next to "Practice again"), from score/total/missedEntries.
   - review-app.tsx session-complete summary, from session.counts, session.queue.length,
     toughestCards(session).
   - stats-app.tsx header beside the streak chip, from the existing computeStats memo +
     totalWords/totalTopics props.
   Pass the tone-colors preference via useToneColors() from src/components/use-tone-colors.ts.

5. tests/share-card-logic.test.mjs under node --test (mirror tests/progress-logic.test.mjs
   imports): scoreEmojiBar edges (0/N, N/N, cap, total 0), shareTitle tier boundaries incl. exactly
   80% and streak 0, buildShareText contains score/host and never "undefined"/"NaN" and pairs
   hanzi with pinyin, wrapText with a fake measurer (width respected, nothing dropped, empty → []).

Constraints: dark sleek UI consistent with existing emerald/slate components; pinyin on every
Chinese line (canvas and text snippet); no new deps; no network; min 44px touch targets like
existing buttons; reduced-motion safe (no new mandatory animation).

Validation gate — all must pass before you're done:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I have everything I need. Here is the plan.

---

## Sprint 7 — Sentence scramble: rebuild example sentences from shuffled chunks

### Goal and user value

Add a new "Scramble" practice tab on every topic page: the learner sees the English translation of one of the target word's real example sentences plus a bank of shuffled hanzi chunk tiles, and taps tiles to rebuild the Chinese sentence in order. Solving it exercises word order (SVO, 在-phrases, measure words, sentence-final particles) and forces active recall of the vocabulary word *in context* — a skill flashcards, cloze, and matching never touch. It's game-like (tiles, streak of green, shake on wrong order) but every card is built from the dataset's own example sentences, so nothing is invented and misses feed the same per-word accuracy stats that power "Trickiest words" and /practice.

### Current-state findings grounded in actual files/components/helpers

- **Data shape**: `src/data/topics.json` has 102 topics × 10 items; every `VocabItem` (`src/lib/types.ts:6`) has exactly 2 sentences (`{cn, en}` only — **there is no sentence-level pinyin in the data**, so tiles can carry hanzi only; word-level pinyin is available for the target word). Verified stats: 2,040 sentences, `cn` length 7–20 chars (median 13); non-hanzi characters are limited to `。，？、！` plus rare ASCII (`B出口`, `110`); 832 sentences contain inner punctuation (mostly `，`); every item has at least one sentence containing its exact hanzi (0 violations).
- **Established drill pattern**: each mode is a pure DOM-free logic module in `src/lib/*-logic.ts` + a client panel in `src/components/topic/*-panel.tsx`. The closest analogs:
  - `src/lib/cloze-logic.ts` — builds a per-item card from a shuffled eligible sentence, injectable `shuffle`, drops broken cards, deck built once per mount (`src/components/topic/cloze-panel.tsx:30`).
  - `src/lib/match-logic.ts` — pure synchronous reducer (`selectTile`) returning `{state, result}` so the panel is a thin `useState` shell; this is the right shape for tile tap logic.
- **Mode wiring**: `src/components/topic-app.tsx:37` holds the mode union `"phrasebook" | "words" | ... | "cloze"`; tabs render at lines 316–325; panels render conditionally below (cloze at line 411 receives `topic` and `onRecord={recordQuizAnswer}`).
- **Progress recording**: `recordQuizAnswer(key, correct)` from `src/components/use-progress.ts:115` updates `quizStats` and daily activity via `withPractice`; cloze and typing record exactly once per card (first answer). `wordKey` lives in `src/lib/data-logic.ts:43` (`topic.slug:hanzi`), re-exported via `src/lib/data.ts:37`; panels import it from `@/lib/data-logic` (see `cloze-panel.tsx:5`). No `ProgressState` schema change is needed.
- **Shared UI plumbing**: `defaultShuffle` in `src/lib/quiz-logic.ts:37` (injectable in every builder); `SpeakButton` (`src/components/speak-button.tsx`, props `text`/`lang`/`label`); `TonePinyin` (`src/components/tone-pinyin.tsx`, prop `pinyin`) for the tone-colors preference; `HANZI_LANG`/`PINYIN_LANG` in `src/lib/lang.ts` for per-element `lang` attributes; `.animate-quiz-correct`/`.animate-quiz-wrong` + `progress-bar-track/fill` classes in `src/app/globals.css` (already gated behind `prefers-reduced-motion` at line ~225).
- **Tests & gates**: node:test suites in `tests/*.test.mjs` import logic modules with explicit `.ts` extensions (see `tests/cloze-logic.test.mjs`) and run dataset-wide invariants against `topics.json`. `npm run validate:data` / `validate:quality` check the dataset only — this sprint changes no data, so they're unaffected but must stay green.
- **Framework**: pure client-component work; no Next.js 16 routing/data APIs are touched, so no new framework surface (AGENTS.md's "read `node_modules/next/dist/docs/` first" applies only if that changes).
- Note: `docs/claude-next-10-sprints.md` has a *different* "Sprint 7" (Phrasebook, already shipped as the `phrasebook` mode). This sprint is from the new Fable backlog; no doc collision — don't renumber anything.

### Exact implementation steps in sequence

1. **Create `src/lib/scramble-logic.ts`** (pure, DOM-free, injectable shuffle, `.ts`-extension imports like cloze-logic):
   - `splitEnding(cn)`: strip one trailing run of terminal punctuation (`。？！`) into `{ body, ending }`. The ending is displayed pinned at the end of the answer line, never a tile.
   - `chunkSentence(body, targetHanzi, vocabHanzi)`: tokenize `body` into ordered chunks: (a) occurrences of the target word and any other topic vocab hanzi become atomic chunks (longest-match-first so `火车站` beats `火车` when both are topic words); (b) each remaining run splits into fixed-size groups of 2 chars, with a trailing 1-char leftover merged into the previous group (so groups are 2–3); (c) if total chunk count exceeds `MAX_TILES = 8`, re-split non-vocab runs at size 3 instead. Inner punctuation (`，、` etc.) attaches to the end of the preceding chunk (or the following chunk when sentence-initial). Invariant: `chunks.join("") === body`.
   - `buildScrambleCard(item, topicItems, keyFor, shuffle)` → `ScrambleCard | null`: pick a sentence via `shuffle(item.sentences)[0]` (cloze pattern), chunk it, assign tile ids post-shuffle, and guard: return `null` if fewer than 2 tiles (defensive; min body is ~6 chars → ≥3 tiles today). If the shuffled tile order happens to join back to `body` (already solved), rotate the array by one — deterministic under an identity shuffle, so testable.
   - `buildScrambleDeck(items, topicItems, keyFor, shuffle)` — one card per item, nulls dropped (mirrors `buildClozeDeck`).
   - Placement reducer in the `match-logic.ts` style: `initialScrambleState()`, `placeTile(state, tileId, card)`, `returnTile(state, tileId)`, plus `isComplete(state, card)` and `checkArrangement(state, card)` → `{ solved: boolean, correctPrefixTiles: number }`. **Correctness is join-equality** — `placedText === card.body` — never tile-index equality, so duplicate chunks (e.g. two identical `很` tiles) can never produce a false negative. `correctPrefixTiles` counts leading placed tiles whose cumulative join is a prefix of `body`, for wrong-answer highlighting.
2. **Create `tests/scramble-logic.test.mjs`** — fixture tests with identity shuffle plus dataset-wide invariants (details in Test plan).
3. **Create `src/components/topic/scramble-panel.tsx`** — thin client panel over the reducer, mirroring `cloze-panel.tsx` structure (deck built once in `useState` initializer, index/score/done state, completion screen, restart). First submission of each card calls `onRecord(card.key, solved)` exactly once; re-checks after fixing don't re-record (same once-per-card semantics as quiz/cloze/typing).
4. **Wire into `src/components/topic-app.tsx`**: extend the mode union with `"scramble"`, add `<Tab>` labeled **Scramble** after the Sentences tab (line ~324), render `<ScramblePanel topic={topic} onRecord={recordQuizAnswer} />` after the cloze block (line ~413).
5. Run the full gate (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and fix anything it surfaces.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/scramble-logic.ts` | **new** — chunking, card/deck builders, placement reducer |
| `tests/scramble-logic.test.mjs` | **new** — fixtures + dataset invariants |
| `src/components/topic/scramble-panel.tsx` | **new** — the Scramble tab UI |
| `src/components/topic-app.tsx` | edit — mode union, tab, panel render (3 small additions) |

No changes to `topics.json`, `ProgressState`, validators, the service worker, or global CSS (existing animation classes suffice).

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/scramble-logic.ts
export type ScrambleTile = { id: number; text: string };

export type ScrambleCard = {
  key: string;            // wordKey — identity for recordQuizAnswer
  hanzi: string; pinyin: string; english: string;   // the drilled word
  sentenceCn: string;     // full original sentence (shown/spoken after solving)
  sentenceEn: string;     // the prompt — what the learner rebuilds from
  body: string;           // sentenceCn minus trailing terminal punctuation
  ending: string;         // trailing 。？！ run, pinned in the answer line ("" if none)
  tiles: ScrambleTile[];  // shuffled display order; ids assigned post-shuffle
};

export type ScrambleState = { placedIds: number[]; checks: number; recorded: boolean };
export type CheckResult = { solved: boolean; correctPrefixTiles: number };

export const MAX_TILES = 8;
export function splitEnding(cn: string): { body: string; ending: string };
export function chunkSentence(body: string, targetHanzi: string, vocabHanzi: string[]): string[];
export function buildScrambleCard(item: VocabItem, pool: VocabItem[],
  keyFor: (i: VocabItem) => string, shuffle?: <T>(x: T[]) => T[]): ScrambleCard | null;
export function buildScrambleDeck(items: VocabItem[], pool: VocabItem[],
  keyFor: (i: VocabItem) => string, shuffle?: <T>(x: T[]) => T[]): ScrambleCard[];
export function initialScrambleState(): ScrambleState;
export function placeTile(state: ScrambleState, tileId: number, card: ScrambleCard): ScrambleState;
export function returnTile(state: ScrambleState, tileId: number): ScrambleState;
export function isComplete(state: ScrambleState, card: ScrambleCard): boolean;
export function checkArrangement(state: ScrambleState, card: ScrambleCard): CheckResult;
```

```tsx
// src/components/topic/scramble-panel.tsx
export function ScramblePanel({ topic, onRecord }: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
}): React.JSX.Element | null;
```

Panel rendering notes: answer-line and bank tiles are `<button>`s with `lang={HANZI_LANG}` and `font-hanzi` type; the target-word hint row uses `<TonePinyin pinyin={card.pinyin} />` with `lang={PINYIN_LANG}` (respects the tone-colors toggle already on the page); solved state reuses the cloze post-answer block: full sentence + `<SpeakButton text={card.sentenceCn} label="Hear the full sentence" />` (speech only after solving, so audio can't dictate the order); wrong check flashes `.animate-quiz-wrong` on the out-of-place suffix tiles, solve pops `.animate-quiz-correct` — both already reduced-motion-gated in `globals.css`.

### UI copy / microcopy

- Tab label: **Scramble**
- Section `aria-label`: `Sentence scramble practice`
- Header: `Sentence {n} of {total}` · `Score {n}` (matches cloze)
- Prompt line above the answer area: **Rebuild the Chinese sentence:** followed by the English sentence (`card.sentenceEn`)
- Word hint row (toggleable, shown by default): `Uses: 狗 gǒu · dog`; toggle: `Hide word hint` / `Show word hint` (mirrors cloze's English-hint toggle)
- Empty answer line placeholder: `Tap the tiles below in order`
- Check button: **Check order** ; after a wrong check: `Not quite — the green part is right. Rearrange the rest.` ; tapping a placed tile: no copy needed (it returns to the bank)
- Solved state: `правильно` — no; keep it English + emoji per house style: **Nice — that's the sentence! ✓** with the full hanzi sentence and speaker button below
- Next button: `Next sentence` / final card: `See results`
- Completion screen (mirrors cloze): `Scramble complete!`, `{score}/{total}`, perfect: `Perfect — every sentence built in order.` otherwise: `Word order comes with reps — run it again.`; button: `Try again`

### Test plan (`tests/scramble-logic.test.mjs`, node:test + identity shuffle)

1. **Fixture tests** (reuse the DOG/CAT/FISH-style fixtures from `tests/cloze-logic.test.mjs`):
   - `splitEnding("我有一只狗。")` → `{ body: "我有一只狗", ending: "。" }`; sentence with no terminal punct → `ending: ""`.
   - `chunkSentence` keeps the target hanzi atomic; join invariant holds; inner `，` attaches to the preceding chunk; longest vocab match wins.
   - `buildScrambleCard` with identity shuffle: picks the first sentence, applies the anti-already-solved rotation, assigns sequential tile ids.
   - Reducer: place/return round-trips; placing an already-placed id is a no-op; `checkArrangement` join-equality — construct a card with two identical chunks and assert a swapped-duplicate arrangement still solves; `correctPrefixTiles` counts correctly on a partial match.
2. **Dataset invariants** (loop all 102 topics × 10 items × 2 sentences, like the existing dataset tests):
   - For every sentence: `chunkSentence(body, item.hanzi, topicVocab).join("") === body`; tile count is within `[2, MAX_TILES]`; no chunk is empty or starts with punctuation.
   - `buildScrambleDeck(topic.items, …)` has length 10 for every topic (no dropped cards on real data).
3. Full gate: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.

### Manual QA checklist

- [ ] Open any topic → **Scramble** tab appears after Sentences; tab row still scrolls cleanly at 360 px width.
- [ ] English prompt + word hint show; tiles are shuffled (not the solved order) across several cards.
- [ ] Tap tiles → they move to the answer line in order; tap a placed tile → it returns to the bank; the pinned `。` never moves.
- [ ] Fill all tiles wrong → **Check order** shakes the wrong suffix, green prefix stays; rearrange and re-check → solves; score does *not* increment for that card and the miss appears later under Stats → Trickiest words.
- [ ] Solve first-try → correct animation, full sentence + speaker button appear, score increments; `Next sentence` advances; last card shows the completion screen; `Try again` reshuffles.
- [ ] Progress: solving/failing cards updates the daily-goal ring (dailyActivity via `recordQuizAnswer`) and persists across reload (localStorage).
- [ ] Tone colors toggle ON recolors the hint pinyin; OS reduced-motion suppresses shake/pop; VoiceOver reads tiles with a Chinese voice (`lang="zh-Hans"`).
- [ ] Switch topics mid-drill → panel resets to the new topic's deck (deck is keyed off mount like cloze; verify no stale card).
- [ ] A sentence containing ASCII (`ten-types-of-subway-things` → 出口 → "去公园要从地铁站的B出口出去。", or 报警 → "在中国报警可以打110。") chunks and solves without oddities.

### Acceptance criteria

1. Every topic page has a working Scramble tab; every one of the topic's 10 words yields exactly one playable card per run, built only from that word's real example sentences.
2. Reassembling any arrangement whose text equals the original sentence counts as solved (duplicate tiles can never cause a false wrong).
3. First check per card records once through `recordQuizAnswer` with the standard `wordKey`, feeding quizStats, daily activity, Trickiest words, and /practice — with zero schema changes.
4. All logic is in a pure, shuffle-injectable `scramble-logic.ts` with node:test coverage including the full-dataset join invariant (2,040 sentences).
5. All five gate commands pass; no changes to `topics.json` or validators; UI matches the existing dark emerald/surface design language and meets the 44 px tap-target and `lang`-attribute conventions.

### Risk and rollback notes

- **Chunk boundaries aren't linguistic words** (no segmenter in the repo, and adding one is out of scope). Risk: a 2-char chunk straddles two words and reads oddly. Mitigation: vocab-word atomicity + punctuation attachment keep the most meaningful units intact, and the drill's check is order-of-text, so pedagogy (word order) survives imperfect segmentation. If feedback is bad, the chunker is one isolated pure function to revise.
- **Duplicate-chunk ambiguity** is fully neutralized by join-equality checking — this is the one correctness landmine; the dedicated duplicate-tile test guards it.
- **Rollback** is trivial and additive: revert the 3-line `topic-app.tsx` edit and delete the two new files + test. No persisted-data migration to unwind (quizStats entries written by scramble are indistinguishable from quiz/cloze entries and harmless if the mode is removed).

### Non-goals / deferrals

- No drag-and-drop (tap-to-place is simpler, mobile-first, and matches Match's interaction grammar); a drag layer could reuse `use-card-drag.ts` later.
- No sentence-level pinyin display — the data doesn't contain it and inventing it is prohibited; word-level pinyin appears in the hint and post-solve detail only.
- No scramble mode on `/practice` or `/review` (cloze isn't there either); no new analytics events; no timer/leaderboard mechanics; no new `ProgressState` fields.

### Ready-to-run Opus implementation prompt for Sprint 7

```
Implement Sprint 7 of learn-10-mandarin-words: a "Scramble" practice tab where the learner
rebuilds a word's real example sentence from shuffled hanzi chunk tiles. Read AGENTS.md first;
this is Next.js 16 — consult node_modules/next/dist/docs/ before using any framework API
(this sprint should need none: it's pure client-component work).

Follow the established drill pattern exactly (see src/lib/cloze-logic.ts +
src/components/topic/cloze-panel.tsx for the card/deck/panel shape, and src/lib/match-logic.ts
for the pure tap reducer shape).

1. Create src/lib/scramble-logic.ts — pure, DOM-free, injectable shuffle (default
   defaultShuffle from ./quiz-logic.ts, imported with the explicit .ts extension like the
   other logic modules):
   - splitEnding(cn): split one trailing run of 。？！ into { body, ending }.
   - chunkSentence(body, targetHanzi, vocabHanzi): ordered chunks where occurrences of the
     target word and other topic vocab hanzi are atomic (longest match first); remaining runs
     split into 2-char groups (trailing 1-char leftover merges into the previous group; use
     3-char groups if total tiles would exceed MAX_TILES = 8); inner punctuation （，、 etc.）
     attaches to the preceding chunk (following chunk if sentence-initial).
     Invariant: chunks.join("") === body.
   - buildScrambleCard(item, pool, keyFor, shuffle): pick the sentence via
     shuffle(item.sentences)[0]; tiles get ids AFTER shuffling; if the shuffled order joins
     back to body, rotate by one; return null if < 2 tiles. buildScrambleDeck maps items and
     drops nulls. Card fields: key, hanzi, pinyin, english, sentenceCn, sentenceEn, body,
     ending, tiles: {id, text}[].
   - Reducer: initialScrambleState() → { placedIds: [], checks: 0, recorded: false };
     placeTile / returnTile / isComplete / checkArrangement(state, card) →
     { solved, correctPrefixTiles }. Correctness is JOIN-EQUALITY (placed text === body),
     never tile-index equality, so duplicate chunks can't cause false negatives.
     correctPrefixTiles = count of leading placed tiles whose cumulative join is a prefix of
     body (drives wrong-answer highlighting).

2. Create src/components/topic/scramble-panel.tsx ("use client"), mirroring cloze-panel:
   deck built once in the useState initializer (buildScrambleDeck(topic.items, topic.items,
   item => wordKey(topic, item))), index/score/done state, restart. UI: header
   "Sentence {n} of {total}" + "Score {n}" + progress-bar-track/fill; prompt "Rebuild the
   Chinese sentence:" over the English sentence; toggleable word-hint row shown by default
   ("Uses: {hanzi} {pinyin} · {english}", pinyin via <TonePinyin/>, toggle copy "Hide word
   hint"/"Show word hint"); answer line (placed tiles in order + pinned ending punctuation,
   placeholder "Tap the tiles below in order"); tile bank (tap to place, tap placed to
   return); "Check order" button enabled when all tiles are placed. First check per card
   calls onRecord(card.key, solved) exactly ONCE (guard with state.recorded — same
   once-per-card semantics as cloze/quiz); wrong check shows "Not quite — the green part is
   right. Rearrange the rest." and flashes animate-quiz-wrong on the incorrect suffix while
   the correct prefix stays emerald; re-checks after fixing don't re-record. Solved: "Nice —
   that's the sentence! ✓", full sentenceCn with <SpeakButton text={card.sentenceCn}
   label="Hear the full sentence"/> (speech only after solving), word detail line, then
   "Next sentence" / "See results". Completion screen mirrors cloze: "Scramble complete!",
   score/total, "Perfect — every sentence built in order." vs "Word order comes with reps —
   run it again.", "Try again" rebuilds the deck. Conventions: lang={HANZI_LANG} on hanzi,
   lang={PINYIN_LANG} on pinyin (src/lib/lang.ts), font-hanzi, min-h-[44px] targets, the
   dark surface/emerald styling used by the other panels, aria-label "Sentence scramble
   practice".

3. Wire src/components/topic-app.tsx: add "scramble" to the mode union (line ~37), a
   <Tab> labeled "Scramble" after the Sentences tab (~line 324), and
   {mode === "scramble" ? <ScramblePanel topic={topic} onRecord={recordQuizAnswer} /> : null}
   after the cloze block (~line 413).

4. Create tests/scramble-logic.test.mjs (node:test, import with .ts extensions, identity
   shuffle for determinism; fixture style of tests/cloze-logic.test.mjs): splitEnding cases;
   chunkSentence atomicity/join/punctuation-attachment/longest-match; card rotation guard and
   post-shuffle ids; reducer place/return/no-op-repeat; duplicate-chunk join-equality (a card
   with two identical tiles solves in either order); correctPrefixTiles on partial matches.
   Dataset invariants over ALL of src/data/topics.json: join invariant for every sentence,
   tile count in [2, 8], no empty chunks, no chunk starting with punctuation, and every
   topic's deck has length 10.

Do NOT: modify topics.json or any script in scripts/, change ProgressState or the progress
schema version, add dependencies, add drag-and-drop, invent sentence-level pinyin, or touch
the service worker.

Validation gate — all must pass before you're done:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

All findings are in — the repo already has every building block this sprint needs (`tonesOf()` tone parsing, a hardened `useSpeech()` TTS hook, quiz distractor machinery, and a visual-only tone drill to complement). Here is the plan.

---

## Sprint 8 — Listening tone trainer: hear the word, pick the tone pattern

### Goal and user value

Today the topic page's "Tone practice" section is **eyes-first**: the learner sees hanzi + tone-stripped pinyin and picks a tone per syllable. This sprint adds the inverse, **ears-first** drill: the app *speaks* the word (nothing revealed on screen), and the learner picks the whole tone pattern (e.g. `ˇ ˉ` = 3-1) from four tempting choices in one tap. It's an arcade-style round — instant feedback, streak counter, end-of-round score — that trains actual tone *perception*, the skill the visual drill can't reach. Answers feed the existing per-word quiz stats, so tone-deaf words surface as "tricky" on the stats page and in the practice deck, making the fun loop genuinely retention-useful.

### Current-state findings (grounded in actual files)

- **Tone parsing exists and is dataset-proven.** `src/lib/pinyin.ts` exports `tonesOf(pinyin): Tone[]` (tones 1–5, one per vowel cluster) plus `Tone`, `stripToneMarks`. `tests/pinyin.test.mjs` asserts every one of the 1020 dataset words yields a tone sequence matching its hanzi length — so a tone-pattern answer is derivable for *every* word, no new data needed.
- **Hardened TTS exists.** `src/components/use-speech.ts` (`useSpeech()` → `{ status, speaking, failed, speak, stop }`) wraps all Chrome/Android Web Speech quirks; `src/lib/speech.ts` provides voice ranking and `canAttemptSpeech()`. The listening quiz mode in `src/components/topic/quiz-panel.tsx:155-188` already established the exact audio-drill UX conventions to copy: no autoplay, a big 72px emerald play button, a "Replay" affordance after first play, and no-Chinese-voice microcopy driven by `status === "no-chinese-voice"`.
- **Speech availability gating is already computed** in `src/components/topic-app.tsx:59-60` (`speechAvailable = canAttemptSpeech(speechStatus)`) and used to hide the "Listen 🔊" quiz mode chip — same gate applies here.
- **The visual tone drill** `src/components/tone-practice.tsx` mounts at `topic-app.tsx:425-432` under an "additive, independent of mode tabs" section heading "Tone practice". It has its own `TONE_LABELS` glyph map (`1 ˉ / 2 ˊ / 3 ˇ / 4 ˋ / 5 ·`) and only fires `track("tone_practice_completed")` — it does **not** record progress.
- **Distractor machinery pattern.** `src/lib/quiz-logic.ts` shows the house style: pure logic module, injectable `shuffle` (exports `defaultShuffle`), dedupe, ranked distractors, unit-tested via `tests/*.test.mjs` importing `.ts` files with explicit extensions (`import { … } from "./pinyin.ts"` — required for `node --test`, allowed via `allowImportingTsExtensions`).
- **Progress recording choke point.** `useProgress().recordQuizAnswer(key, correct)` (`src/components/use-progress.ts:115-118`) updates `quizStats` *and* stamps daily activity/goal via `withPractice`. `MatchPanel`, `TypingPanel`, and `ClozePanel` all receive it as `onRecord` — the trainer should follow that convention (unlike the older `TonePractice`, which predates it). Word identity comes from `keyFor` (`wordKey(topic, item)`, already a `useCallback` at `topic-app.tsx:80`).
- **Tone colors tie-in (Sprint 10).** `src/lib/tone-colors.ts` exports `TONE_TEXT_CLASS: Record<Tone, string>`; `src/components/use-tone-colors.ts` exposes the device-local toggle; `src/components/tone-pinyin.tsx` renders tone-colored pinyin. The reveal screen and answer chips can reuse these for a delightful, consistent touch.
- **Analytics union** in `src/lib/analytics.ts:15-33` is a closed string union — a new event name must be added there.
- **Language tags:** `src/lib/lang.ts` exports `HANZI_LANG` / `PINYIN_LANG` for the reveal.
- **Validation scripts** exist as stated: `test` (`node --test`), `validate:data`, `validate:quality`, `lint`, `build` (`package.json:5-15`).

One naming note: the git log already contains a commit "sprint 8: branded 404/error pages" from an earlier backlog (`docs/claude-next-sprints.md` era). This plan's "Sprint 8" is from the *Fable* backlog — the commit message should say `fable sprint 8: listening tone trainer` or similar to avoid confusion.

### Exact implementation steps in sequence

1. **Create the pure logic module `src/lib/tone-trainer-logic.ts`** (DOM-free, mirrors `quiz-logic.ts` / `listen-logic.ts`):
   - `TONE_GLYPHS` map (reuse the glyph vocabulary from `tone-practice.tsx`: `ˉ ˊ ˇ ˋ ·`).
   - `patternKey`, `patternGlyphs`, `patternAriaLabel` formatting helpers.
   - `mutatedPatterns(answer)`: all patterns differing from the answer in exactly one syllable's tone (candidate distractors that always exist, even for 1-syllable words).
   - `buildToneRound(item, pool, keyFor, shuffle?)`: answer = `tonesOf(item.pinyin)`; distractors = same-syllable-count patterns of *other pool words* first (real patterns are the most tempting), topped up from `mutatedPatterns`, deduped by `patternKey`, sliced to 3, then answer shuffled in. Returns `null` if `tonesOf` is empty (defensive; dataset never hits it).
   - `buildToneRounds(topic, keyFor, shuffle?)`: one round per word, shuffled order per session.
   - `hasThirdTonePair(pattern)`: true when two 3rd tones are adjacent (powers the tone-sandhi hint).
   - `streakLabel(streak)`: fun copy at thresholds 3/5/10, `null` otherwise.
   - Import `defaultShuffle` from `./quiz-logic.ts` and `tonesOf`/`Tone` from `./pinyin.ts` (explicit `.ts` extensions, per house rule).
2. **Write `tests/tone-trainer-logic.test.mjs`** (see Test plan) and get `npm run test` green before touching UI.
3. **Add the analytics event**: extend the `AnalyticsEvent` union in `src/lib/analytics.ts` with `"tone_listen_completed"` (fired once per finished round-set, props `{ topic, total, correct, bestStreak }`).
4. **Create `src/components/tone-listen-trainer.tsx`** (`"use client"`): round state machine (`playing → answered → next / summary`), `useSpeech()` for audio, chips rendered from `patternGlyphs` with `TONE_TEXT_CLASS` coloring when `useToneColors().enabled`, reveal card with hanzi (`lang={HANZI_LANG}`) + `<TonePinyin pinyin={…}/>` + English, streak counter, summary screen. Calls `onRecord(round.key, correct)` exactly once per round (first tap wins, same guard as `answerQuiz`). Speech: big play button (no autoplay on mount); after "Next word" is tapped, speak the next word inside the same click handler (gesture-initiated, so mobile autoplay policies are satisfied); `stop()` in an unmount cleanup so switching tabs/modes silences audio.
5. **Mount it in `src/components/topic-app.tsx`**: in the existing "Tone practice" section (lines 425–432), add a small two-chip mode switch — `Read` (default, renders existing `<TonePractice/>` unchanged) and `Listen 🔊` (renders `<ToneListenTrainer topic={topic} keyFor={keyFor} onRecord={recordQuizAnswer}/>`). Gate the Listen chip on the already-computed `speechAvailable`, exactly like the quiz's listening chip, and update the section's subtitle copy. One `useState<"read" | "listen">` — no other topic-app state changes.
6. **Run the full gate** (`npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`) and fix anything it surfaces.
7. **Manual QA** per checklist below, then commit as `fable sprint 8: listening tone trainer`.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/tone-trainer-logic.ts` | **new** — pure round/distractor/label logic |
| `tests/tone-trainer-logic.test.mjs` | **new** — unit + dataset-wide tests |
| `src/components/tone-listen-trainer.tsx` | **new** — the drill UI |
| `src/lib/analytics.ts` | add `"tone_listen_completed"` to the union |
| `src/components/topic-app.tsx` | Read/Listen switch in the tone-practice section; pass `keyFor` + `recordQuizAnswer` |

Nothing else changes — `tone-practice.tsx`, `pinyin.ts`, `use-speech.ts`, progress schema, and the service worker are untouched.

### Proposed names and TypeScript signatures

```ts
// src/lib/tone-trainer-logic.ts
import { tonesOf, type Tone } from "./pinyin.ts";
import { defaultShuffle } from "./quiz-logic.ts";
import type { Topic, VocabItem } from "./types";

export type TonePattern = Tone[];

export type ToneRound = {
  key: string;              // wordKey(topic, item) — quizStats/daily-goal identity
  hanzi: string;
  pinyin: string;           // tone-marked, for the post-answer reveal only
  english: string;
  answer: TonePattern;
  options: TonePattern[];   // 2–4 unique patterns incl. answer, pre-shuffled
};

export const TONE_GLYPHS: Record<Tone, string>; // 1:"ˉ" 2:"ˊ" 3:"ˇ" 4:"ˋ" 5:"·"

export function patternKey(pattern: TonePattern): string;        // [4,5,3] → "4-5-3"
export function patternGlyphs(pattern: TonePattern): string;     // [4,5,3] → "ˋ · ˇ"
export function patternAriaLabel(pattern: TonePattern): string;  // "tone 4, neutral tone, tone 3"
export function mutatedPatterns(answer: TonePattern): TonePattern[];
export function hasThirdTonePair(pattern: TonePattern): boolean; // adjacent 3-3 → sandhi hint
export function streakLabel(streak: number): string | null;

export function buildToneRound(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle?: <T>(items: T[]) => T[],
): ToneRound | null;

export function buildToneRounds(
  topic: Topic,
  keyFor: (item: VocabItem) => string,
  shuffle?: <T>(items: T[]) => T[],
): ToneRound[];
```

```tsx
// src/components/tone-listen-trainer.tsx
export function ToneListenTrainer(props: {
  topic: Topic;
  keyFor: (item: VocabItem) => string;
  onRecord: (key: string, correct: boolean) => void; // recordQuizAnswer
}): React.JSX.Element | null;
```

Internal component state (not exported): `rounds` in a `useMemo` keyed on `topic` + a `seed` counter (bump seed on "Play again" to reshuffle), `index`, `picked: string | null` (a `patternKey`), `score`, `streak`, `bestStreak`, `playedKey` (Replay affordance, same as quiz-panel), `done`.

### UI copy / microcopy

- Section subtitle (topic-app): `Train your ear for tones — read the word, or just listen.`
- Mode chips: `Read` / `Listen 🔊`
- Drill header: counter `Word 3 of 10`, badge `Ear training`
- Pre-play helper: `Listen, then pick the tone pattern` · replay link: `Replay`
- No-voice notes (verbatim from quiz-panel for consistency): `Your device has no Chinese voice installed, so listening mode may be silent.` / `No sound? Your device may lack a Chinese voice.`
- Correct: `Correct — golden ear!` · Wrong: `Not quite — it was ˇ ˉ (3-1).`
- Sandhi hint (only when `hasThirdTonePair(answer)`): `Heads up: two 3rd tones in a row are spoken like 2-3 — we show the written tones.`
- Streaks (`streakLabel`): 3 → `3 in a row — your ear is waking up!` · 5 → `5 straight — golden ear! ✨` · 10 → `10 straight — tone master! 🐉`
- Buttons: `Next word` / `See results` (last round)
- Summary: `Ear training complete!` · `{score}/{total}` · `Best streak: {bestStreak}` · perfect: `Perfect — you heard every tone.` · ≥80%: `Sharp ears! A couple more listens and it's yours.` · else: `Tones take time — one more round tunes the ear.` · actions: `Play again` / `Practice reading tones`
- Footnote: `Tone patterns come from each word's pinyin. Your results stay on this device.`

### Test plan

New `tests/tone-trainer-logic.test.mjs` (Node test runner, deterministic identity shuffle injected, follows `quiz-logic.test` conventions):

1. `patternKey` / `patternGlyphs` / `patternAriaLabel` format 1-, 2-, and 3-syllable patterns including neutral tone.
2. `mutatedPatterns([3])` returns exactly the 4 other single-tone patterns; for `[3,1]` every mutation differs in exactly one position; no duplicates; never contains the answer.
3. `buildToneRound`: options contain the answer exactly once; all options unique by `patternKey`; all options same length as the answer; ≤4 options; distractors drawn from pool patterns are preferred over mutations (assert with a crafted pool).
4. Round is `null` for an item whose pinyin has no vowels (defensive branch).
5. `buildToneRounds` over a real-shaped topic fixture: one round per item, order respects injected shuffle.
6. **Dataset-wide invariant** (imports `src/data/topics.json`, like `pinyin.test.mjs`): for all 1020 words, `buildToneRound` returns exactly 4 unique same-length options including the answer.
7. `hasThirdTonePair`: true for `[3,3]` and `[2,3,3]`, false for `[3,1,3]`.
8. `streakLabel`: non-null exactly at 3, 5, 10.

Existing suites must stay green — nothing shared is modified except the analytics union (type-only, no runtime tests).

### Manual QA checklist

- [ ] Topic page → Tone practice → `Listen 🔊` chip appears on a device with a Chinese voice; **absent** when voices are populated with no zh voice (spoof via DevTools or a machine without one).
- [ ] `Read` mode still renders the existing per-syllable drill, unchanged.
- [ ] Tap play → hears the word; hanzi/pinyin/English are **not** visible pre-answer; `Replay` appears after first play.
- [ ] Pick correct → chip goes emerald, streak increments, reveal shows hanzi + tone-marked pinyin + English with a speak button.
- [ ] Pick wrong → rose feedback, correct pattern highlighted, streak resets to 0.
- [ ] `Next word` speaks the next word immediately (single tap, no double-tap needed) — verify on iOS Safari and Android Chrome.
- [ ] Two 3rd-tone word (e.g. 你好 nǐ hǎo) shows the sandhi hint.
- [ ] Tone colors toggle ON → option glyphs and revealed pinyin are tone-colored; OFF → neutral.
- [ ] Finish all words → summary with score + best streak; `Play again` reshuffles order; dev console shows one `tone_listen_completed` event.
- [ ] Stats page: a word missed repeatedly in the trainer appears in tricky/weak words; daily-goal ring advances after a round.
- [ ] Switching tabs/modes or navigating away mid-audio silences speech (no orphaned playback).
- [ ] Keyboard-only: play button, chips, and Next are reachable and operable; reveal is announced (`role="status"`).
- [ ] 360px-wide viewport: chips wrap cleanly, tap targets ≥44px.

### Acceptance criteria

1. Every topic page offers a Listen mode in the Tone practice section on speech-capable devices, and hides it (never renders a dead control) when no Chinese voice exists.
2. Each round plays audio only, offers exactly 4 unique same-length tone-pattern choices (fewer only if mathematically impossible — not the case in this dataset), one tap to answer, instant graded feedback with full reveal.
3. Answers are recorded once per round via `recordQuizAnswer`, driving quizStats, daily activity, and the daily-goal event; no new localStorage keys, no schema bump.
4. Streaks and a summary screen make it feel like a game; `tone_listen_completed` fires once per completed set.
5. All five gate commands pass: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Tone sandhi** is the main pedagogical risk: TTS engines speak 3-3 as 2-3 (你好 → ní hǎo), while the graded answer is the *written* 3-3. Mitigated by the conditional hint; graded answers stay consistent with the visual drill and dictionaries. 不/一 contextual tones are already encoded in the dataset's pinyin marks, so they self-align.
- **TTS tone fidelity varies by voice** (some low-quality voices flatten tones). Mitigated: voice ranking already prefers `zh-CN` local voices; the drill is gated on `speechAvailable`; Replay lets learners re-listen.
- **Autoplay-on-Next** relies on speaking inside the click handler; if any platform still blocks it, the fallback is the ever-present play button (degrades gracefully, no stall).
- **Rollback:** entirely additive — two new files plus a ~10-line mount diff in `topic-app.tsx` and one union member in `analytics.ts`. `git revert` of the single sprint commit restores prior behavior; no stored-data migration in either direction (quizStats shape unchanged).

### Non-goals / deferrals

- No microphone input, pitch detection, or pronunciation scoring.
- No pre-recorded audio files or external TTS services — Web Speech only, per the local-first constraint.
- No cross-topic "listening deck" on `/practice` or `/review` (a natural follow-up once the per-topic drill proves out).
- No per-syllable listening picker (the existing Read drill covers granular input; Listen stays one-tap).
- No changes to SRS scheduling, progress schema, service worker, or the existing `TonePractice` internals.

### Ready-to-run Opus implementation prompt for Sprint 8

```text
Implement Fable Sprint 8 for the learn-10-mandarin-words repo (Next.js 16 / React 19 / Tailwind 4, static local-first): an audio-first "Listening tone trainer" — hear the word via TTS, pick its tone pattern in one tap. Read AGENTS.md first (Next.js 16 has breaking changes; consult node_modules/next/dist/docs/ if framework questions arise). Everything is additive; do NOT add packages, backends, storage keys, or vocabulary data.

1) NEW src/lib/tone-trainer-logic.ts — pure, DOM-free (house style: see src/lib/quiz-logic.ts and src/lib/listen-logic.ts). Import { tonesOf, type Tone } from "./pinyin.ts" and { defaultShuffle } from "./quiz-logic.ts" (explicit .ts extensions — required for node --test). Export:
   - TONE_GLYPHS: Record<Tone,string> = {1:"ˉ",2:"ˊ",3:"ˇ",4:"ˋ",5:"·"} (same glyphs as tone-practice.tsx).
   - type TonePattern = Tone[]; type ToneRound = { key; hanzi; pinyin; english; answer: TonePattern; options: TonePattern[] }.
   - patternKey(p) → "4-5-3"; patternGlyphs(p) → "ˋ · ˇ"; patternAriaLabel(p) → "tone 4, neutral tone, tone 3".
   - mutatedPatterns(answer): all patterns differing in exactly one position (that position cycles the 4 other tones), no dupes, never the answer.
   - hasThirdTonePair(p): adjacent 3,3 anywhere.
   - streakLabel(n): copy at 3 ("3 in a row — your ear is waking up!"), 5 ("5 straight — golden ear! ✨"), 10 ("10 straight — tone master! 🐉"), else null.
   - buildToneRound(item, pool, keyFor, shuffle = defaultShuffle): answer = tonesOf(item.pinyin) (return null if empty). Distractors: dedupe-by-patternKey the same-length patterns of OTHER pool words (shuffled), then top up from shuffled mutatedPatterns, slice 3, options = shuffle([answer, ...distractors]).
   - buildToneRounds(topic, keyFor, shuffle?): one round per item with derivable tones, session order shuffled.

2) NEW tests/tone-trainer-logic.test.mjs (node:test + assert/strict, deterministic identity shuffle injected, mirror tests/quiz-logic.test.mjs conventions): format helpers; mutatedPatterns correctness ([3] → 4 patterns); buildToneRound invariants (answer present exactly once, all options unique + same length as answer, ≤4, pool patterns preferred over mutations); null branch; hasThirdTonePair; streakLabel thresholds; and a dataset-wide test importing ../src/data/topics.json asserting every one of the 1020 words yields exactly 4 unique options including the answer (see tests/pinyin.test.mjs for the import pattern).

3) src/lib/analytics.ts: add "tone_listen_completed" to the AnalyticsEvent union.

4) NEW src/components/tone-listen-trainer.tsx ("use client"). Props { topic: Topic; keyFor: (item: VocabItem) => string; onRecord: (key: string, correct: boolean) => void }. Build rounds in useMemo keyed on topic + a seed counter (bump on "Play again"). Use useSpeech() from ./use-speech (speak(round.hanzi); call stop() in unmount cleanup). Copy the listening-quiz UX from src/components/topic/quiz-panel.tsx lines 155–188 exactly: NO autoplay on mount, 72px emerald round play button, "Replay" link after first play, no-voice microcopy keyed off status === "no-chinese-voice". Pre-answer: show NOTHING identifying the word. Options: one chip per pattern showing patternGlyphs + small "(3-1)" digits, aria-label from patternAriaLabel; when useToneColors().enabled, color each glyph span with TONE_TEXT_CLASS[tone] from @/lib/tone-colors. First tap locks the answer and calls onRecord(round.key, correct) exactly once; grade chips with the quiz's semantic classes (emerald fill correct / rose wash wrong, reuse animate-quiz-correct/animate-quiz-wrong). Reveal card (role="status"): hanzi with lang={HANZI_LANG} + SpeakButton, <TonePinyin pinyin={round.pinyin}/> with lang={PINYIN_LANG}, English, wrong-answer line `Not quite — it was ˇ ˉ (3-1).`, and — only when hasThirdTonePair(answer) — the hint "Heads up: two 3rd tones in a row are spoken like 2-3 — we show the written tones." Track streak/bestStreak/score; show streakLabel when non-null. "Next word" advances AND speaks the next word synchronously inside the click handler (gesture-safe autoplay). After the last round show a summary ("Ear training complete!", score/total, best streak, tiered copy, "Play again" reshuffles via seed bump, "Practice reading tones" is wired by the parent) and fire track("tone_listen_completed", { topic: topic.slug, total, correct: score, bestStreak }) once. Footnote: "Tone patterns come from each word's pinyin. Your results stay on this device." Match the app's Level-2 visual language (rounded-3xl border-white/10 bg-surface cards, ≥44px targets) as used in tone-practice.tsx.

5) src/components/topic-app.tsx: in the existing "Tone practice" section (currently lines 425–432), add toneMode useState<"read"|"listen"> ("read" default) with two quiet chips — "Read" always, "Listen 🔊" only when speechAvailable (already computed) — styled like the quiz-mode chips. Render <TonePractice topic={topic}/> or <ToneListenTrainer topic={topic} keyFor={keyFor} onRecord={recordQuizAnswer}/>. Wire the summary's "Practice reading tones" action to setToneMode("read"). Update the section subtitle to "Train your ear for tones — read the word, or just listen." Do not modify tone-practice.tsx.

Constraints: no per-word tone tables (tones ALWAYS derive from pinyin via tonesOf); no new localStorage keys or ProgressState changes (recordQuizAnswer is the only persistence path); SSR-safe (no window access outside effects/handlers; first render must match server).

Validation gate — all must pass before committing:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Commit as: "fable sprint 8: listening tone trainer" (note: an unrelated older commit is already named "sprint 8" — keep the "fable" prefix).
```

---

I've read all the relevant drill logic, panels, progress persistence, and card surfaces. Here is the plan.

---

## Sprint 9 — Topic Boss Round: mixed-skill gauntlet to crown a topic

### Goal and user value

Each topic page gets a short, dramatic capstone: the **Boss Round** — four questions, one drawn from each existing skill (multiple-choice quiz, sentence cloze, tone check, typed pinyin), each on a *different* word from the topic. Beat all four in one run and the topic is **crowned**: a 👑 badge persists in localStorage, appears on the topic's card in the library/category/path grids, and on the topic page itself. It gives every topic a finish line beyond "Mark learned" (which is self-declared), it's replayable (best score is kept), and it's pedagogically honest — the crown certifies recognition, reading-in-context, tone perception, and pinyin production, all using drills and data that already exist. No new content is invented; every question is generated from `topics.json` via existing pure helpers.

### Current-state findings (grounded in actual files)

- **Topic page shell** — `src/components/topic-app.tsx` owns a `mode` union `"phrasebook" | "words" | "flashcards" | "quiz" | "typed" | "match" | "cloze"` (line 37) rendered as `Tab` buttons (lines 316–325), and passes `recordQuizAnswer` down to TypingPanel/MatchPanel/ClozePanel (lines 401–413). A new tab + panel slots in cleanly.
- **Question generators already exist as pure, shuffle-injectable helpers**:
  - MCQ: `buildQuizCard(item, pool, mode, keyFor, shuffle)` in `src/lib/quiz-logic.ts:200` (with tempting-distractor ranking).
  - Cloze: `buildClozeCard(item, pool, keyFor, shuffle)` in `src/lib/cloze-logic.ts:66` (returns `null` if no sentence contains the hanzi — graceful degrade).
  - Typing: `gradeTypedPinyin(input, expectedPinyin)` / `parseTypedPinyin` / `toneNumberForm` in `src/lib/typing-logic.ts` (grades `correct | tones-off | incorrect`).
  - Tones: `tonesOf(pinyin)` and `type Tone` in `src/lib/pinyin.ts:14,61`; the tone-picker UI pattern lives in `src/components/tone-practice.tsx` (per-syllable 1–5 chips, tone-stripped syllable labels via its private `displaySyllables` helper, lines 23–28).
- **Persistence** — `src/components/use-progress.ts` stores `ProgressState` under `learn-10-mandarin-progress-v1`; `src/lib/progress-logic.ts` owns `CURRENT_PROGRESS_SCHEMA_VERSION = 4` and `normalizeProgress` (never throws, migrates old saves). All graded interactions funnel through `recordQuizAnswer` → `updateQuizStats` + `withPractice` (daily-goal + streak stamping, use-progress.ts:34–44). A crown must live here as a new schema-v5 field.
- **Topic cards** — `src/components/topic-card.tsx` already renders status badges (`▶ Video`, `★ Saved`, `Learned`, lines 66–86) and is used by `home-app.tsx:318`, `category-app.tsx:53`, `path-app.tsx:97` — all three already call `useProgress()`, so passing a `crowned` flag is trivial.
- **Precedents for panel structure** — `ClozePanel` (`src/components/topic/cloze-panel.tsx`) and `TypingPanel` (`topic/typing-panel.tsx`) are the style guide: deck built once per mount, `role="status"` feedback, `animate-quiz-correct`/`animate-quiz-wrong`/`animate-celebrate` CSS classes, emerald/rose/amber semantics, ≥44px targets, `SpeakButton` for audio, `lang` attributes from `src/lib/lang.ts`, pinyin always shown on reveal.
- **Analytics** — `src/lib/analytics.ts` has a closed `AnalyticsEvent` union (local/no-network); a new event name must be added there.
- **Tests** — `tests/*.test.mjs` run under `node --test`, importing lib modules directly with `.ts` extensions (see `tests/quiz-logic.test.mjs`), using an identity shuffle for determinism. Cross-lib runtime imports inside `src/lib` use explicit `.ts` extensions (e.g. `cloze-logic.ts:7`).
- **`wordKey`** — `src/lib/data-logic.ts:43`: `` `${topic.slug}:${item.hanzi}` `` is the stable per-word identity all stats key on.
- **Framework note** — per `AGENTS.md`, this Next.js 16 repo requires checking `node_modules/next/dist/docs/` before writing framework-touching code; this sprint is client-component-only (no new routes), so exposure is minimal.

### Exact implementation steps in sequence

1. **`src/lib/boss-logic.ts` (new, pure, DOM-free)** — the round builder and stage types:
   - Define `BossStage` as a discriminated union over the four skills (see signatures below), `BossRound = { stages: BossStage[] }`, `export const BOSS_STAGE_COUNT = 4`.
   - `buildBossRound(items, pool, keyFor, shuffle)`: shuffle `items` once; walk the shuffled order assigning each stage a **distinct** word — cloze first (needs `clozeSentences(item).length > 0`), then tone (needs `tonesOf(item.pinyin).length > 0`), then quiz and typing from the remainder. Quiz stage uses `buildQuizCard(item, pool, "hanzi-english", keyFor, shuffle)`; cloze uses `buildClozeCard`. If a skill has no eligible word (defensive; the dataset guarantees eligibility today), substitute an extra quiz stage so the round is always 4 stages. Final stage order is fixed for drama: quiz → cloze → tone → typing (recognition → context → ear → production).
   - Add a small pure helper `bareSyllables(pinyin: string, count: number): string[]` to `src/lib/pinyin.ts` (the logic currently private in `tone-practice.tsx`'s `displaySyllables`), and refactor `tone-practice.tsx` to import it — one source of truth, now unit-testable.
2. **`src/lib/progress-logic.ts`** — schema v5:
   - Add `BossStat = { bestScore: number; attempts: number; crownedAt: string | null }` and `bossStats: Record<string, BossStat>` (keyed by topic slug) to `ProgressState` in `src/lib/types.ts`; add `bossStats: {}` to `emptyProgress`.
   - Bump `CURRENT_PROGRESS_SCHEMA_VERSION` to 5; document `v4 → v5: added bossStats` in the existing comment block; add `normalizeBossStats(raw)` (coerce counts to non-negative ints, `bestScore ≤ BOSS_STAGE_COUNT`, invalid `crownedAt` → null, never throws) and wire it into `normalizeProgress`.
   - Add pure `recordBossResult(bossStats, slug, score, total, now)` → new map: increments `attempts`, raises `bestScore`, sets `crownedAt` only when `score === total` and only if not already crowned (first crown date is kept). Add `isCrowned(bossStats, slug)`.
3. **`src/components/use-progress.ts`** — expose `recordBossResult(slug, score, total)` in the hook's returned object, calling the pure helper via `setProgress` (no `withPractice` here; per-word practice is already recorded stage-by-stage through `recordQuizAnswer`).
4. **`src/lib/analytics.ts`** — add `"boss_round_completed"` to the `AnalyticsEvent` union.
5. **`src/components/topic/boss-panel.tsx` (new client component)** — self-contained gauntlet UI, following ClozePanel/TypingPanel conventions:
   - Phases: `intro` (explains the four skills, Start button) → `running` (one stage at a time, with a 4-chip stage tracker showing pending/✓/✗) → `result` (crown ceremony or near-miss).
   - Each stage records once via `onRecord(key, correct)` (the existing `recordQuizAnswer` path — feeds tricky-words, `/practice`, and the daily goal, same as every other drill). Typing stage counts only `"correct"` as a pass (`tones-off` fails, matching TypingPanel's persistence semantics); tone stage passes only when every syllable is right (matching TonePractice's `allCorrect`).
   - Quiz stage renders prompt hanzi + `promptPinyin` + `SpeakButton` after answer; cloze stage reuses the blank/choices/reveal layout with pinyin on reveal; tone stage reuses the per-syllable 1–5 chip rows (labels from `bareSyllables`); typing stage reuses the input + graded feedback showing tone-marked and tone-number forms. One attempt per stage, no skips — it's a boss.
   - On finishing stage 4: call `onComplete(score)` → parent persists via `recordBossResult` and the panel tracks `track("boss_round_completed", { topic, score, total, crowned })`. Result screen uses `animate-celebrate`; respect `use-reduced-motion.ts` if any extra motion is added.
6. **`src/components/topic-app.tsx`** — add `"boss"` to the mode union and a `Boss` tab last in the tab strip (line ~325); render `<BossPanel topic={topic} bossStat={progress.bossStats[topic.slug]} onRecord={recordQuizAnswer} onComplete={...} />` in a `mode === "boss"` block; reset to non-boss mode in the existing topic-switch adjust-state block (lines 101–111 already reset mode). Show a small `👑 Crowned` chip in the hero next to the progress area when `isCrowned(...)`. Optionally set a `bossCrownedThisVisit` state on a perfect run so the existing `showNextStep` (line 76) also surfaces `NextStepPanel` after a crown.
7. **`src/components/topic-card.tsx`** — add optional `crowned?: boolean` prop; render a `👑 Crowned` badge in the row-1 badge cluster (before `Learned`, same quiet-chip styling as `★ Saved`).
8. **Callers** — pass `crowned={Boolean(progress.bossStats[topic.slug]?.crownedAt)}` in `home-app.tsx:318`, `category-app.tsx:53`, and `path-app.tsx:97` (all already have `progress`).
9. **Tests** — new `tests/boss-logic.test.mjs`; extend `tests/progress-logic.test.mjs` (v5 migration + `recordBossResult`) and `tests/pinyin.test.mjs` (`bareSyllables`). Details under Test plan.
10. **Validation gate** — run `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/boss-logic.ts` | **new** — stage types + `buildBossRound` |
| `src/lib/pinyin.ts` | add `bareSyllables` |
| `src/lib/types.ts` | `BossStat`, `ProgressState.bossStats` |
| `src/lib/progress-logic.ts` | schema v5, `normalizeBossStats`, `recordBossResult`, `isCrowned` |
| `src/components/use-progress.ts` | expose `recordBossResult` |
| `src/lib/analytics.ts` | `"boss_round_completed"` event |
| `src/components/topic/boss-panel.tsx` | **new** — gauntlet UI |
| `src/components/topic-app.tsx` | Boss tab, panel wiring, hero crown chip |
| `src/components/tone-practice.tsx` | use shared `bareSyllables` |
| `src/components/topic-card.tsx` | `crowned` prop + badge |
| `src/components/home-app.tsx`, `category-app.tsx`, `path-app.tsx` | pass `crowned` |
| `tests/boss-logic.test.mjs` (**new**), `tests/progress-logic.test.mjs`, `tests/pinyin.test.mjs` | coverage |

### Proposed names and TypeScript signatures

```ts
// src/lib/boss-logic.ts
export const BOSS_STAGE_COUNT = 4;

export type BossStage =
  | { kind: "quiz"; key: string; card: QuizCard }
  | { kind: "cloze"; key: string; card: ClozeCard }
  | { kind: "tone"; key: string; item: VocabItem; tones: Tone[]; syllables: string[] }
  | { kind: "typing"; key: string; item: VocabItem };

export type BossRound = { stages: BossStage[] };

export function buildBossRound(
  items: VocabItem[],
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): BossRound;

// src/lib/pinyin.ts
export function bareSyllables(pinyin: string, count: number): string[];

// src/lib/types.ts
export type BossStat = { bestScore: number; attempts: number; crownedAt: string | null };
// ProgressState gains: bossStats: Record<string, BossStat>;  // keyed by topic slug, schema v5

// src/lib/progress-logic.ts
export function normalizeBossStats(raw: unknown): Record<string, BossStat>;
export function recordBossResult(
  bossStats: Record<string, BossStat>,
  slug: string,
  score: number,
  total: number,
  now?: Date,
): Record<string, BossStat>;
export function isCrowned(bossStats: Record<string, BossStat> | undefined, slug: string): boolean;

// src/components/topic/boss-panel.tsx
export function BossPanel(props: {
  topic: Topic;
  bossStat: BossStat | undefined;
  speechAvailable: boolean;
  onRecord: (key: string, correct: boolean) => void;   // recordQuizAnswer
  onComplete: (score: number) => void;                 // parent → recordBossResult + track
}): React.JSX.Element | null;
```

### UI copy / microcopy

- Tab label: **Boss** (crowned topics show **Boss 👑**).
- Intro: heading **“Topic Boss Round”**; body “Four questions, four skills — meaning, sentence, tones, and typed pinyin — each on a different word. Answer all four correctly to crown this topic.”; button **“Start the boss round”**; if previously attempted: “Best so far: 3/4 · 2 attempts”.
- Stage tracker chips: **Meaning · Sentence · Tones · Pinyin** (✓/✗ as they resolve).
- Stage kickers (the small emerald line each panel already uses): “Boss 1 of 4 — pick the meaning”, “Boss 2 of 4 — fill the blank”, “Boss 3 of 4 — call the tones”, “Boss 4 of 4 — type the pinyin”.
- Crown result: 👑 emoji, **“Topic crowned!”**, “All four skills, one clean run. {titleEn} is yours.” Buttons: **“Defend the crown”** (replay) / existing next-step panel handles “where to next”.
- Near miss (3/4): 💪 **“The boss survives — barely.”**, “3/4 — one skill away from the crown.” Button: **“Challenge again”**.
- Lower scores: “{score}/4 — warm up in the practice tabs, then come back for the crown.”
- Card badge: **👑 Crowned**; hero chip: **👑 Crowned**.
- Tone-stage helper (mirrors TonePractice): “Pick the tone for each syllable (1–4, or 5 for neutral).”

### Test plan

- **`tests/boss-logic.test.mjs`** (identity shuffle, fixtures with sentences like `cloze-logic.test.mjs`):
  - `buildBossRound` returns exactly 4 stages, one of each kind, in quiz→cloze→tone→typing order, with 4 **distinct** `key`s.
  - Cloze stage's card is non-null and its word has an eligible sentence; tone stage's `tones` match `tonesOf(item.pinyin)` and `syllables.length === tones.length`.
  - Degrade: with items whose sentences never contain their hanzi, the round still has 4 stages (extra quiz replaces cloze).
  - Distractors in quiz/cloze stages come from `pool` and never duplicate the answer (spot-check via existing helpers).
- **`tests/progress-logic.test.mjs`** additions:
  - `recordBossResult`: first run sets `attempts: 1`/`bestScore`; a 4/4 run sets `crownedAt` (injected `now`); a later 2/4 run keeps `crownedAt` and `bestScore` but bumps `attempts`; score never exceeds `total`.
  - `normalizeProgress`: a v4 save (no `bossStats`) migrates to `{}` with everything else intact; corrupt `bossStats` entries (negative counts, junk `crownedAt`, non-object) normalize safely; round-trip idempotence.
- **`tests/pinyin.test.mjs`**: `bareSyllables("gǒu", 1) → ["gou"]`, multi-syllable split, count-mismatch fallback to whole word (mirrors current `displaySyllables` behavior).
- Full gate: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.

### Manual QA checklist

- [ ] Open any topic → **Boss** tab appears last; intro renders with pinyin-free spoilers (no answers leaked).
- [ ] Complete a run answering all four correctly → crown ceremony; 👑 appears in the hero, on the topic's card on `/`, `/categories/[slug]`, and `/path` after navigating back; survives a hard reload (localStorage).
- [ ] Miss one stage → near-miss copy, no crown, `bestScore`/`attempts` update on the intro screen next visit.
- [ ] Each stage records into per-word stats: miss the same word's boss questions 3+ times → it surfaces under Trickiest words on `/stats` and in `/practice`.
- [ ] Boss answers count toward the daily-goal ring (via `recordQuizAnswer`).
- [ ] Typing stage: tone marks, tone numbers, and bare letters all grade as in the Type tab; `tones-off` shows amber feedback and fails the stage.
- [ ] Tone stage: chips disabled after check; correct tones revealed; full tone-marked pinyin shown post-check.
- [ ] Switching topics mid-run resets the boss (existing topic-switch reset path); switching tabs mid-run and returning starts a fresh round (state is panel-local, same as Type/Sentences).
- [ ] Useful-phrases topics: boss works; typing a long phrase is hard but gradeable.
- [ ] Old progress blob (v4, no `bossStats`) loads without error; export → import round-trips crowns.
- [ ] Mobile 360px: tab strip scrolls, all targets ≥44px; keyboard-only run possible; feedback uses text + color, never color alone.
- [ ] Tone-colored pinyin toggle still renders correctly on reveals (no regression from the `bareSyllables` refactor in Tone practice).

### Acceptance criteria

1. Every topic page has a Boss tab running a 4-stage gauntlet (quiz, cloze, tone, typing), each stage on a different word from that topic, generated only from `topics.json`.
2. A flawless run (4/4) permanently crowns the topic in localStorage (schema v5, migrated safely from v4) and the crown is visible on the topic page and on `TopicCard` in home, category, and path grids.
3. Best score and attempt count persist and are shown on the boss intro.
4. Every stage answer is recorded through `recordQuizAnswer`, so boss results feed weak-word stats, `/practice`, streaks, and the daily goal exactly like existing drills.
5. Chinese text always carries pinyin on reveal; the whole flow is usable offline (no network calls).
6. All five gate commands pass.

### Risk and rollback notes

- **Schema bump (v4 → v5)** is the main risk. Mitigated: `normalizeProgress` is the single load path and is written to never throw; the new field defaults to `{}`. If a user later runs an older build, its `normalizeProgress` simply drops the unknown `bossStats` field — crowns lost, nothing corrupted.
- **`bareSyllables` extraction** touches TonePractice; behavior must be copied verbatim (fallback to whole bare word on count mismatch) and is pinned by new pinyin tests.
- **Tone/boss answers entering `quizStats`** slightly broadens what "quiz accuracy" means — acceptable and consistent with Type/Match/Sentences, which already do this; noted in code comments.
- Rollback: revert the single sprint commit. Persisted v5 blobs remain loadable by the reverted (v4) code because `normalizeProgress` ignores unknown fields and re-stamps the version.

### Non-goals / deferrals

- No timers, lives, HP bars, or sound effects — the drama comes from one-shot stages and the crown; keeps the UI sleek and a11y simple.
- No listening stage in the boss (speech availability varies by device; the crown must be earnable everywhere). Could be a bonus 5th stage later.
- No crown count on `/stats` or category mastery panels (cheap follow-up).
- No match-game stage (pairs don't reduce to "one question").
- No boss round on `/practice` or cross-topic "world boss"; single-topic capstone only.
- No new routes/SEO surfaces — the boss lives inside the existing client component, so zero Next.js 16 routing surface is touched.

### Ready-to-run Opus implementation prompt for Sprint 9

```
You are implementing Sprint 9 "Topic Boss Round" in the learn-10-mandarin-words repo
(Next.js 16 / React 19 / Tailwind 4, static + local-first; read AGENTS.md — check
node_modules/next/dist/docs/ before any framework-touching code). Do NOT add backends,
packages, or invented vocabulary. Follow existing code style and comment density.

FEATURE: a "Boss" tab on every topic page (src/components/topic-app.tsx) running a
4-stage gauntlet — one question per skill, each on a DIFFERENT word from the topic:
  1. Meaning  — multiple-choice via buildQuizCard(item, pool, "hanzi-english", keyFor, shuffle)
                from src/lib/quiz-logic.ts (show promptPinyin; SpeakButton after answering).
  2. Sentence — cloze via buildClozeCard from src/lib/cloze-logic.ts (reuse the
                cloze-panel.tsx blank/choices/reveal layout, pinyin on reveal).
  3. Tones    — per-syllable 1–5 tone chips like tone-practice.tsx; correct only if every
                syllable matches tonesOf(item.pinyin) from src/lib/pinyin.ts.
  4. Pinyin   — typed input graded by gradeTypedPinyin from src/lib/typing-logic.ts;
                only "correct" passes ("tones-off" fails, amber feedback, show tone-marked
                + toneNumberForm answers like typing-panel.tsx).
Stage order fixed quiz→cloze→tone→typing. One attempt per stage, no skip. 4/4 crowns
the topic permanently.

BUILD, in this order:
1. src/lib/boss-logic.ts (pure, DOM-free, shuffle-injectable; use explicit .ts extensions
   for runtime lib imports, mirroring cloze-logic.ts): BossStage discriminated union
   ({kind:"quiz",key,card} | {kind:"cloze",key,card} | {kind:"tone",key,item,tones,syllables}
   | {kind:"typing",key,item}), BossRound {stages}, BOSS_STAGE_COUNT=4, and
   buildBossRound(items, pool, keyFor, shuffle=defaultShuffle): shuffle items once, assign
   distinct words — cloze-eligible (clozeSentences non-empty) first, then tone-eligible
   (tonesOf non-empty), then quiz, then typing; if a skill has no eligible word, substitute
   an extra quiz stage so there are always 4 stages with 4 distinct keys.
2. src/lib/pinyin.ts: add bareSyllables(pinyin, count): string[] — extract the exact
   displaySyllables logic from src/components/tone-practice.tsx (strip tones, split on
   separators, fallback to [whole bare word] on count mismatch) and refactor
   tone-practice.tsx to import it. Behavior must be identical.
3. Schema v5: in src/lib/types.ts add BossStat {bestScore:number; attempts:number;
   crownedAt:string|null} and bossStats: Record<string,BossStat> (keyed by topic slug) to
   ProgressState. In src/lib/progress-logic.ts bump CURRENT_PROGRESS_SCHEMA_VERSION to 5,
   document the migration in the existing comment, add bossStats:{} to emptyProgress, add
   normalizeBossStats (never throws; non-negative ints, bestScore ≤ 4 cap by total, bad
   crownedAt → null), wire into normalizeProgress, and add pure
   recordBossResult(bossStats, slug, score, total, now=new Date()) — bump attempts, raise
   bestScore, set crownedAt ONLY on score===total and only if not already crowned — plus
   isCrowned(bossStats, slug).
4. src/components/use-progress.ts: expose recordBossResult(slug, score, total) via
   setProgress (do NOT wrap in withPractice; per-word practice is recorded per stage).
5. src/lib/analytics.ts: add "boss_round_completed" to AnalyticsEvent.
6. src/components/topic/boss-panel.tsx (client): phases intro → running → result.
   Intro: heading "Topic Boss Round", body "Four questions, four skills — meaning,
   sentence, tones, and typed pinyin — each on a different word. Answer all four correctly
   to crown this topic.", button "Start the boss round", and "Best so far: X/4 · N attempts"
   when bossStat exists. Running: 4-chip tracker (Meaning · Sentence · Tones · Pinyin,
   pending/✓/✗), stage kickers "Boss 1 of 4 — pick the meaning" etc. Record each stage
   once via onRecord(key, correct) (the recordQuizAnswer prop). Result: 4/4 → 👑
   "Topic crowned!" + "All four skills, one clean run. {titleEn} is yours." + button
   "Defend the crown"; 3/4 → 💪 "The boss survives — barely." + "3/4 — one skill away
   from the crown." + "Challenge again"; else "{score}/4 — warm up in the practice tabs,
   then come back for the crown." Call onComplete(score) exactly once, then
   track("boss_round_completed", {topic, score, total, crowned}). Reuse the existing
   visual language: bg-surface cards, animate-quiz-correct/wrong, animate-celebrate,
   emerald/rose/amber, min-h-[44px], lang attrs from src/lib/lang.ts, SpeakButton only
   where it can't leak an answer. Build the round once per mount/restart via useState
   initializer (mirror cloze-panel.tsx).
7. src/components/topic-app.tsx: add "boss" to the mode union, a Boss tab last in the
   tab strip (label "Boss", "Boss 👑" when crowned), render BossPanel with
   bossStat={progress.bossStats[topic.slug]}, onRecord={recordQuizAnswer},
   onComplete persisting via recordBossResult; add a quiet "👑 Crowned" chip in the hero
   when isCrowned; the existing topic-switch reset block must also land off "boss".
8. src/components/topic-card.tsx: optional crowned?: boolean prop; quiet "👑 Crowned"
   chip in the row-1 badge cluster before Learned. Pass
   crowned={Boolean(progress.bossStats[topic.slug]?.crownedAt)} from home-app.tsx,
   category-app.tsx, and path-app.tsx TopicCard call sites.
9. Tests (node --test, .mjs importing ../src/lib/*.ts with identity shuffle, mirroring
   tests/quiz-logic.test.mjs): new tests/boss-logic.test.mjs (4 stages, one per kind,
   fixed order, distinct keys; cloze fallback to extra quiz; tone syllables/tones align);
   extend tests/progress-logic.test.mjs (recordBossResult semantics incl. crown
   preservation on later worse runs, v4→v5 migration, corrupt bossStats normalization);
   extend tests/pinyin.test.mjs (bareSyllables incl. mismatch fallback).

CONSTRAINTS: pinyin must accompany Chinese text on every reveal; no network calls;
everything works offline; no invented words/sentences — only topics.json via existing
builders; text+color for all feedback (never color alone).

VALIDATION GATE — all must pass before you finish:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I've inspected the repo — quiz engine, practice/review session patterns, progress store, shortcuts, SEO helpers, tests — and here is the plan.

## Sprint 10 — Pass-and-play duel: two learners, one device, alternating questions

### Goal and user value

Add a `/duel` page where two people share one device and take turns answering multiple-choice vocabulary questions from a topic they pick. Alternating turns, a live score tally, a "pass the phone" hand-off screen, and a winner celebration make practicing with a friend or family member a game — with zero accounts, servers, or network features. Retention value: both players see every prompt (hanzi + pinyin) and the answer reveal, so even the spectator gets a rep on each word, and the results screen lists missed words for joint review.

### Current-state findings grounded in actual files/components/helpers

- **The quiz engine is already pure and reusable.** `src/lib/quiz-logic.ts` exports `buildQuiz` / `buildQuizCard` / `rankedDistractors` with an injectable `shuffle` for deterministic tests, four modes (`hanzi-english`, `english-hanzi`, `hanzi-pinyin`, `listening`), and tempting-distractor ranking (`src/lib/quiz-logic.ts:200-237`). The duel can build its deck entirely from this — no new question-generation code.
- **There's an established "pure session state machine + snapshotting client app" pattern to copy.** `src/lib/session-logic.ts` is a DOM-free review-session machine tested in `tests/session-logic.test.mjs`; `src/components/practice-app.tsx:36-57` shows the session-snapshot pattern (build once, never a live memo) and the loading/empty/done screen structure. The duel state machine should mirror this exactly.
- **Answer UI, feedback animations, and progress bars are existing conventions.** `src/components/topic/quiz-panel.tsx:219-243` and `practice-app.tsx:255-281` render choices with `animate-quiz-correct` / `animate-quiz-wrong` (defined in `src/app/globals.css:129-144`), `role="listbox"` semantics, and `min-h-[52px]` touch targets. The completion screens use `animate-celebrate` (`globals.css:144`).
- **Keyboard shortcuts are reusable as-is.** `src/lib/shortcut-logic.ts` maps 1–9/Enter/→/P/R to intents by phase (`question`/`answered`/`done`), and `src/components/use-practice-shortcuts.ts` is the document-level adapter with an `enabled` flag — the duel can pass `enabled: false` during hand-off screens and reuse everything.
- **Progress stats must NOT be polluted.** `useProgress().recordQuizAnswer` (`src/components/use-progress.ts:115-118`) feeds `quizStats`, the weak-word deck (`src/lib/practice-logic.ts:34`), and the daily-goal ring. Two people sharing one device would corrupt the owner's SRS/weak-word data, so the duel must not call it. Duel history needs its own localStorage key (the progress store uses `learn-10-mandarin-progress-v1`, analytics uses `learn-10-mandarin-analytics-v1` — same naming convention applies).
- **Language/pinyin conventions:** hanzi carries `lang={HANZI_LANG}`, pinyin `lang={PINYIN_LANG}` (`src/lib/lang.ts`), and `quizPromptLang`/`quizChoiceLang` already compute per-mode `lang` attributes. Sprint 10 (tone colors) added `src/components/tone-pinyin.tsx`, which the duel's pinyin lines should use so tone coloring works there too.
- **Listening mode gating:** `quiz-panel.tsx:128` only shows the Listen mode when speech is confirmed available; `src/components/use-speech.ts` is the hardened speech hook. Same gating applies to the duel's mode picker.
- **Route/SEO plumbing:** new pages follow `src/app/review/page.tsx` (server page with `metadata` + `alternates.canonical`, rendering a client app). The sitemap is derived from `sitemapEntries` in `src/lib/seo.ts:99-117` (unit-tested in `tests/seo.test.mjs`), so `/duel` must be added there, not in `src/app/sitemap.ts`. `public/sw.js` `PRECACHE_URLS` does not include `/practice`, so `/duel` needs no SW change.
- **Payload discipline:** the home route ships `homeData()` — `TopicSummary` items without `sentences` — to stay ~118KB instead of ~350KB (`src/lib/types.ts:59-63`, `src/lib/data.ts:12-21`). The duel needs a full topic list for its picker but never renders sentences, so it should receive `homeData()` too. `quiz-logic.ts` only ever reads `hanzi`/`pinyin`/`english`, but its signatures demand full `VocabItem` — a small type widening fixes this with zero runtime change.
- **Entry points:** `src/components/bottom-nav.tsx` already has 5 items (full), so the duel should be linked from the practice section of `src/components/home-app.tsx` (`id="practice"`, line 225) and the footer link row (~line 337) instead.
- **Dataset shape:** 102 topics × 10 words each (verified from `src/data/topics.json`), so a duel over one topic naturally supports 10 questions = 5 per player with every word appearing exactly once.
- **Analytics:** `src/lib/analytics.ts` has a closed `AnalyticsEvent` union (`practice_session_completed`, `quiz_completed`, …); a `duel_completed` event must be added to the union to type-check.

### Exact implementation steps in sequence

1. **Read the local Next.js 16 docs first** (`node_modules/next/dist/docs/01-app/...`) per `AGENTS.md`, specifically routing/pages/metadata conventions, before creating the new route.
2. **Widen `src/lib/quiz-logic.ts` item types (type-only change).** Introduce `export type QuizWord = Pick<VocabItem, "hanzi" | "pinyin" | "english">` and change `rankedDistractors`, `buildQuizCard`, `buildQuiz`, `itemsForKeys`, and the internal helpers (`dedupeByField`, `distractorScore`, `englishAnswerScore`) to accept `QuizWord` (or `<T extends QuizWord>` where items round-trip). `VocabItem` is structurally assignable to `QuizWord`, so every existing caller (`topic-app.tsx`, `practice-logic.ts`) compiles unchanged, and existing `.mjs` tests are unaffected. This lets the duel run on `TopicSummary` items.
3. **Create `src/lib/duel-logic.ts`** — a pure, DOM-free state machine modeled on `session-logic.ts` (types and signatures below): build an alternating turn list from a topic's items via `buildQuizCard`, then drive `handoff → question → answered → … → done` transitions, tally per-player scores, and collect per-player missed keys. Include `normalizeDuelHistory` for the localStorage record. Use explicit `.ts` extensions on runtime imports (`quiz-logic.ts` comment, lines 2–6, explains the `node --test` requirement).
4. **Write `tests/duel-logic.test.mjs`** mirroring `tests/session-logic.test.mjs` style: identity-shuffle injection, fixtures of 10 summary items; assert alternation, equal question counts, even-clamping on odd pools, scoring, phase legality (answering during handoff is a no-op), tie/winner results, missed-key collection, and history normalization of garbage input.
5. **Add `duel_completed` to the `AnalyticsEvent` union** in `src/lib/analytics.ts:15-33`.
6. **Create `src/components/use-duel-history.ts`** — a small client hook owning localStorage key `learn-10-mandarin-duel-v1` (load-once/save-on-change, `try/catch` around storage like `use-progress.ts:50-65`), storing remembered player names and the last 20 results via `normalizeDuelHistory`.
7. **Create `src/components/duel-app.tsx`** (`"use client"`), the four-screen flow — setup → handoff → question → results — reusing `usePracticeShortcuts` (disabled during setup/handoff), `useSpeech` for listening-mode gating and pronunciation, `SpeakButton`, `TonePinyin` for pinyin lines, and the existing choice-button/progress-bar/celebration styling from `practice-app.tsx`. Explicitly do **not** import `useProgress`. Fire `track("duel_completed", { topic, mode, scoreA, scoreB })` once on completion.
8. **Create `src/app/duel/page.tsx`** following `src/app/review/page.tsx`: `metadata` with title "Pass & Play Duel", description, `alternates: { canonical: "/duel" }`, rendering `<DuelApp data={homeData()} />`.
9. **Add `/duel` to `sitemapEntries`** in `src/lib/seo.ts` (in the utility-route block with priority 0.8 alongside `/path` and `/practice`, since it's a destination page) and update `tests/seo.test.mjs` expectations accordingly.
10. **Add entry points in `src/components/home-app.tsx`:** a card/link in the practice section (~line 225) with the ⚔️ framing, and a "Duel" link in the footer nav row (~line 337). No `bottom-nav.tsx` change.
11. **Run the validation gate** (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and fix anything it surfaces.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/duel-logic.ts` | new — pure duel state machine + history normalization |
| `tests/duel-logic.test.mjs` | new — unit tests |
| `src/components/duel-app.tsx` | new — client UI (setup/handoff/question/results) |
| `src/components/use-duel-history.ts` | new — localStorage hook for names + past results |
| `src/app/duel/page.tsx` | new — server page + metadata |
| `src/lib/quiz-logic.ts` | widen item types to `QuizWord` (type-only) |
| `src/lib/analytics.ts` | add `duel_completed` event |
| `src/lib/seo.ts` + `tests/seo.test.mjs` | add `/duel` sitemap entry + test expectation |
| `src/components/home-app.tsx` | duel entry card + footer link |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/duel-logic.ts
import type { QuizCard, QuizMode, QuizWord } from "./quiz-logic.ts";

export type DuelPlayerIndex = 0 | 1;
export type DuelPhase = "handoff" | "question" | "answered" | "done";

export type DuelTurn = { player: DuelPlayerIndex; card: QuizCard };

export type DuelState = {
  turns: DuelTurn[];
  position: number;              // index into turns
  phase: DuelPhase;
  scores: [number, number];
  picked: string | null;         // choice picked on the current turn
  missedKeys: [string[], string[]]; // per-player missed card keys, deduped
};

/** Questions per player in a standard duel (10-word topic → every word once). */
export const QUESTIONS_PER_PLAYER = 5;

/** Shuffle items, clamp to an even count ≤ 2×perPlayer, alternate players 0,1,0,1… */
export function buildDuelTurns(
  items: QuizWord[],
  mode: QuizMode,
  keyFor: (item: QuizWord) => string,
  perPlayer?: number,
  shuffle?: <T>(items: T[]) => T[],
): DuelTurn[];

export function startDuel(turns: DuelTurn[]): DuelState;      // phase "handoff" (or "done" if empty)
export function beginQuestion(state: DuelState): DuelState;   // handoff → question; no-op otherwise
export function answerCurrent(state: DuelState, choice: string): DuelState; // question → answered; tallies
export function advanceTurn(state: DuelState): DuelState;     // answered → next handoff, or done
export function currentTurn(state: DuelState): DuelTurn | null;
export function questionNumberForPlayer(state: DuelState): { asked: number; of: number };
export function duelResult(state: DuelState): { winner: DuelPlayerIndex | "tie"; scores: [number, number] };

// localStorage record (key: "learn-10-mandarin-duel-v1")
export type DuelRecord = { at: string; topicSlug: string; mode: QuizMode; scores: [number, number] };
export type DuelHistory = { schemaVersion: 1; names: [string, string]; results: DuelRecord[] };
export const DUEL_HISTORY_LIMIT = 20;
export function emptyDuelHistory(): DuelHistory;
export function normalizeDuelHistory(raw: unknown): DuelHistory;
export function appendDuelRecord(history: DuelHistory, record: DuelRecord): DuelHistory; // caps at limit
```

```ts
// src/components/use-duel-history.ts
export function useDuelHistory(): {
  history: DuelHistory;
  loaded: boolean;
  setNames(names: [string, string]): void;
  recordResult(record: DuelRecord): void;
};

// src/components/duel-app.tsx
export function DuelApp({ data }: { data: HomeData }): JSX.Element;
// internal screens (not exported): DuelSetup, DuelHandoff, DuelQuestion, DuelResults
```

`answerCurrent` and `advanceTurn` are pure (return new state, never mutate) so every branch is testable under `node --test`, matching `gradeCard`'s contract in `session-logic.ts:53-75`.

### UI copy / microcopy

- Page heading: **"Pass & Play Duel"** — subline: *"Two learners, one device. Take turns — most correct answers wins."*
- Setup: name fields labeled **"Player 1"** / **"Player 2"** (placeholders `Player 1` / `Player 2`, maxLength 12); topic picker heading **"Pick a topic"** with a **"🎲 Surprise us"** random button; mode selector reusing quiz-panel labels (`Hanzi → English`, `English → Hanzi`, `Hanzi → Pinyin`, `Listen 🔊`); start button **"Start duel ⚔️"**.
- Handoff screen: **"Pass to {name}"** headline, *"No peeking, {otherName}!"* subline, button **"I'm ready"**.
- Question header: **"{name} · Question {n} of {perPlayer}"**; score chips **"{name} {score}"** for both players, current player's chip highlighted.
- After answering: correct → **"+1 for {name}!"**; wrong → **"It was {answer}."** (the correct choice also flashes green, existing convention). Advance button **"Pass to {otherName}"** (or **"See results"** on the last turn).
- Results: winner **"🏆 {name} wins {a}–{b}!"**; tie **"🤝 It's a tie, {a}–{b}!"**; missed-words card titled **"Words to review together"** (hanzi + pinyin + English rows, same layout as `quiz-panel.tsx:76-84`); buttons **"Rematch"** (same topic, reshuffled, loser goes first), **"New duel"** (back to setup), link **"Study this topic →"** to `/topics/{slug}`.
- Empty/edge state (topic with <2 items — shouldn't exist, but guard): *"This topic doesn't have enough words for a duel."*

All hanzi rendered with `lang={HANZI_LANG}` + `font-hanzi`; every pinyin line via `<TonePinyin>` with `lang={PINYIN_LANG}`.

### Test plan

- **`tests/duel-logic.test.mjs`** (new, `node --test`, identity shuffle injected):
  - `buildDuelTurns` alternates players strictly 0,1,0,1…; 10 items → 10 turns, 5 per player; each card key unique.
  - Odd/small pools clamp to an even turn count (e.g. 7 items → 6 turns, 3 each); empty pool → `startDuel` is immediately `done`.
  - Phase legality: `answerCurrent` during `handoff` and `beginQuestion` during `question` are no-ops; `advanceTurn` from the last `answered` turn → `done`.
  - Scoring: correct answers increment only the current player's score; wrong answers add the card key to only that player's `missedKeys`, deduped.
  - `duelResult` returns the right winner and `"tie"` on equal scores.
  - `normalizeDuelHistory` survives `null`/garbage/missing fields and caps results at `DUEL_HISTORY_LIMIT`; `appendDuelRecord` drops the oldest.
- **`tests/seo.test.mjs`**: extend to assert `/duel` appears in `sitemapEntries`.
- **Existing suites** (`quiz-logic`, `practice-logic`, etc.) must pass unchanged — the `QuizWord` widening is compile-time only.
- Full gate: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.

### Manual QA checklist

- [ ] `/duel` loads statically; setup shows names, topic picker (all 102 topics reachable), mode selector; Listen mode hidden in a browser with no Chinese voice.
- [ ] Start duel → handoff screen shows Player 1's name and does not reveal the upcoming prompt.
- [ ] Questions alternate players; header count is per-player (1–5), score chips update live and highlight the active player.
- [ ] Correct/wrong feedback animates (`animate-quiz-correct`/`animate-quiz-wrong`); wrong pick reveals the right answer.
- [ ] Keyboard: 1–4 answer, Enter/→ advance, P pronounces, R rematches on the results screen; keys dead during setup/handoff and inside the name inputs.
- [ ] Listening mode: play button per question, no autoplay, prompt hanzi/pinyin only revealed after answering (mirrors `quiz-panel.tsx:155-201`).
- [ ] Results: correct winner/tie copy, merged missed-word list with pinyin on every Chinese line, Rematch reshuffles and the loser starts.
- [ ] Refresh mid-duel simply restarts (acceptable, documented); player names persist across visits; a duel does **not** change the daily-goal ring, streak, `/practice` deck, or `/stats` numbers.
- [ ] Mobile (~390px): touch targets ≥44px, handoff screen full-width and thumb-friendly; dark theme consistent with the rest of the app.
- [ ] Tone-colors toggle affects duel pinyin.

### Acceptance criteria

1. Two players on one device can complete a full duel (5 questions each over a chosen topic, any of the available modes) with alternating turns, a hand-off interstitial, live scores, and a winner/tie results screen.
2. All duel turn/score/phase logic lives in pure, unit-tested `src/lib/duel-logic.ts`; the component only renders and dispatches.
3. Duel play writes nothing to `learn-10-mandarin-progress-v1` (no `recordQuizAnswer`/`gradeWord` calls); names and the last 20 results persist under `learn-10-mandarin-duel-v1`.
4. Every rendered Chinese line carries pinyin (via `TonePinyin`) and correct `lang` attributes; no invented vocabulary — all words come from `topics.json`.
5. `/duel` has canonical metadata, appears in the sitemap, and is linked from the home page practice section and footer.
6. The full validation gate passes.

### Risk and rollback notes

- **Stat pollution** is the main product risk; it's designed out by never touching `useProgress` — the acceptance criteria and QA checklist both verify it.
- **`quiz-logic.ts` type widening** touches shared code; risk is compile-time only (structural widening, no runtime edits). If it causes friction, fallback: pass full `data` from `src/lib/data.ts` to `DuelApp` instead (costs RSC payload, changes nothing else) and leave `quiz-logic.ts` untouched.
- **Shared-device fairness:** player 2 can see player 1's Q&A — inherent to pass-and-play and mitigated by the handoff screen hiding the *next* prompt; a spectator seeing reveals is a retention feature, not a bug.
- **Rollback** is clean: the feature is one new route + three new modules + four small additive edits (analytics union, seo entry + test, home links, quiz-logic types). Reverting the commit fully removes it; the isolated localStorage key means stale duel data left on devices is harmless.

### Non-goals / deferrals

- No online/Bluetooth multiplayer, accounts, servers, or leaderboards (explicitly out of scope for this app).
- No 3+ players, no configurable round counts (fixed 5 per player in v1), no sudden-death tiebreaker (ties are a friendly draw), no cross-topic "mixed" decks.
- No per-player SRS or feeding duel answers into weak-word stats (deliberate, see risks).
- No bottom-nav slot (it's full at 5 items), no mid-duel resume across page reloads, no service-worker precache entry.

### Ready-to-run Opus implementation prompt for Sprint 10

```text
You are implementing Sprint 10 of the "Learn 10 Mandarin Words" app (Next.js 16 App Router,
React 19, Tailwind 4, static/local-first, no backend). Per AGENTS.md, this Next.js version has
breaking changes — read the relevant guides in node_modules/next/dist/docs/ before writing any
route or metadata code.

FEATURE: /duel — a pass-and-play vocabulary duel. Two learners share one device, pick a topic
(from src/data/topics.json via homeData()) and a quiz mode, then alternate answering
multiple-choice questions (5 each over a 10-word topic, every word asked once). A "Pass to
{name}" interstitial separates turns so the next prompt is never pre-read. Live score chips,
winner/tie results with a merged "Words to review together" list, Rematch (reshuffle, loser
starts) and New duel actions.

HARD CONSTRAINTS:
- Do NOT call useProgress/recordQuizAnswer/gradeWord anywhere in duel code — duels must not
  affect quizStats, flashcardStats, dailyActivity, streaks, or /practice.
- Persist only { schemaVersion: 1, names, results (last 20) } under localStorage key
  "learn-10-mandarin-duel-v1", normalized defensively like normalizeProgress does.
- No invented vocabulary or metadata; all words come from the dataset. Every rendered Chinese
  line shows pinyin, using <TonePinyin> (src/components/tone-pinyin.tsx) with lang tags from
  src/lib/lang.ts (HANZI_LANG on hanzi, PINYIN_LANG on pinyin).
- Match existing UI conventions: choice buttons / animate-quiz-correct / animate-quiz-wrong /
  animate-celebrate / progress-bar-track / kbd hints exactly as in
  src/components/practice-app.tsx and src/components/topic/quiz-panel.tsx; dark sleek theme;
  min 44px touch targets.

BUILD IN THIS ORDER:
1. src/lib/quiz-logic.ts: add `export type QuizWord = Pick<VocabItem, "hanzi"|"pinyin"|"english">`
   and widen rankedDistractors/buildQuizCard/buildQuiz/itemsForKeys and internal helpers to
   accept QuizWord. Type-only change; zero runtime edits; all existing callers must compile.
2. src/lib/duel-logic.ts (pure, DOM-free, runtime imports use explicit .ts extensions like
   quiz-logic.ts does): DuelTurn/DuelState/DuelPhase types; QUESTIONS_PER_PLAYER = 5;
   buildDuelTurns(items, mode, keyFor, perPlayer?, shuffle?) that shuffles, clamps to an even
   count ≤ 2×perPlayer, builds cards with buildQuizCard, and alternates players 0,1,0,1…;
   startDuel/beginQuestion/answerCurrent/advanceTurn/currentTurn/questionNumberForPlayer/
   duelResult — all pure, illegal-phase calls are no-ops; DuelHistory types with
   emptyDuelHistory/normalizeDuelHistory/appendDuelRecord (cap 20).
3. tests/duel-logic.test.mjs (node --test, style of tests/session-logic.test.mjs, identity
   shuffle injected): alternation, equal per-player counts, odd-pool even-clamping, empty pool
   → immediately done, phase legality, per-player scoring and missedKeys dedup, winner/tie,
   history normalization of garbage input and the 20-record cap.
4. src/lib/analytics.ts: add "duel_completed" to the AnalyticsEvent union.
5. src/components/use-duel-history.ts: client hook (load once, save on change, try/catch
   storage like use-progress.ts) exposing history/loaded/setNames/recordResult.
6. src/components/duel-app.tsx ("use client"): DuelApp({ data }: { data: HomeData }) with
   setup → handoff → question → results screens. Reuse usePracticeShortcuts (enabled only
   during question/answered/done; name inputs are editable targets and already guarded),
   useSpeech + SpeakButton (gate the Listen 🔊 mode on speech availability exactly like
   topic-app/quiz-panel; no autoplay; hide hanzi/pinyin until answered in listening mode).
   Track "duel_completed" once with { topic, mode, scoreA, scoreB }. Copy: "Pass & Play Duel";
   "Two learners, one device. Take turns — most correct answers wins."; "Pass to {name}" /
   "No peeking, {other}!" / "I'm ready"; "{name} · Question {n} of 5"; "+1 for {name}!" /
   "It was {answer}."; "🏆 {name} wins {a}–{b}!" / "🤝 It's a tie, {a}–{b}!"; "Words to review
   together"; buttons "Start duel ⚔️", "Rematch", "New duel", "Study this topic →",
   "🎲 Surprise us" (random topic).
7. src/app/duel/page.tsx: server page like src/app/review/page.tsx — metadata title
   "Pass & Play Duel", description mentioning two players/one device/no account,
   alternates.canonical "/duel", rendering <DuelApp data={homeData()} />.
8. src/lib/seo.ts: add "/duel" to sitemapEntries (priority 0.8 group with /path and /practice);
   update tests/seo.test.mjs expectations.
9. src/components/home-app.tsx: add a duel entry card/link in the practice section (id
   "practice") and a "Duel" link in the footer nav row. Do NOT touch bottom-nav.tsx.

NON-GOALS: no online multiplayer, no 3+ players, no round-count settings, no sudden death
(ties are draws), no mid-duel resume across reloads, no service-worker changes.

VALIDATION GATE — all must pass before you are done:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

One note: the git log shows a commit named "sprint 10: optional tone-colored pinyin" already on `main`, so this duel sprint will land as the next commit — worth numbering it "sprint 11" in the eventual commit message even though the backlog calls it Sprint 10.
